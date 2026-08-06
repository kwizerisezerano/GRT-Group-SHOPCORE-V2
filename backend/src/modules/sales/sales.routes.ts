import { Router } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toSnakeCase } from "../../lib/caseMapping";
import { HttpError } from "../../lib/httpError";
import { applyStockMovement } from "../../lib/stockMovement";
import { runInTransaction } from "../../lib/transaction";
import { requireAuth } from "../../middleware/auth";
import { requireTenant } from "../../middleware/requireTenant";

/**
 * Sales.
 *
 * Not built on crudModuleFactory: a sale is a transaction, not a record. It
 * writes a header, its line items and a stock movement per product, and every
 * one of those must land together or not at all — a sale that decremented
 * stock but failed to save its lines would quietly destroy inventory.
 */

export const salesRouter = Router();
salesRouter.use(requireAuth, requireTenant);

const money = z.number().nonnegative().max(99_999_999_999.99);

const lineItemSchema = z.object({
  productId: z.string().uuid("Must be a valid product id"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  unitPrice: money.optional(),
  discount: money.default(0),
  taxRate: z.number().min(0).max(100).optional(),
});

const createSaleSchema = z.object({
  items: z.array(lineItemSchema).min(1, "A sale needs at least one item"),
  customerName: z.string().trim().max(191).optional().nullable(),
  paymentMethod: z.enum(["cash", "mobile_money", "card", "bank_transfer", "credit"]).default("cash"),
  paid: money.optional(),
  discount: money.default(0),
  branch: z.string().trim().max(191).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

/** Rounds to 2dp using integer arithmetic, avoiding float drift on money. */
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Invoice numbers are per tenant and sequential within a day, so two
 * businesses never collide and a cashier can read one aloud.
 */
async function nextInvoiceNo(tx: Parameters<typeof applyStockMovement>[0], tenantId: string) {
  const today = new Date();
  const stamp = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(
    today.getUTCDate()
  ).padStart(2, "0")}`;

  const todayCount = await tx.sale.count({
    where: { tenantId, invoiceNo: { startsWith: `INV-${stamp}` } },
  });

  return `INV-${stamp}-${String(todayCount + 1).padStart(4, "0")}`;
}

salesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const sales = await req.tenantPrisma!.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { saleItems: true },
    });

    sendSuccess(res, { messageKey: "sales.listed", data: toSnakeCase(sales) });
  })
);

salesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sale = await req.tenantPrisma!.sale.findFirst({
      where: { id: req.params.id },
      include: { saleItems: true },
    });
    if (!sale) throw HttpError.notFound("sales.notFound");

    sendSuccess(res, { messageKey: "sales.fetched", data: toSnakeCase(sale) });
  })
);

salesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    // Accept snake_case from the frontend, camelCase from scripts.
    const body = req.body ?? {};
    const input = createSaleSchema.parse({
      items: (body.items ?? []).map((item: Record<string, unknown>) => ({
        productId: item.productId ?? item.product_id,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? item.unit_price,
        discount: item.discount ?? 0,
        taxRate: item.taxRate ?? item.tax_rate,
      })),
      customerName: body.customerName ?? body.customer_name,
      paymentMethod: body.paymentMethod ?? body.payment_method ?? "cash",
      paid: body.paid,
      discount: body.discount ?? 0,
      branch: body.branch,
      notes: body.notes,
    });

    const tenantId = req.tenantId!;

    const sale = await runInTransaction(async (tx) => {
      /*
       * Prices come from the catalogue, not from the request. A client that
       * can name its own unit price can sell a television for one franc; the
       * only safe source is the product row. unitPrice is accepted solely as
       * a deliberate override for negotiated prices, and even then the
       * product must exist and belong to this tenant.
       */
      const products = await tx.product.findMany({
        where: { tenantId, id: { in: input.items.map((i) => i.productId) } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      const missing = input.items.filter((i) => !byId.has(i.productId));
      if (missing.length > 0) {
        throw HttpError.badRequest("sales.unknownProduct", {
          code: "unknown_product",
          details: { productIds: missing.map((i) => i.productId) },
        });
      }

      const lines = input.items.map((item) => {
        const product = byId.get(item.productId)!;
        const unitPrice = item.unitPrice ?? Number(product.sellingPrice);
        const gross = round2(unitPrice * item.quantity);
        const net = round2(Math.max(0, gross - item.discount));
        const taxRate = item.taxRate ?? Number(product.taxRate ?? 0);
        const tax = round2((net * taxRate) / 100);

        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unitPrice,
          discount: item.discount,
          tax,
          subtotal: net,
          total: round2(net + tax),
        };
      });

      // Totals are derived here and nowhere else. Anything the client sent
      // for subtotal/tax/total is ignored — a receipt that disagrees with its
      // own line items is worse than no receipt.
      const subtotal = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));
      const tax = round2(lines.reduce((sum, l) => sum + l.tax, 0));
      const total = round2(Math.max(0, subtotal + tax - input.discount));
      const paid = input.paid ?? total;
      const due = round2(Math.max(0, total - paid));

      const created = await tx.sale.create({
        data: {
          tenantId,
          invoiceNo: await nextInvoiceNo(tx, tenantId),
          customerName: input.customerName ?? null,
          items: lines.length,
          subtotal,
          tax,
          discount: input.discount,
          total,
          paid,
          due,
          paymentMethod: input.paymentMethod,
          status: due > 0 ? "partial" : "completed",
          branch: input.branch ?? null,
          notes: input.notes ?? null,
          userId: req.user!.id,
          saleItems: {
            create: lines.map((line) => ({ tenantId, ...line })),
          },
        },
        include: { saleItems: true },
      });

      /*
       * Stock comes off inside the same transaction, one locked product at a
       * time. If any line has insufficient stock the whole sale rolls back —
       * no half-sold basket, no partially decremented inventory.
       */
      for (const line of lines) {
        await applyStockMovement(tx, {
          tenantId,
          productId: line.productId,
          delta: -line.quantity,
          reason: "sale",
          referenceType: "sale",
          referenceId: created.id,
          userId: req.user!.id,
        });
      }

      return created;
    });

    sendSuccess(res, { messageKey: "sales.created", data: toSnakeCase(sale), status: 201 });
  })
);
