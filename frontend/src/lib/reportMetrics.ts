/**
 * The arithmetic behind every report.
 *
 * Lifted out of the Reports page unchanged, because it is the part that is
 * genuinely hard and genuinely load-bearing: what counts as a sale once it has
 * been partly refunded, which records are local-only and must not be
 * double-counted, how a cost total is recovered when the line items do not
 * carry one, and which of the six date fields a row might have is the one that
 * actually happened.
 *
 * The page that used to hold all of this was three thousand lines, so redoing
 * its layout meant risking the maths. Now the maths lives here, on its own,
 * and the page is only a presentation of it.
 */

import { format, isWithinInterval } from "date-fns";

export function safeNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export function firstPositiveNumber(...values: any[]) {
  for (const value of values) {
    const n = safeNumber(value);
    if (n > 0) return n;
  }
  return 0;
}

export function getRecordDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value?: string | null) {
  const date = getRecordDate(value);
  if (!date) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(value?: string | null) {
  const date = getRecordDate(value);
  if (!date) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getSaleDate(sale: any) {
  return (
    sale.date ||
    sale.created_offline_at ||
    sale.updated_offline_at ||
    sale.created_at ||
    new Date().toISOString()
  );
}

export function getExpenseDate(expense: any) {
  return (
    expense.date ||
    expense.created_offline_at ||
    expense.updated_offline_at ||
    expense.created_at ||
    new Date().toISOString()
  );
}

export function getPurchaseDate(purchase: any) {
  return (
    purchase.date ||
    purchase.created_offline_at ||
    purchase.updated_offline_at ||
    purchase.created_at ||
    new Date().toISOString()
  );
}

export function isPendingSync(row: any) {
  const status = String(row?.sync_status || "").toLowerCase();
  return (
    String(row?.id || "").startsWith("offline-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    status.includes("pending")
  );
}

export function isDeletedRecord(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

export function isArchivedProduct(row: any) {
  const status = String(row?.status || "active").toLowerCase();
  return (
    isDeletedRecord(row) ||
    ["inactive", "archived", "deleted", "pending_delete", "discontinued"].includes(status) ||
    Boolean(row?.archived_at || row?.deleted_at)
  );
}

export function isApprovedExpense(row: any) {
  return !isDeletedRecord(row) && String(row?.status || "pending").toLowerCase() === "approved";
}

export function getExpenseAccountingLabel(row: any) {
  return isApprovedExpense(row) ? "Approved Accounting Expense" : "Excluded From P&L";
}

export function isRecordInside(
  value: string | null | undefined,
  interval: { start: Date; end: Date },
) {
  const date = getRecordDate(value);
  if (!date) return false;
  return isWithinInterval(date, interval);
}

export function isSameReportDay(value: string | null | undefined, day: Date) {
  const date = getRecordDate(value);
  if (!date) return false;
  return format(date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
}

export function getProductStock(product: any) {
  return Math.max(0, safeNumber(product?.stock ?? product?.stock_quantity));
}

export function getProductReorderLevel(product: any) {
  return Math.max(
    0,
    safeNumber(
      product?.min_stock ?? product?.min_stock_level ?? product?.reorder_level,
    ),
  );
}

export function getProductCost(product: any) {
  return safeNumber(
    product?.cost_price ?? product?.purchase_price ?? product?.unit_cost,
  );
}

export function getProductPrice(product: any) {
  return safeNumber(
    product?.selling_price ?? product?.price ?? product?.sale_price,
  );
}

export function getProductCategory(product: any) {
  return (
    product.category?.name ??
    product.category_name ??
    product.category ??
    "Uncategorized"
  );
}

export function getProductBrand(product: any) {
  return product.brand?.name ?? product.brand_name ?? product.brand ?? "-";
}

export function getSaleStatus(sale: any) {
  return String(sale?.status || sale?.refund_status || "").toLowerCase();
}

export function getSaleItemsArray(sale: any) {
  const candidates = [
    sale?.sale_items,
    sale?.saleItems,
    sale?.line_items,
    sale?.items_list,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (Array.isArray(sale?.items)) return sale.items;

  return [];
}

export function getSaleItemCount(sale: any) {
  const items = getSaleItemsArray(sale);
  if (items.length > 0) {
    const original = items.reduce(
      (sum: number, item: any) =>
        sum + safeNumber(item.quantity ?? item.qty ?? 0),
      0,
    );
    const refunded = items.reduce(
      (sum: number, item: any) =>
        sum +
        safeNumber(
          item.refunded_quantity ??
            item.qty_refunded ??
            item.refund_quantity ??
            item.returned_quantity ??
            0,
        ),
      0,
    );

    return {
      original,
      refunded,
      net: Math.max(0, original - refunded),
    };
  }

  const original = safeNumber(
    sale.items ?? sale.item_count ?? sale.total_items ?? 0,
  );
  const refunded = safeNumber(sale.refunded_items ?? sale.items_refunded ?? 0);

  return {
    original,
    refunded,
    net: Math.max(0, original - refunded),
  };
}

export function getSaleCostTotal(sale: any) {
  const items = getSaleItemsArray(sale);

  if (items.length > 0) {
    const itemCost = items.reduce((sum: number, item: any) => {
      const originalQty = safeNumber(item.quantity ?? item.qty ?? 0);
      const refundedQty = safeNumber(
        item.refunded_quantity ??
          item.qty_refunded ??
          item.refund_quantity ??
          item.returned_quantity ??
          0,
      );
      const netQty = Math.max(0, originalQty - refundedQty);
      const unitCost = safeNumber(
        item.unit_cost ?? item.cost_price ?? item.purchase_price ?? 0,
      );

      if (unitCost > 0) return sum + netQty * unitCost;

      const totalCost = safeNumber(item.cost_total ?? item.cogs_total ?? 0);
      if (totalCost > 0 && originalQty > 0)
        return sum + totalCost * (netQty / originalQty);

      return sum;
    }, 0);

    if (itemCost > 0) return itemCost;
  }

  const originalTotal = getSaleOriginalTotal(sale);
  const netTotal = getSaleTotal(sale);
  const ratio = originalTotal > 0 ? Math.min(netTotal / originalTotal, 1) : 1;

  const directCost = firstPositiveNumber(
    sale.cost_total,
    sale.cogs_total,
    sale.cost_of_goods_sold,
    sale.total_cost,
  );

  return directCost > 0 ? directCost * ratio : 0;
}

export function getSaleOriginalTotal(sale: any) {
  return firstPositiveNumber(
    sale.original_total,
    sale.total_before_refund,
    sale.gross_total,
    sale.total,
    sale.grand_total,
    sale.amount,
    sale.subtotal,
  );
}

export function getSaleRefundedTotal(sale: any) {
  const directRefund = firstPositiveNumber(
    sale.refunded_total,
    sale.refund_total,
    sale.refund_amount,
    sale.refunded_amount,
    sale.total_refunded,
    sale.amount_refunded,
  );

  if (directRefund > 0) return directRefund;

  const items = getSaleItemsArray(sale);

  if (items.length > 0) {
    return items.reduce((sum: number, item: any) => {
      const refundedQty = safeNumber(
        item.refunded_quantity ??
          item.qty_refunded ??
          item.refund_quantity ??
          item.returned_quantity,
      );

      const unitPrice = firstPositiveNumber(
        item.unit_price,
        item.price,
        item.selling_price,
        item.total && item.quantity
          ? safeNumber(item.total) / Math.max(safeNumber(item.quantity), 1)
          : 0,
      );

      return sum + refundedQty * unitPrice;
    }, 0);
  }

  return 0;
}

export function isSaleCancelledOrFullyRefunded(sale: any) {
  const status = getSaleStatus(sale);
  const originalTotal = getSaleOriginalTotal(sale);
  const refundedTotal = getSaleRefundedTotal(sale);

  return (
    status.includes("cancel") ||
    status.includes("void") ||
    status === "refunded" ||
    status === "fully_refunded" ||
    status === "full_refund" ||
    (originalTotal > 0 && refundedTotal >= originalTotal)
  );
}

export function getSaleTotal(sale: any) {
  const originalTotal = getSaleOriginalTotal(sale);

  if (isSaleCancelledOrFullyRefunded(sale)) return 0;

  const refundedTotal = getSaleRefundedTotal(sale);
  return Math.max(originalTotal - refundedTotal, 0);
}

export function getSaleGrossProfit(sale: any) {
  const netTotal = getSaleTotal(sale);
  if (netTotal <= 0) return 0;

  const costTotal = getSaleCostTotal(sale);
  if (costTotal > 0) return Math.max(netTotal - costTotal, 0);

  const originalTotal = getSaleOriginalTotal(sale);
  const refundRatio =
    originalTotal > 0 ? Math.min(netTotal / originalTotal, 1) : 1;

  const existingProfit = firstPositiveNumber(
    sale.profit,
    sale.gross_profit,
    sale.net_profit,
    sale.margin_amount,
  );

  if (existingProfit > 0) return Math.max(existingProfit * refundRatio, 0);

  return 0;
}

export function getDisplaySaleStatus(sale: any) {
  if (isSaleCancelledOrFullyRefunded(sale)) return "refunded";

  const refundedTotal = getSaleRefundedTotal(sale);
  if (refundedTotal > 0) return "partially_refunded";

  return sale.status || "completed";
}

export function buildPeriodSummary(
  sales: any[],
  expenses: any[],
  start: Date,
  end: Date,
) {
  const periodSales = sales.filter((sale) =>
    isRecordInside(getSaleDate(sale), { start, end }),
  );
  const periodExpenses = expenses.filter((expense) =>
    isApprovedExpense(expense) && isRecordInside(getExpenseDate(expense), { start, end }),
  );

  const salesTotal = periodSales.reduce(
    (sum, sale) => sum + getSaleTotal(sale),
    0,
  );
  const grossProfit = periodSales.reduce(
    (sum, sale) => sum + getSaleGrossProfit(sale),
    0,
  );
  const expenseTotal = periodExpenses.reduce(
    (sum, expense) => sum + safeNumber(expense.amount),
    0,
  );
  const netProfit = grossProfit - expenseTotal;

  return {
    sales: salesTotal,
    grossProfit,
    expenses: expenseTotal,
    profit: Math.max(netProfit, 0),
    loss: netProfit < 0 ? Math.abs(netProfit) : 0,
    netProfit,
    orders: periodSales.filter((sale) => getSaleTotal(sale) > 0).length,
  };
}

/**
 * A summary card on this page, which is the summary card on every page.
 *
 * This used to be its own implementation — icon on the right, value below,
 * a tinted card surface, its own tone table — so a figure on Reports and the
 * same figure on the Dashboard were two different objects that happened to
 * hold numbers. It is an adapter over StatCard now: the design system owns
 * the layout, the badge and the tones, and this only translates the props
 * the call sites already pass.
 */
