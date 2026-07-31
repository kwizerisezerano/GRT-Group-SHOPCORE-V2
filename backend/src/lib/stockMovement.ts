import type { ScopedPrismaClient } from "./tenantScope";

export type StockMovementBatchStrategy = "fifo" | "none";

export type ApplyStockMovementInput = {
  tenantId: string;
  productId: string;
  /** Branch/warehouse the stock lives at, once per-location ledgers land. */
  locationId?: string | null;
  /** Positive = stock in (purchase/transfer-in), negative = stock out (sale/transfer-out). */
  delta: number;
  batchStrategy?: StockMovementBatchStrategy;
  reason: "sale" | "purchase_receive" | "adjustment" | "stock_count" | "transfer_out" | "transfer_in" | "refund";
  referenceType?: string;
  referenceId?: string;
  unitCost?: number;
  unitPrice?: number;
  notes?: string;
};

export type ApplyStockMovementResult = {
  stockBefore: number;
  stockAfter: number;
};

/**
 * The single primitive every stock-mutating flow (POS checkout, purchase
 * receiving, adjustments, counts, transfers, refunds) must call instead of
 * hand-rolling its own read-then-write against Product.stock/StockBatch.
 * That hand-rolled pattern is the root cause of the POS oversell race and
 * four other non-atomic bugs documented in the migration plan.
 *
 * Deliberately unimplemented for now: a correct implementation needs (a) a
 * locked read (`SELECT ... FOR UPDATE` via `$queryRaw`, since Prisma's
 * high-level API doesn't expose row locks) inside a `$transaction`, (b) the
 * redesigned StockMovement model (tenantId + real Product FK + locationId),
 * and (c) the StockBatch model for FIFO costing - none of which exist yet.
 * Defining the call signature now, before any of the five call sites are
 * built, means they all agree on the contract instead of five slightly
 * different ad hoc versions emerging and needing to be reconciled later.
 */
export async function applyStockMovement(
  _tx: ScopedPrismaClient,
  _input: ApplyStockMovementInput
): Promise<ApplyStockMovementResult> {
  throw new Error(
    "applyStockMovement is not implemented yet - it lands with the Product catalog + StockBatch models."
  );
}
