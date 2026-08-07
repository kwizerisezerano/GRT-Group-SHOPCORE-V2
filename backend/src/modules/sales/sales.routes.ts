import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toSnakeCase } from "../../lib/caseMapping";
import {
  decryptNullable,
  encryptNullable,
  phoneBlindIndexNullable,
} from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import { applyStockMovement, type TransactionClient } from "../../lib/stockMovement";
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
  unitCost: money.optional(),
  discount: money.default(0),
  taxRate: z.number().min(0).max(100).optional(),
  batchId: z.string().uuid().optional().nullable(),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value));

const createSaleSchema = z.object({
  items: z.array(lineItemSchema).min(1, "A sale needs at least one item"),
  customerName: optionalText(191),
  customerPhone: optionalText(32),
  customerTin: optionalText(64),
  // Covers what the POS screen offers as well as the API's own vocabulary.
  // "mobile" and "mobile_money" are the same tender under two names.
  paymentMethod: z
    .enum(["cash", "mobile", "mobile_money", "card", "bank_transfer", "credit", "split", "layaway"])
    .default("cash"),
  momoNumber: optionalText(32),
  momoCode: optionalText(64),
  paid: money.optional(),
  discount: money.default(0),
  branch: optionalText(191),
  cashier: optionalText(191),
  receiptNo: optionalText(64),
  notes: optionalText(2000),
});

/** Rounds to 2dp using integer arithmetic, avoiding float drift on money. */
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Turns a stored sale into what the API is willing to say about it.
 *
 * Two jobs, both of them security rather than formatting. The encrypted
 * columns are decrypted back into the plain fields the client sent, so a
 * caller never has to know the storage shape. The blind-index hashes are
 * removed entirely: they are keyed fingerprints of a phone number, and
 * handing them out would let anyone with the list confirm whether a
 * particular number ever shopped here.
 */
function serializeSale<T extends Record<string, unknown>>(sale: T) {
  const {
    customerPhoneEncrypted,
    customerPhoneHash,
    customerTinEncrypted,
    momoNumberEncrypted,
    ...rest
  } = sale as T & {
    customerPhoneEncrypted?: string | null;
    customerPhoneHash?: string | null;
    customerTinEncrypted?: string | null;
    momoNumberEncrypted?: string | null;
  };

  return {
    ...rest,
    customerPhone: decryptNullable(customerPhoneEncrypted),
    customerTin: decryptNullable(customerTinEncrypted),
    momoNumber: decryptNullable(momoNumberEncrypted),
  };
}

/**
 * Invoice numbers are per tenant and sequential within a day, so two
 * businesses never collide and a cashier can read one aloud.
 *
 * This used to count today's sales and add one, which is correct only while
 * requests arrive one at a time. Under concurrency both readers see the same
 * count and both claim it: an integration test putting eight checkouts in
 * flight at once got five distinct numbers for eight sales. Two sales sharing
 * an invoice number is an accounting record that cannot be reconciled.
 *
 * A counter row replaces it. The upsert is a single atomic statement, and
 * LAST_INSERT_ID(expr) carries the new value back on the same connection —
 * which an interactive transaction guarantees is the one we are on. The row
 * lock is held until commit, so allocation is serial per tenant per day. That
 * is not a cost of this design, it is what "sequential" means; and because
 * the increment lives in the sale's own transaction, a rolled-back sale
 * returns its number and the sequence stays gapless.
 *
 * Allocating before any product lock also fixes the lock order for every
 * checkout — counter first, then products — which removes a class of deadlock
 * rather than leaving it to lib/transaction.ts to retry.
 */
async function nextInvoiceNo(tx: TransactionClient, tenantId: string) {
  const today = new Date();
  const stamp = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(
    today.getUTCDate()
  ).padStart(2, "0")}`;

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO invoice_counters (tenant_id, period, last_value)
    VALUES (${tenantId}, ${stamp}, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_value = LAST_INSERT_ID(last_value + 1)`);

  const [row] = await tx.$queryRaw<{ value: bigint | number }[]>(
    Prisma.sql`SELECT LAST_INSERT_ID() AS value`
  );

  return `INV-${stamp}-${String(Number(row.value)).padStart(4, "0")}`;
}

salesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const sales = await req.tenantPrisma!.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { saleItems: true },
    });

    sendSuccess(res, { messageKey: "sales.listed", data: toSnakeCase(sales.map(serializeSale)) });
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

    sendSuccess(res, { messageKey: "sales.fetched", data: toSnakeCase(serializeSale(sale)) });
  })
);

salesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    /*
     * Accept snake_case from the frontend, camelCase from scripts.
     *
     * Written out field by field rather than run through a generic converter
     * on purpose: this is the allow-list. Anything not named here cannot
     * reach the schema, so a client cannot post its own `total`, `status` or
     * `grossProfit` and have it believed. Every one of those is derived below
     * from the catalogue.
     */
    const body = req.body ?? {};
    const pick = (camel: string, snake: string) => body[camel] ?? body[snake];

    const input = createSaleSchema.parse({
      items: (body.items ?? []).map((item: Record<string, unknown>) => ({
        productId: item.productId ?? item.product_id,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? item.unit_price,
        unitCost: item.unitCost ?? item.unit_cost,
        discount: item.discount ?? 0,
        taxRate: item.taxRate ?? item.tax_rate,
        batchId: item.batchId ?? item.batch_id,
      })),
      customerName: pick("customerName", "customer_name"),
      customerPhone: pick("customerPhone", "customer_phone"),
      customerTin: pick("customerTin", "customer_tin"),
      paymentMethod: pick("paymentMethod", "payment_method") ?? "cash",
      momoNumber: pick("momoNumber", "momo_number"),
      momoCode: pick("momoCode", "momo_code"),
      paid: body.paid,
      discount: body.discount ?? 0,
      branch: body.branch,
      cashier: body.cashier,
      receiptNo: pick("receiptNo", "receipt_no"),
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

        // Cost falls back to the product's current cost price, then is frozen
        // onto the line: a later change to what the shop pays must not rewrite
        // the margin on sales already made.
        const unitCost = item.unitCost ?? Number(product.costPrice ?? 0);
        const costTotal = round2(unitCost * item.quantity);

        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unitPrice,
          unitCost,
          discount: item.discount,
          tax,
          subtotal: net,
          total: round2(net + tax),
          costTotal,
          grossProfit: round2(net - costTotal),
          batchId: item.batchId ?? null,
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
      // Overpayment is change owed, not a credit balance.
      const changeGiven = round2(Math.max(0, paid - total));
      const costTotal = round2(lines.reduce((sum, l) => sum + l.costTotal, 0));
      const grossProfit = round2(subtotal - costTotal);

      // Allocated after validation — a request naming a product that does not
      // exist should not take the counter lock — but before any product lock,
      // so every checkout takes its locks in the same order.
      const invoiceNo = await nextInvoiceNo(tx, tenantId);

      const created = await tx.sale.create({
        data: {
          tenantId,
          invoiceNo,
          receiptNo: input.receiptNo ?? null,
          customerName: input.customerName ?? null,
          customerPhoneEncrypted: encryptNullable(input.customerPhone),
          customerPhoneHash: phoneBlindIndexNullable(input.customerPhone),
          customerTinEncrypted: encryptNullable(input.customerTin),
          items: lines.length,
          subtotal,
          tax,
          discount: input.discount,
          total,
          paid,
          due,
          changeGiven,
          costTotal,
          grossProfit,
          paymentMethod: input.paymentMethod,
          momoNumberEncrypted: encryptNullable(input.momoNumber),
          momoCode: input.momoCode ?? null,
          status: due > 0 ? "partial" : "completed",
          branch: input.branch ?? null,
          cashier: input.cashier ?? null,
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

    sendSuccess(res, {
      messageKey: "sales.created",
      data: toSnakeCase(serializeSale(sale)),
      status: 201,
    });
  })
);
