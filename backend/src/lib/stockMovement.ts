import { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "./httpError";

/**
 * The single primitive every stock-mutating flow must use — POS checkout,
 * purchase receiving, adjustments, counts, transfers, refunds — instead of
 * hand-rolling a read-then-write against Product.stock.
 *
 * Why it exists: read-then-write is a lost-update race. Two cashiers sell the
 * last unit at the same moment, both read stock = 1, both compute 0, both
 * write 0, and the shop has sold two of something it had one of. The fix is
 * not to check more carefully — it is to make the read hold a lock until the
 * write commits.
 *
 * `SELECT ... FOR UPDATE` is issued through $queryRaw because Prisma's
 * high-level API does not expose row locks. It only means anything inside a
 * transaction, which is why this takes a transaction client rather than
 * opening its own: the caller is writing a sale and its line items in the
 * same atomic unit, and a lock taken in a different transaction would protect
 * nothing.
 */

export type StockMovementReason =
  | "sale"
  | "purchase_receive"
  | "adjustment"
  | "stock_count"
  | "transfer_out"
  | "transfer_in"
  | "refund";

export type ApplyStockMovementInput = {
  tenantId: string;
  productId: string;
  /** Positive = stock in (purchase, transfer-in, refund). Negative = stock out (sale). */
  delta: number;
  reason: StockMovementReason;
  referenceType?: string;
  referenceId?: string;
  userId?: string | null;
  notes?: string;
  /**
   * Allow the result to go below zero. Off by default — overselling is a
   * real-world error, not a rounding detail. Stock counts legitimately need
   * it, since a count asserts what is actually on the shelf rather than
   * applying a delta.
   */
  allowNegative?: boolean;
};

export type ApplyStockMovementResult = {
  stockBefore: number;
  stockAfter: number;
};

/** Any Prisma client inside an interactive transaction. */
export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function applyStockMovement(
  tx: TransactionClient,
  input: ApplyStockMovementInput
): Promise<ApplyStockMovementResult> {
  const { tenantId, productId, delta, reason } = input;

  /*
   * The lock is the whole point. FOR UPDATE holds this row against any other
   * transaction until ours commits, so a concurrent sale of the same product
   * blocks here instead of reading a value that is about to be stale.
   *
   * Filtering on tenant_id inside the raw SQL matters: this is one of the few
   * places that bypasses the scoped client, so isolation has to be written
   * out by hand rather than inherited.
   */
  const locked = await tx.$queryRaw<{ stock_quantity: number; name: string; min_stock_level: number }[]>(
    Prisma.sql`
      SELECT stock_quantity, name, min_stock_level
      FROM products
      WHERE id = ${productId} AND tenant_id = ${tenantId}
      FOR UPDATE
    `
  );

  if (locked.length === 0) {
    throw HttpError.badRequest("sales.unknownProduct", {
      code: "unknown_product",
      details: { productId },
    });
  }

  const { name, min_stock_level: threshold } = locked[0];
  const stockBefore = Number(locked[0].stock_quantity);
  const stockAfter = stockBefore + delta;

  if (stockAfter < 0 && !input.allowNegative) {
    throw HttpError.conflict("sales.insufficientStock", {
      code: "insufficient_stock",
      params: { product: name, available: stockBefore, requested: Math.abs(delta) },
      details: { productId, product: name, available: stockBefore, requested: Math.abs(delta) },
    });
  }

  // Both stock columns move together — see the Product model's comment on why
  // the legacy pair still exists. Status stays a function of quantity, by the
  // same rule the catalogue module applies on write, so it cannot disagree
  // depending on which path changed the stock.
  await tx.product.update({
    where: { id: productId },
    data: {
      stockQuantity: stockAfter,
      stock: stockAfter,
      status: derivedStatus(stockAfter, Number(threshold ?? 0)),
    },
  });

  await tx.stockMovement.create({
    data: {
      tenantId,
      productId,
      productName: name,
      movementType: reason,
      quantityChange: delta,
      stockBefore,
      stockAfter,
      reference: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes,
      userId: input.userId ?? undefined,
    },
  });

  return { stockBefore, stockAfter };
}

function derivedStatus(quantity: number, threshold: number): string {
  if (quantity <= 0) return "out_of_stock";
  if (threshold > 0 && quantity <= threshold) return "low_stock";
  return "active";
}
