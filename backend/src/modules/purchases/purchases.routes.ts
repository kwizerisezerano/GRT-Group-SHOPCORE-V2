import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toSnakeCase } from "../../lib/caseMapping";
import { HttpError } from "../../lib/httpError";
import { applyStockMovement, type TransactionClient } from "../../lib/stockMovement";
import { runInTransaction } from "../../lib/transaction";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";
import { requireTenant } from "../../middleware/requireTenant";

/**
 * Purchases — goods received from a supplier.
 *
 * The mirror image of a sale, and built the same way for the same reasons: a
 * receipt writes a header, its lines and a stock movement per product, and all
 * of it must land together. A receipt that moved stock but failed to save its
 * lines would inflate inventory with nothing to explain it, which is the same
 * class of damage as a sale that decremented stock and lost its record.
 */

export const purchasesRouter = Router();
purchasesRouter.use(requireAuth, requireTenant);

const money = z.number().nonnegative().max(99_999_999_999.99);

const lineItemSchema = z.object({
  productId: z.string().uuid("Must be a valid product id"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  unitCost: money.optional(),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value));

const createPurchaseSchema = z.object({
  items: z.array(lineItemSchema).min(1, "A purchase needs at least one item"),
  supplierId: z.string().uuid().optional().nullable(),
  supplierName: optionalText(191),
  purchaseNo: optionalText(64),
  discount: money.default(0),
  tax: money.default(0),
  status: z.enum(["draft", "ordered", "received", "completed", "cancelled"]).default("completed"),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]).default("paid"),
  notes: optionalText(2000),
  clientRequestId: optionalText(64),
  offline: z.boolean().default(false),
  completedAt: z.coerce.date().optional().nullable(),
});

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Duplicate on the idempotency key specifically — see sales.routes.ts. */
function isDuplicateRequestId(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  const target = error.meta?.target;
  const asText = Array.isArray(target) ? target.join("_") : String(target ?? "");
  return asText.includes("client_request_id") || asText.includes("clientRequestId");
}

/**
 * Receipt numbers, allocated from the same per-tenant counter mechanism as
 * invoice numbers, for the same reason: counting today's rows and adding one
 * is only correct while requests arrive one at a time.
 */
async function nextPurchaseNo(tx: TransactionClient, tenantId: string) {
  const today = new Date();
  const stamp = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(
    today.getUTCDate()
  ).padStart(2, "0")}`;
  const period = `PO-${stamp}`;

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO invoice_counters (tenant_id, period, last_value)
    VALUES (${tenantId}, ${period}, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`);

  const [row] = await tx.$queryRaw<{ value: bigint | number }[]>(
    Prisma.sql`SELECT LAST_INSERT_ID() AS value`
  );

  return `PO-${stamp}-${String(Number(row.value)).padStart(4, "0")}`;
}

purchasesRouter.get(
  "/",
  requirePermission("purchases.view"),
  asyncHandler(async (req, res) => {
    const purchases = await req.tenantPrisma!.purchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { items: true },
    });

    sendSuccess(res, { messageKey: "purchases.listed", data: toSnakeCase(purchases) });
  })
);

purchasesRouter.get(
  "/:id",
  requirePermission("purchases.view"),
  asyncHandler(async (req, res) => {
    const purchase = await req.tenantPrisma!.purchase.findFirst({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!purchase) throw HttpError.notFound("purchases.notFound");

    sendSuccess(res, { messageKey: "purchases.fetched", data: toSnakeCase(purchase) });
  })
);

purchasesRouter.post(
  "/",
  requirePermission("purchases.create"),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const pick = (camel: string, snake: string) => body[camel] ?? body[snake];

    const input = createPurchaseSchema.parse({
      items: (body.items ?? []).map((item: Record<string, unknown>) => ({
        productId: item.productId ?? item.product_id,
        quantity: item.quantity,
        unitCost: item.unitCost ?? item.unit_cost ?? item.cost_price,
      })),
      supplierId: pick("supplierId", "supplier_id"),
      supplierName: pick("supplierName", "supplier_name"),
      purchaseNo: pick("purchaseNo", "purchase_no"),
      discount: body.discount ?? 0,
      tax: body.tax ?? 0,
      status: body.status ?? "completed",
      paymentStatus: pick("paymentStatus", "payment_status") ?? "paid",
      notes: body.notes,
      clientRequestId: pick("clientRequestId", "client_request_id"),
      offline: body.offline ?? false,
      completedAt: pick("completedAt", "completed_at"),
    });

    const tenantId = req.tenantId!;

    // Replay fast path — see sales.routes.ts. The unique index below is the
    // guarantee; this only avoids redoing the work in the common case.
    if (input.clientRequestId) {
      const already = await req.tenantPrisma!.purchase.findFirst({
        where: { clientRequestId: input.clientRequestId },
        include: { items: true },
      });

      if (already) {
        return sendSuccess(res, {
          messageKey: "purchases.alreadyRecorded",
          data: toSnakeCase(already),
        });
      }
    }

    let purchase;
    try {
      purchase = await runInTransaction(async (tx) => {
        const products = await tx.product.findMany({
          where: { tenantId, id: { in: input.items.map((i) => i.productId) } },
        });
        const byId = new Map(products.map((p) => [p.id, p]));

        const missing = input.items.filter((i) => !byId.has(i.productId));
        if (missing.length > 0) {
          throw HttpError.badRequest("purchases.unknownProduct", {
            code: "unknown_product",
            details: { productIds: missing.map((i) => i.productId) },
          });
        }

        if (input.supplierId) {
          const supplier = await tx.supplier.findFirst({
            where: { id: input.supplierId, tenantId },
          });
          if (!supplier) {
            throw HttpError.badRequest("purchases.unknownSupplier", {
              code: "unknown_supplier",
              details: { supplierId: input.supplierId },
            });
          }
        }

        const lines = input.items.map((item) => {
          const product = byId.get(item.productId)!;
          // Falls back to what the shop last paid, so a receipt that omits the
          // cost does not silently value the goods at zero.
          const unitCost = item.unitCost ?? Number(product.costPrice ?? 0);

          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: item.quantity,
            unitCost,
            subtotal: round2(unitCost * item.quantity),
          };
        });

        const subtotal = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));
        const total = round2(Math.max(0, subtotal + input.tax - input.discount));

        const created = await tx.purchase.create({
          data: {
            tenantId,
            purchaseNo: input.purchaseNo ?? (await nextPurchaseNo(tx, tenantId)),
            supplierId: input.supplierId ?? null,
            supplierName: input.supplierName ?? null,
            subtotal,
            tax: input.tax,
            discount: input.discount,
            total,
            status: input.status,
            paymentStatus: input.paymentStatus,
            notes: input.notes ?? null,
            userId: req.user!.id,
            clientRequestId: input.clientRequestId ?? null,
            source: input.offline ? "offline" : "online",
            completedAt: input.completedAt ?? new Date(),
            purchaseDate: input.completedAt ?? new Date(),
          },
        });

        /*
         * Stock goes on, and the product's cost is re-averaged as it does.
         *
         * A moving weighted average rather than "last cost wins": a shop that
         * has 100 units bought at 500 and receives 10 at 900 has not suddenly
         * paid 900 for everything on the shelf, and pricing off that would
         * quietly destroy the margin on the 100 it still holds. Averaging over
         * the stock actually held is what makes the cost on a later sale mean
         * something.
         *
         * Only for a receipt that really adds stock. A cancelled or draft
         * purchase records intent, not goods, and must not move either number.
         */
        const movesStock = input.status === "received" || input.status === "completed";

        for (const line of lines) {
          if (!movesStock) continue;

          const { stockBefore } = await applyStockMovement(tx, {
            tenantId,
            productId: line.productId,
            delta: line.quantity,
            reason: "purchase_receive",
            referenceType: "purchase",
            referenceId: created.id,
            userId: req.user!.id,
          });

          const product = byId.get(line.productId)!;
          const previousCost = Number(product.costPrice ?? 0);
          const heldBefore = Math.max(0, stockBefore);
          const costAfter =
            heldBefore + line.quantity > 0
              ? round2(
                  (heldBefore * previousCost + line.quantity * line.unitCost) /
                    (heldBefore + line.quantity)
                )
              : line.unitCost;

          await tx.product.update({
            where: { id: line.productId },
            data: { costPrice: costAfter },
          });

          await tx.purchaseItem.create({
            data: { tenantId, purchaseId: created.id, ...line, costAfter },
          });
        }

        if (!movesStock) {
          for (const line of lines) {
            await tx.purchaseItem.create({
              data: { tenantId, purchaseId: created.id, ...line, costAfter: null },
            });
          }
        }

        return tx.purchase.findFirstOrThrow({
          where: { id: created.id },
          include: { items: true },
        });
      });
    } catch (error) {
      if (isDuplicateRequestId(error) && input.clientRequestId) {
        const winner = await req.tenantPrisma!.purchase.findFirst({
          where: { clientRequestId: input.clientRequestId },
          include: { items: true },
        });

        if (winner) {
          return sendSuccess(res, {
            messageKey: "purchases.alreadyRecorded",
            data: toSnakeCase(winner),
          });
        }
      }

      throw error;
    }

    sendSuccess(res, {
      messageKey: "purchases.created",
      data: toSnakeCase(purchase),
      status: 201,
    });
  })
);
