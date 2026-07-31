import {
  useSales,
  useSaleMutations,
  useExpenses,
  useProducts,
  type DbSale,
} from "@/hooks/useSupabaseData";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Receipt,
  Search,
  Plus,
  Eye,
  MoreHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Printer,
  Ban,
  RotateCcw,
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  ShieldCheck,
  BarChart3,
  ServerCog,
  QrCode,
  Send,
  DollarSign,
  CalendarDays,
  CreditCard,
  PackageX,
  Archive,
  CheckCircle2,
  Download,
  Wifi,
  WifiOff,
  Database,
  Target,
  Building2,
} from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  isOnline,
  isNetworkError,
  savePending,
  getCachedTable,
  saveCachedTable,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import {
  startOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";

const CONTROL_BLUE = "#2563eb";

const statusColors: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  cancelled: "bg-muted text-muted-foreground border-muted",
  refunded: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  partial_refunded: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  draft: "bg-secondary text-secondary-foreground border-secondary",
  credit: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  pending_sync: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

const ebmStatusColors: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  synced: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  pending_sync: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  failed: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  not_configured: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  not_synced: "bg-slate-500/10 text-slate-600 border-slate-500/30",
};

const paymentLabels: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  mobile: "Mobile Money",
  bank: "Bank",
  credit: "Credit",
};

const ebmLabels: Record<string, string> = {
  success: "Fiscalized",
  synced: "Synced",
  pending: "Pending",
  pending_sync: "Pending Sync",
  failed: "Failed",
  not_configured: "Not Configured",
  not_synced: "Not Synced",
};

const PAGE_SIZE = 10;
type SortKey = "invoice_no" | "customer_name" | "total" | "date" | "status";
type SalesViewMode = "active" | "credit" | "deleted" | "expired";

type SaleWithEBM = DbSale & {
  customer_tin?: string | null;
  ebm_status?: string | null;
  ebm_invoice_no?: string | null;
  ebm_receipt_no?: string | null;
  ebm_qr_code?: string | null;
  ebm_verification_code?: string | null;
  ebm_response?: any;
  ebm_synced_at?: string | null;
  profit?: number | null;
  gross_profit?: number | null;
  net_profit?: number | null;
  cost_total?: number | null;
  cogs_total?: number | null;
  cost_of_goods_sold?: number | null;
  total_cost?: number | null;
  receipt_no?: string | null;
};

type SaleItemRow = {
  id?: string;
  sale_id: string;
  tenant_id?: string | null;
  product_id: string | null;
  product_name: string | null;
  sku?: string | null;
  quantity: number;
  unit_price?: number | null;
  unit_cost?: number | null;
  total?: number | null;
  subtotal?: number | null;
  discount?: number | null;
  tax?: number | null;
  cost_total?: number | null;
  gross_profit?: number | null;
  refunded_quantity?: number | null;
  refund_status?: string | null;
  batch_id?: string | null;
};

function safeNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function firstPositiveNumber(...values: any[]) {
  for (const value of values) {
    const n = safeNumber(value);
    if (n > 0) return n;
  }
  return 0;
}

function getSaleDate(sale: SaleWithEBM) {
  return (
    sale.date ||
    sale.created_at ||
    (sale as any).created_offline_at ||
    new Date().toISOString()
  );
}

function getExpenseDate(expense: any) {
  return (
    expense.date ||
    expense.created_at ||
    expense.created_offline_at ||
    new Date().toISOString()
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeShort(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSaleTimestamp(sale: SaleWithEBM) {
  const date = new Date(getSaleDate(sale));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getBaseSaleTotal(sale: SaleWithEBM) {
  return firstPositiveNumber(
    sale.total,
    (sale as any).grand_total,
    (sale as any).amount,
    sale.subtotal,
  );
}

function hasFullyReversedStatus(sale: SaleWithEBM | null | undefined) {
  const status = String(sale?.status || "").toLowerCase();
  return ["cancelled", "refunded", "deleted", "void"].includes(status);
}

function looksFullyRefundedFromSavedFields(sale: SaleWithEBM) {
  if (hasFullyReversedStatus(sale)) return true;

  const status = String(sale.status || "").toLowerCase();
  const items = safeNumber(sale.items);
  const total = getBaseSaleTotal(sale);
  const refundTotal = firstPositiveNumber(
    (sale as any).refund_total,
    (sale as any).refunded_total,
    (sale as any).total_refunded,
  );

  if (status.includes("refund") && items <= 0) return true;
  if (refundTotal > 0 && total > 0 && refundTotal >= total) return true;

  return false;
}

function getSaleTotal(sale: SaleWithEBM) {
  if (looksFullyRefundedFromSavedFields(sale)) return 0;

  const total = getBaseSaleTotal(sale);
  const refundTotal = firstPositiveNumber(
    (sale as any).refund_total,
    (sale as any).refunded_total,
    (sale as any).total_refunded,
  );

  return Math.max(0, total - refundTotal);
}

function getSaleGrossProfit(sale: SaleWithEBM) {
  if (looksFullyRefundedFromSavedFields(sale)) return 0;

  const total = getSaleTotal(sale);
  if (total <= 0) return 0;

  const existingCost = firstPositiveNumber(
    sale.cost_total,
    sale.cogs_total,
    sale.cost_of_goods_sold,
    sale.total_cost,
  );

  if (existingCost > 0) return Math.max(0, total - existingCost);

  const existingProfit = firstPositiveNumber(
    sale.profit,
    sale.gross_profit,
    sale.net_profit,
    (sale as any).margin_amount,
  );

  if (existingProfit > 0) return Math.min(existingProfit, total);

  const lineItems = Array.isArray((sale as any).line_items)
    ? (sale as any).line_items
    : Array.isArray((sale as any).sale_items)
      ? (sale as any).sale_items
      : Array.isArray((sale as any).items_data)
        ? (sale as any).items_data
        : [];

  if (lineItems.length > 0) {
    const cogs = lineItems.reduce((sum: number, item: any) => {
      const soldQty = safeNumber(item.quantity || item.qty);
      const refundedQty = safeNumber(item.refunded_quantity || item.refund_qty);
      const netQty = Math.max(0, soldQty - refundedQty);
      const cost = firstPositiveNumber(
        item.unit_cost,
        item.cost_price,
        item.purchase_price,
      );
      return sum + netQty * cost;
    }, 0);

    if (cogs > 0) return Math.max(0, total - cogs);
  }

  return 0;
}

function filterByRange<T>(
  items: T[],
  start: Date,
  end: Date,
  getDate: (item: T) => string,
) {
  return items.filter((item) => {
    const d = new Date(getDate(item));
    return !Number.isNaN(d.getTime()) && isWithinInterval(d, { start, end });
  });
}

function isRevenueSale(sale: SaleWithEBM) {
  return getSaleTotal(sale) > 0 && !looksFullyRefundedFromSavedFields(sale);
}

function buildPeriodSummary(
  sales: SaleWithEBM[],
  expenses: any[],
  start: Date,
  end: Date,
) {
  const periodSales = filterByRange(sales, start, end, getSaleDate).filter(
    isRevenueSale,
  );
  const periodExpenses = filterByRange(expenses, start, end, getExpenseDate);

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
    orders: periodSales.length,
  };
}

function getEbmStatus(sale: SaleWithEBM) {
  const status = String(sale.ebm_status || "not_synced").toLowerCase();
  if (status === "submitted" || status === "fiscalized") return "success";
  if (status === "queued") return "pending_sync";
  return status;
}

function getEbmLabel(status: string) {
  return ebmLabels[status] || status.replace(/_/g, " ");
}

function getFiscalReceiptNumber(sale: SaleWithEBM) {
  return (
    sale.ebm_receipt_no ||
    sale.ebm_invoice_no ||
    sale.receipt_no ||
    sale.invoice_no ||
    "Not assigned"
  );
}

function canRetryEbmSubmission(sale: SaleWithEBM | null | undefined) {
  if (!sale) return false;
  const status = getEbmStatus(sale);
  const saleStatus = String(sale.status || "").toLowerCase();
  return (
    ["completed", "paid"].includes(saleStatus) &&
    !["success", "synced"].includes(status) &&
    !hasPendingSync(sale)
  );
}

function getPaymentLabel(method: string | null | undefined) {
  if (!method) return "Unknown";
  return paymentLabels[method] || method;
}

function getNetItemSummaryFromItems(items: SaleItemRow[] = []) {
  const original = items.reduce(
    (sum, item) => sum + safeNumber(item.quantity),
    0,
  );
  const refunded = items.reduce(
    (sum, item) => sum + safeNumber(item.refunded_quantity),
    0,
  );
  return {
    original,
    refunded,
    net: Math.max(0, original - refunded),
  };
}

function isCreditSale(sale: SaleWithEBM) {
  const status = String(sale.status || "").toLowerCase();
  const method = String(sale.payment_method || "").toLowerCase();

  if (["paid", "cancelled", "refunded", "deleted"].includes(status))
    return false;

  return safeNumber(sale.due) > 0 || method === "credit";
}

function isDeletedOrArchivedSale(sale: SaleWithEBM) {
  return ["cancelled", "refunded", "deleted"].includes(
    String(sale.status || "").toLowerCase(),
  );
}

function getProductExpiryDate(product: any) {
  return (
    product?.expiry_date ||
    product?.expires_at ||
    product?.expiration_date ||
    null
  );
}

function isExpiredProduct(product: any) {
  const value = getProductExpiryDate(product);
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < startOfDay(new Date()).getTime();
}

function isArchivedProduct(product: any) {
  const status = String(product?.status || "").toLowerCase();
  const syncStatus = String(product?.sync_status || "").toLowerCase();
  const operation = String(product?.operation || "").toLowerCase();
  return ["inactive", "archived", "deleted", "disabled", "void"].includes(status) || syncStatus === "pending_delete" || operation === "delete";
}

function getRestoredProductStatus(product: any, nextStock: number) {
  if (isArchivedProduct(product)) return String(product?.status || "inactive").toLowerCase();
  return nextStock <= 0 ? "out_of_stock" : "active";
}

function isOfflineSaleId(value: any) {
  return String(value || "").startsWith("offline-sale-");
}

function isUuid(value: any) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function hasPendingSync(value: any) {
  return (
    isOfflineSaleId(value?.id) ||
    String(value?.sync_status || "")
      .toLowerCase()
      .includes("pending") ||
    !!value?.created_offline_at ||
    !!value?.updated_offline_at ||
    !!value?.offline_id
  );
}

function getSaleStatus(sale: SaleWithEBM | null | undefined) {
  return String(sale?.status || "").toLowerCase();
}

function canModifySaleOfflineSafe(sale: SaleWithEBM | null | undefined) {
  const status = getSaleStatus(sale);
  return !["cancelled", "refunded", "deleted"].includes(status);
}

function canRefundSaleOfflineSafe(sale: SaleWithEBM | null | undefined) {
  return canModifySaleOfflineSafe(sale);
}

function canCancelSaleOfflineSafe(sale: SaleWithEBM | null | undefined) {
  return canModifySaleOfflineSafe(sale);
}

function normalizeOfflineSaleItems(sale: any): SaleItemRow[] {
  const rawItems =
    sale?.line_items || sale?.sale_items || sale?.items_data || [];

  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((item: any, index: number) => ({
    id:
      item.id ||
      item.sale_item_id ||
      `${sale?.id || "offline-sale"}-item-${index}`,
    sale_id: sale?.id,
    tenant_id: sale?.tenant_id || null,
    product_id: item.product_id || null,
    product_name: item.product_name || item.name || "Unknown Product",
    sku: item.sku || null,
    quantity: safeNumber(item.quantity || item.qty),
    unit_price: safeNumber(item.unit_price || item.price),
    unit_cost: safeNumber(item.unit_cost || item.cost_price),
    total: safeNumber(
      item.total ||
        safeNumber(item.unit_price || item.price) *
          safeNumber(item.quantity || item.qty),
    ),
    subtotal: safeNumber(
      item.subtotal ||
        safeNumber(item.unit_price || item.price) *
          safeNumber(item.quantity || item.qty),
    ),
    discount: safeNumber(item.discount),
    tax: safeNumber(item.tax),
    cost_total: safeNumber(
      item.cost_total ||
        safeNumber(item.unit_cost || item.cost_price) *
          safeNumber(item.quantity || item.qty),
    ),
    gross_profit: safeNumber(item.gross_profit),
    refunded_quantity: safeNumber(item.refunded_quantity),
    refund_status: item.refund_status || "none",
    batch_id: item.batch_id || null,
  }));
}

export default function Sales() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tenantId, session } = useAuth();
  const { data: sales = [], isLoading } = useSales();
  const { data: expenses = [] } = useExpenses();
  const { data: products = [] } = useProducts();
  const { update } = useSaleMutations();
  const canUseOnlineSupabase =
    isOnline() && !!session?.access_token && !isOfflineMode();

  const salesWithEbm = sales as SaleWithEBM[];

  const resolveOnlineSaleForAction = async (
    sale: SaleWithEBM,
  ): Promise<SaleWithEBM | null> => {
    if (!sale?.id) return null;
    if (!canUseOnlineSupabase) return sale;
    if (isUuid(sale.id) && !isOfflineSaleId(sale.id)) return sale;

    const invoiceNo = sale.invoice_no || sale.receipt_no;
    if (!invoiceNo || !tenantId) return null;

    const { data, error } = await (supabase as any)
      .from("sales")
      .select("*")
      .eq("tenant_id", sale.tenant_id || tenantId)
      .or(`invoice_no.eq.${invoiceNo},receipt_no.eq.${invoiceNo}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("Failed to resolve synced offline sale", error);
      return null;
    }

    return data
      ? ({ ...sale, ...data, offline_id: sale.id } as SaleWithEBM)
      : null;
  };

  const applyLocalSalePatch = async (
    saleId: string,
    patch: Partial<SaleWithEBM> & Record<string, any>,
  ) => {
    const applyPatch = (rows: any[] = []) =>
      rows.map((row) =>
        String(row?.id) === String(saleId) ? { ...row, ...patch } : row,
      );

    queryClient.setQueriesData({ queryKey: ["sales"] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return applyPatch(old);
    });

    const cachedSales = await getCachedTable("sales");
    if (Array.isArray(cachedSales) && cachedSales.length > 0) {
      await saveCachedTable("sales", applyPatch(cachedSales));
    }
  };

  const refreshLocalInventoryQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["stock_batches"] });
    queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const restoreStockInLocalCache = async (
    sale: SaleWithEBM,
    returnedItems: Array<{
      product_id?: string | null;
      product_name?: string | null;
      quantity: number;
      batch_id?: string | null;
    }>,
    movementType: "refund" | "partial_refund" | "sale_cancel",
  ) => {
    const validItems = returnedItems.filter(
      (item) => item.product_id && safeNumber(item.quantity) > 0,
    );

    if (!validItems.length) return;

    const cachedProducts = await getCachedTable("products");
    const nextProducts = (cachedProducts || []).map((product: any) => {
      const addQty = validItems
        .filter((item) => String(item.product_id) === String(product.id))
        .reduce((sum, item) => sum + safeNumber(item.quantity), 0);

      if (addQty <= 0) return product;

      const currentStock = safeNumber(product.stock ?? product.stock_quantity);
      const nextStock = currentStock + addQty;

      return {
        ...product,
        stock: nextStock,
        stock_quantity: nextStock,
        status: getRestoredProductStatus(product, nextStock),
        updated_offline_at: new Date().toISOString(),
      };
    });

    await saveCachedTable("products", nextProducts);

    queryClient.setQueriesData({ queryKey: ["products"] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((product: any) => {
        const addQty = validItems
          .filter((item) => String(item.product_id) === String(product.id))
          .reduce((sum, item) => sum + safeNumber(item.quantity), 0);

        if (addQty <= 0) return product;

        const currentStock = safeNumber(
          product.stock ?? product.stock_quantity,
        );
        const nextStock = currentStock + addQty;

        return {
          ...product,
          stock: nextStock,
          stock_quantity: nextStock,
          status: nextStock <= 0 ? "out_of_stock" : "active",
          updated_offline_at: new Date().toISOString(),
        };
      });
    });

    const cachedBatches = await getCachedTable("stock_batches");
    if (Array.isArray(cachedBatches) && cachedBatches.length > 0) {
      const nextBatches = cachedBatches.map((batch: any) => {
        const addQty = validItems
          .filter(
            (item) =>
              item.batch_id && String(item.batch_id) === String(batch.id),
          )
          .reduce((sum, item) => sum + safeNumber(item.quantity), 0);

        if (addQty <= 0) return batch;

        const currentRemaining = safeNumber(batch.quantity_remaining);
        const quantityIn = firstPositiveNumber(
          batch.quantity_in,
          batch.quantity,
          currentRemaining + addQty,
        );
        const nextRemaining = Math.min(quantityIn, currentRemaining + addQty);

        return {
          ...batch,
          quantity_remaining: nextRemaining,
          status: nextRemaining > 0 ? "active" : "depleted",
          updated_offline_at: new Date().toISOString(),
        };
      });

      await saveCachedTable("stock_batches", nextBatches);
    }

    const cachedMovements = await getCachedTable("stock_movements");
    const now = new Date().toISOString();
    const movementRows = validItems.map((item, index) => {
      const product = nextProducts.find(
        (p: any) => String(p.id) === String(item.product_id),
      );
      const stockAfter = safeNumber(product?.stock ?? product?.stock_quantity);
      const qty = safeNumber(item.quantity);
      return {
        id: `offline-movement-${Date.now()}-${index}`,
        tenant_id: sale.tenant_id || tenantId,
        user_id: user?.id || sale.user_id || null,
        product_id: item.product_id,
        product_name: item.product_name || product?.name || "Unknown Product",
        movement_type: movementType,
        quantity_change: qty,
        stock_before: Math.max(0, stockAfter - qty),
        stock_after: stockAfter,
        reference: sale.invoice_no || sale.receipt_no || sale.id,
        reference_id: sale.id,
        notes:
          movementType === "partial_refund"
            ? `Offline partial refund restored ${qty} item(s)`
            : movementType === "refund"
              ? `Offline full refund restored ${qty} item(s)`
              : `Offline cancelled sale restored ${qty} item(s)`,
        created_at: now,
        created_offline_at: now,
        sync_status: "pending",
      };
    });

    await saveCachedTable("stock_movements", [
      ...movementRows,
      ...(Array.isArray(cachedMovements) ? cachedMovements : []),
    ]);

    refreshLocalInventoryQueries();
  };

  const expiredProducts = useMemo(
    () => products.filter(isExpiredProduct),
    [products],
  );

  const creditSalesList = useMemo(
    () =>
      salesWithEbm
        .filter((sale) => isCreditSale(sale) && !isDeletedOrArchivedSale(sale))
        .sort((a, b) => getSaleTimestamp(b) - getSaleTimestamp(a)),
    [salesWithEbm],
  );

  const { data: saleItemsForSummary = [] } = useQuery({
    queryKey: [
      "sale_items_summary",
      tenantId,
      salesWithEbm.length,
      canUseOnlineSupabase ? "online" : "offline",
    ],
    enabled:
      !!user &&
      !!tenantId &&
      canUseOnlineSupabase &&
      salesWithEbm.some((sale) => sale.id && !isOfflineSaleId(sale.id)),
    retry: 0,
    refetchOnReconnect: canUseOnlineSupabase,
    refetchOnWindowFocus: canUseOnlineSupabase,
    queryFn: async () => {
      if (!canUseOnlineSupabase) return [] as SaleItemRow[];

      const saleIds = salesWithEbm
        .map((sale) => sale.id)
        .filter((id) => Boolean(id) && !isOfflineSaleId(id));
      if (!saleIds.length) return [] as SaleItemRow[];

      const { data, error } = await (supabase as any)
        .from("sale_items")
        .select(
          "id, sale_id, tenant_id, product_id, product_name, sku, quantity, unit_price, unit_cost, total, refunded_quantity, refund_status, batch_id",
        )
        .in("sale_id", saleIds);

      if (error) throw error;
      return (data || []) as SaleItemRow[];
    },
  });

  const saleItemSummaryBySale = useMemo(() => {
    const map = new Map<
      string,
      { original: number; refunded: number; net: number }
    >();

    for (const item of saleItemsForSummary) {
      const saleId = item.sale_id;
      const current = map.get(saleId) || { original: 0, refunded: 0, net: 0 };
      current.original += safeNumber(item.quantity);
      current.refunded += safeNumber(item.refunded_quantity);
      current.net = Math.max(0, current.original - current.refunded);
      map.set(saleId, current);
    }

    return map;
  }, [saleItemsForSummary]);

  const getSaleItemSummary = (sale: SaleWithEBM) => {
    const summary = saleItemSummaryBySale.get(sale.id);
    if (summary) return summary;

    const offlineItems = normalizeOfflineSaleItems(sale);
    if (offlineItems.length > 0)
      return getNetItemSummaryFromItems(offlineItems);

    return {
      original: safeNumber(sale.items),
      refunded: 0,
      net: safeNumber(sale.items),
    };
  };

  const isFullyRefundedSale = (sale: SaleWithEBM) => {
    const status = String(sale.status || "").toLowerCase();
    if (status === "refunded") return true;

    const summary = getSaleItemSummary(sale);
    return (
      summary.original > 0 &&
      summary.refunded >= summary.original &&
      summary.net <= 0
    );
  };

  const isArchivedSale = (sale: SaleWithEBM) => {
    const status = String(sale.status || "").toLowerCase();
    return (
      ["cancelled", "refunded", "deleted"].includes(status) ||
      isFullyRefundedSale(sale)
    );
  };

  const getDisplaySaleStatus = (sale: SaleWithEBM) => {
    if (isFullyRefundedSale(sale)) return "refunded";
    if (hasPendingSync(sale) && !canUseOnlineSupabase) return "pending_sync";
    return String(sale.status || "unknown");
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [ebmFilter, setEbmFilter] = useState("all");
  const [viewMode, setViewMode] = useState<SalesViewMode>("active");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewSale, setViewSale] = useState<SaleWithEBM | null>(null);
  const [processingSaleId, setProcessingSaleId] = useState<string | null>(null);
  const [partialRefundSale, setPartialRefundSale] =
    useState<SaleWithEBM | null>(null);
  const [partialRefundItems, setPartialRefundItems] = useState<SaleItemRow[]>(
    [],
  );
  const [refundQuantities, setRefundQuantities] = useState<
    Record<string, number>
  >({});
  const [refundReason, setRefundReason] = useState("");
  const [loadingRefundItems, setLoadingRefundItems] = useState(false);

  const periodStats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return {
      today: buildPeriodSummary(salesWithEbm, expenses, todayStart, now),
      week: buildPeriodSummary(salesWithEbm, expenses, weekStart, weekEnd),
      month: buildPeriodSummary(salesWithEbm, expenses, monthStart, monthEnd),
    };
  }, [salesWithEbm, expenses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    const list = salesWithEbm.filter((s) => {
      const ebmStatus = getEbmStatus(s);
      const archived = isArchivedSale(s);
      const matchView =
        viewMode === "active"
          ? !archived && !isCreditSale(s)
          : viewMode === "credit"
            ? isCreditSale(s) && !archived
            : viewMode === "deleted"
              ? archived
              : true;

      const matchSearch =
        !q ||
        (s.invoice_no || "").toLowerCase().includes(q) ||
        (s.customer_name || "").toLowerCase().includes(q) ||
        (s.customer_tin || "").toLowerCase().includes(q) ||
        (s.ebm_invoice_no || "").toLowerCase().includes(q) ||
        (s.ebm_receipt_no || "").toLowerCase().includes(q) ||
        (s.cashier || "").toLowerCase().includes(q) ||
        (s.branch || "").toLowerCase().includes(q) ||
        formatDateTime(getSaleDate(s)).toLowerCase().includes(q);

      const displayStatus = getDisplaySaleStatus(s);
      const matchStatus =
        statusFilter === "all" ||
        displayStatus === statusFilter ||
        String(s.status || "").toLowerCase() === statusFilter;
      const matchPayment =
        paymentFilter === "all" || s.payment_method === paymentFilter;
      const matchEbm = ebmFilter === "all" || ebmStatus === ebmFilter;

      return (
        matchView && matchSearch && matchStatus && matchPayment && matchEbm
      );
    });

    list.sort((a, b) => {
      if (sortKey === "date") {
        return sortAsc
          ? getSaleTimestamp(a) - getSaleTimestamp(b)
          : getSaleTimestamp(b) - getSaleTimestamp(a);
      }

      const av = sortKey === "total" ? getSaleTotal(a) : (a as any)[sortKey];
      const bv = sortKey === "total" ? getSaleTotal(b) : (b as any)[sortKey];

      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      return sortAsc
        ? Number(av || 0) - Number(bv || 0)
        : Number(bv || 0) - Number(av || 0);
    });

    return list;
  }, [
    salesWithEbm,
    search,
    statusFilter,
    paymentFilter,
    ebmFilter,
    viewMode,
    sortKey,
    sortAsc,
    saleItemSummaryBySale,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(
    () => ({
      totalRevenue: salesWithEbm
        .filter(isRevenueSale)
        .reduce((sum, i) => sum + getSaleTotal(i), 0),
      totalSales: salesWithEbm.length,
      completed: salesWithEbm.filter((s) =>
        ["completed", "paid"].includes(String(s.status || "").toLowerCase()),
      ).length,
      refunded: salesWithEbm.filter(isFullyRefundedSale).length,
      cancelled: salesWithEbm.filter((s) => s.status === "cancelled").length,
      outstanding: salesWithEbm
        .filter(isRevenueSale)
        .reduce((sum, i) => sum + Number(i.due || 0), 0),
      paid: salesWithEbm
        .filter(isRevenueSale)
        .reduce((sum, i) => sum + Number(i.paid || 0), 0),
      filtered: filtered.length,
      ebmSuccess: salesWithEbm.filter((s) => getEbmStatus(s) === "success")
        .length,
      ebmSynced: salesWithEbm.filter((s) => getEbmStatus(s) === "synced")
        .length,
      ebmPending: salesWithEbm.filter((s) => ["pending", "pending_sync"].includes(getEbmStatus(s)))
        .length,
      ebmNotConfigured: salesWithEbm.filter((s) => getEbmStatus(s) === "not_configured")
        .length,
      ebmNotSynced: salesWithEbm.filter((s) => getEbmStatus(s) === "not_synced")
        .length,
      ebmFailed: salesWithEbm.filter((s) => getEbmStatus(s) === "failed")
        .length,
      creditSales: creditSalesList.length,
      creditBalance: creditSalesList.reduce(
        (sum, s) => sum + safeNumber(s.due),
        0,
      ),
      deletedSales: salesWithEbm.filter(isArchivedSale).length,
      expiredProducts: expiredProducts.length,
    }),
    [
      salesWithEbm,
      filtered.length,
      expiredProducts.length,
      creditSalesList,
      saleItemSummaryBySale,
    ],
  );

  const analytics = useMemo(() => {
    const revenueSales = salesWithEbm.filter(isRevenueSale);
    const totalRevenue = revenueSales.reduce(
      (sum, sale) => sum + getSaleTotal(sale),
      0,
    );
    const totalGrossProfit = revenueSales.reduce(
      (sum, sale) => sum + getSaleGrossProfit(sale),
      0,
    );
    const avgOrderValue = revenueSales.length
      ? totalRevenue / revenueSales.length
      : 0;
    const profitMargin =
      totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const syncReady = salesWithEbm.length
      ? Math.round(((stats.ebmSynced + stats.ebmSuccess) / salesWithEbm.length) * 100)
      : 0;
    const collectionRate =
      stats.paid + stats.outstanding > 0
        ? Math.round((stats.paid / (stats.paid + stats.outstanding)) * 100)
        : 100;
    const offlinePending = salesWithEbm.filter(hasPendingSync).length;

    const paymentMix = ["cash", "mobile", "card", "bank", "credit"].map(
      (method) => {
        const value = revenueSales
          .filter(
            (sale) =>
              String(sale.payment_method || "").toLowerCase() === method,
          )
          .reduce((sum, sale) => sum + getSaleTotal(sale), 0);
        return {
          method,
          label: getPaymentLabel(method),
          value,
          percent:
            totalRevenue > 0 ? Math.round((value / totalRevenue) * 100) : 0,
        };
      },
    );

    const timeline = [
      {
        label: "Today",
        value: periodStats.today.sales,
        profit: periodStats.today.profit,
      },
      {
        label: "This Week",
        value: periodStats.week.sales,
        profit: periodStats.week.profit,
      },
      {
        label: "This Month",
        value: periodStats.month.sales,
        profit: periodStats.month.profit,
      },
    ];

    const cashierMap = new Map<string, { cashier: string; revenue: number; profit: number; orders: number }>();
    const branchMap = new Map<string, { branch: string; revenue: number; profit: number; orders: number }>();

    revenueSales.forEach((sale) => {
      const cashier = String(sale.cashier || "Unassigned Cashier");
      const branch = String(sale.branch || "Main Branch");
      const revenue = getSaleTotal(sale);
      const profit = getSaleGrossProfit(sale);

      const cashierRow = cashierMap.get(cashier) || { cashier, revenue: 0, profit: 0, orders: 0 };
      cashierRow.revenue += revenue;
      cashierRow.profit += profit;
      cashierRow.orders += 1;
      cashierMap.set(cashier, cashierRow);

      const branchRow = branchMap.get(branch) || { branch, revenue: 0, profit: 0, orders: 0 };
      branchRow.revenue += revenue;
      branchRow.profit += profit;
      branchRow.orders += 1;
      branchMap.set(branch, branchRow);
    });

    const cashierPerformance = Array.from(cashierMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const branchPerformance = Array.from(branchMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      avgOrderValue,
      profitMargin,
      syncReady,
      collectionRate,
      offlinePending,
      paymentMix,
      timeline,
      cashierPerformance,
      branchPerformance,
    };
  }, [
    salesWithEbm,
    stats.ebmSynced,
    stats.paid,
    stats.outstanding,
    periodStats,
  ]);

  const exportRows = filtered.map((s) => ({
    invoice_no: s.invoice_no || "",
    customer_name: s.customer_name || "",
    customer_tin: s.customer_tin || "",
    ebm_status: getEbmLabel(getEbmStatus(s)),
    ebm_invoice_no: s.ebm_invoice_no || "",
    original_items: getSaleItemSummary(s).original,
    refunded_items: getSaleItemSummary(s).refunded,
    net_items: getSaleItemSummary(s).net,
    subtotal: formatCurrency(Number(s.subtotal ?? 0)),
    tax: formatCurrency(Number(s.tax ?? 0)),
    discount: formatCurrency(Number(s.discount ?? 0)),
    total: formatCurrency(getSaleTotal(s)),
    gross_profit: formatCurrency(getSaleGrossProfit(s)),
    paid: formatCurrency(Number(s.paid ?? 0)),
    due: formatCurrency(Number(s.due ?? 0)),
    payment_method: getPaymentLabel(s.payment_method),
    status: getDisplaySaleStatus(s),
    branch: s.branch || "",
    cashier: s.cashier || "",
    date: formatDateTime(getSaleDate(s)),
  }));

  const exportCols = [
    { key: "invoice_no" as const, label: "Invoice" },
    { key: "customer_name" as const, label: "Customer" },
    { key: "customer_tin" as const, label: "Customer TIN" },
    { key: "ebm_status" as const, label: "EBM Status" },
    { key: "ebm_invoice_no" as const, label: "EBM Invoice" },
    { key: "original_items" as const, label: "Original Items" },
    { key: "refunded_items" as const, label: "Refunded Items" },
    { key: "net_items" as const, label: "Net Items" },
    { key: "subtotal" as const, label: "Subtotal" },
    { key: "tax" as const, label: "Tax" },
    { key: "discount" as const, label: "Discount" },
    { key: "total" as const, label: "Total" },
    { key: "gross_profit" as const, label: "Gross Profit" },
    { key: "paid" as const, label: "Paid" },
    { key: "due" as const, label: "Due" },
    { key: "payment_method" as const, label: "Payment" },
    { key: "status" as const, label: "Status" },
    { key: "branch" as const, label: "Branch" },
    { key: "cashier" as const, label: "Cashier" },
    { key: "date" as const, label: "Date" },
  ];

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({
    label,
    sortKeyName,
  }: {
    label: string;
    sortKeyName: SortKey;
  }) => (
    <button
      onClick={() => toggleSort(sortKeyName)}
      className="flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  const loadSaleItems = async (saleId: string): Promise<SaleItemRow[]> => {
    const saleFromState = salesWithEbm.find(
      (sale) => String(sale.id) === String(saleId),
    ) as any;

    if (isOfflineSaleId(saleId) && canUseOnlineSupabase && saleFromState) {
      const resolvedSale = await resolveOnlineSaleForAction(saleFromState);
      if (resolvedSale?.id && !isOfflineSaleId(resolvedSale.id)) {
        const { data, error } = await (supabase as any)
          .from("sale_items")
          .select(
            "id, sale_id, tenant_id, product_id, product_name, sku, quantity, unit_price, unit_cost, total, subtotal, discount, tax, cost_total, gross_profit, refunded_quantity, refund_status, batch_id",
          )
          .eq("sale_id", resolvedSale.id);

        if (!error && Array.isArray(data) && data.length > 0)
          return data as SaleItemRow[];
      }
    }

    if (isOfflineSaleId(saleId)) {
      const stateItems = normalizeOfflineSaleItems(saleFromState);
      if (stateItems.length > 0) return stateItems;

      const cachedSales = await getCachedTable("sales");
      const cachedSale = (cachedSales || []).find(
        (sale: any) => String(sale.id) === String(saleId),
      );
      return normalizeOfflineSaleItems(cachedSale);
    }

    if (!canUseOnlineSupabase) {
      const cachedSales = await getCachedTable("sales");
      const cachedSale = (cachedSales || []).find(
        (sale: any) => String(sale.id) === String(saleId),
      );
      const cachedItems = normalizeOfflineSaleItems(cachedSale);
      if (cachedItems.length > 0) return cachedItems;
      return [];
    }

    const { data, error } = await (supabase as any)
      .from("sale_items")
      .select(
        "id, sale_id, tenant_id, product_id, product_name, sku, quantity, unit_price, unit_cost, total, subtotal, discount, tax, cost_total, gross_profit, refunded_quantity, refund_status, batch_id",
      )
      .eq("sale_id", saleId);

    if (error) throw error;

    return (data || []) as SaleItemRow[];
  };

  const refreshSalesRelatedQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] }),
      queryClient.invalidateQueries({ queryKey: ["stock_batches"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);
  };

  const restoreBatchQuantity = async (
    batchId: string | null | undefined,
    quantity: number,
  ) => {
    if (!batchId || quantity <= 0) return;

    const { data: batch, error: batchError } = await (supabase as any)
      .from("stock_batches")
      .select("id, quantity_remaining, quantity_in")
      .eq("id", batchId)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) return;

    const currentRemaining = safeNumber(batch.quantity_remaining);
    const quantityIn = safeNumber(batch.quantity_in);
    const nextRemaining = Math.min(quantityIn, currentRemaining + quantity);

    const { error: batchUpdateError } = await (supabase as any)
      .from("stock_batches")
      .update({
        quantity_remaining: nextRemaining,
        status: nextRemaining > 0 ? "active" : "depleted",
      })
      .eq("id", batchId);

    if (batchUpdateError) throw batchUpdateError;
  };

  const reverseSaleStock = async (
    sale: SaleWithEBM,
    nextStatus: "cancelled" | "refunded",
  ) => {
    if (!sale?.id) throw new Error("Sale ID is missing");

    if (
      ["cancelled", "refunded"].includes(
        String(sale.status || "").toLowerCase(),
      )
    ) {
      toast.info("This sale has already been fully reversed.");
      return;
    }

    const saleItems = await loadSaleItems(sale.id);

    if (!saleItems.length) {
      await update.mutateAsync({ id: sale.id, status: nextStatus } as any);
      toast.warning(
        "Sale status updated, but no sale item rows were found for stock reversal.",
      );
      return;
    }

    for (const item of saleItems) {
      if (!item.product_id) continue;

      const soldQuantity = safeNumber(item.quantity);
      const alreadyRefunded = safeNumber(item.refunded_quantity);
      const quantity = Math.max(0, soldQuantity - alreadyRefunded);
      if (quantity <= 0) continue;

      const { data: product, error: productError } = await (supabase as any)
        .from("products")
        .select("id, stock, stock_quantity, status, name")
        .eq("id", item.product_id)
        .eq("tenant_id", sale.tenant_id || tenantId)
        .maybeSingle();

      if (productError) throw productError;
      if (!product) continue;

      const currentStock = Number(product.stock ?? product.stock_quantity ?? 0);
      const newStock = currentStock + quantity;

      const { error: stockError } = await (supabase as any)
        .from("products")
        .update({
          stock: newStock,
          stock_quantity: newStock,
          status: getRestoredProductStatus(product, newStock),
        })
        .eq("id", item.product_id)
        .eq("tenant_id", sale.tenant_id || tenantId);

      if (stockError) throw stockError;

      await restoreBatchQuantity(item.batch_id, quantity);

      const { error: itemUpdateError } = await (supabase as any)
        .from("sale_items")
        .update({
          refunded_quantity: soldQuantity,
          refund_status: "refunded",
        })
        .eq("id", item.id);

      if (itemUpdateError) throw itemUpdateError;

      const { error: movementError } = await (supabase as any)
        .from("stock_movements")
        .insert({
          tenant_id: sale.tenant_id || tenantId,
          user_id: user?.id || sale.user_id || null,
          product_id: item.product_id,
          product_name: item.product_name || product.name || "Unknown Product",
          movement_type: nextStatus === "refunded" ? "refund" : "sale_cancel",
          quantity_change: quantity,
          stock_before: currentStock,
          stock_after: newStock,
          reference: sale.invoice_no || sale.receipt_no || sale.id,
          reference_id: sale.id,
          notes:
            nextStatus === "refunded"
              ? `Full refund restored ${quantity} item(s) for sale ${sale.invoice_no || sale.id}`
              : `Cancelled sale restored ${quantity} item(s) for sale ${sale.invoice_no || sale.id}`,
        });

      if (movementError) throw movementError;
    }

    await update.mutateAsync({
      id: sale.id,
      status: nextStatus,
      items: 0,
      subtotal: 0,
      total: 0,
      paid: 0,
      due: 0,
      cost_total: 0,
      cogs_total: 0,
      gross_profit: 0,
      profit: 0,
      net_profit: 0,
    } as any);

    await refreshSalesRelatedQueries();
  };

  const openPartialRefund = async (sale: SaleWithEBM) => {
    if (!sale?.id) return;

    try {
      setLoadingRefundItems(true);
      const items = await loadSaleItems(sale.id);
      const availableItems = items.filter(
        (item) =>
          safeNumber(item.quantity) - safeNumber(item.refunded_quantity) > 0,
      );

      if (!availableItems.length) {
        toast.info("There are no refundable items left on this sale.");
        return;
      }

      const defaults: Record<string, number> = {};
      availableItems.forEach((item) => {
        if (item.id) defaults[item.id] = 0;
      });

      setPartialRefundSale(sale);
      setPartialRefundItems(availableItems);
      setRefundQuantities(defaults);
      setRefundReason("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to load sale items");
    } finally {
      setLoadingRefundItems(false);
    }
  };

  const closePartialRefund = () => {
    setPartialRefundSale(null);
    setPartialRefundItems([]);
    setRefundQuantities({});
    setRefundReason("");
  };

  const refundableQuantity = (item: SaleItemRow) =>
    Math.max(0, safeNumber(item.quantity) - safeNumber(item.refunded_quantity));

  const selectedRefundLines = () =>
    partialRefundItems
      .map((item) => {
        const id = item.id || "";
        const maxQty = refundableQuantity(item);
        const qty = Math.max(
          0,
          Math.min(maxQty, safeNumber(refundQuantities[id])),
        );
        const unitPrice = safeNumber(item.unit_price);
        const unitCost = safeNumber(item.unit_cost);
        return {
          item,
          quantity: qty,
          unitPrice,
          unitCost,
          total: qty * unitPrice,
          costTotal: qty * unitCost,
        };
      })
      .filter((line) => line.quantity > 0);

  const queuePartialRefundOffline = async (
    sale: SaleWithEBM,
    lines: ReturnType<typeof selectedRefundLines>,
    refundNo: string,
    refundTotal: number,
    refundCostTotal: number,
  ) => {
    if (!tenantId) throw new Error("No active workspace");

    const offlineRefundLines = lines.map((line) => ({
      sale_item_id: line.item.id,
      product_id: line.item.product_id,
      product_name: line.item.product_name,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      unit_cost: line.unitCost,
      total: line.total,
      batch_id: line.item.batch_id || null,
    }));

    const existingItems = await loadSaleItems(sale.id);
    const itemRefundMap = new Map<string, number>();
    for (const line of lines) {
      if (line.item.id) itemRefundMap.set(line.item.id, line.quantity);
    }

    const locallyUpdatedItems = existingItems.map((item) => {
      const addQty = item.id ? safeNumber(itemRefundMap.get(item.id)) : 0;
      const nextRefunded = safeNumber(item.refunded_quantity) + addQty;
      return {
        ...item,
        refunded_quantity: nextRefunded,
        refund_status:
          nextRefunded >= safeNumber(item.quantity)
            ? "refunded"
            : nextRefunded > 0
              ? "partial_refunded"
              : item.refund_status,
      };
    });

    const allFullyRefunded =
      locallyUpdatedItems.length > 0 &&
      locallyUpdatedItems.every(
        (item) =>
          safeNumber(item.refunded_quantity) >= safeNumber(item.quantity),
      );
    const nextItemSummary = getNetItemSummaryFromItems(locallyUpdatedItems);
    const nextSubtotal = Math.max(0, safeNumber(sale.subtotal) - refundTotal);
    const nextTotal = Math.max(0, getSaleTotal(sale) - refundTotal);
    const nextPaid = Math.max(0, safeNumber(sale.paid) - refundTotal);
    const nextCostTotal = Math.max(
      0,
      firstPositiveNumber(sale.cost_total, sale.cogs_total) - refundCostTotal,
    );
    const nextProfit = Math.max(0, nextTotal - nextCostTotal);

    const localPatch: any = {
      id: sale.id,
      status: allFullyRefunded ? "refunded" : "partial_refunded",
      items: nextItemSummary.net,
      subtotal: nextSubtotal,
      total: nextTotal,
      paid: nextPaid,
      due: Math.max(0, safeNumber(sale.due)),
      cost_total: nextCostTotal,
      cogs_total: nextCostTotal,
      gross_profit: nextProfit,
      profit: nextProfit,
      net_profit: nextProfit,
      partial_refund_on_sync: true,
      partial_refund_items: offlineRefundLines,
      restore_stock_items: offlineRefundLines,
      refund_no: refundNo,
      refund_reason: refundReason.trim() || null,
      sale_items: locallyUpdatedItems,
      line_items: locallyUpdatedItems,
    };

    await restoreStockInLocalCache(
      sale,
      offlineRefundLines.map((line) => ({
        product_id: line.product_id,
        product_name: line.product_name,
        quantity: line.quantity,
        batch_id: line.batch_id,
      })),
      "partial_refund",
    );

    await savePending("sales", {
      ...localPatch,
      tenant_id: sale.tenant_id || tenantId,
      invoice_no: sale.invoice_no,
      receipt_no: sale.receipt_no,
      operation: "update",
      user_id: user?.id || sale.user_id || null,
      sync_status: "pending",
    });

    await applyLocalSalePatch(sale.id, localPatch);
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  };

  const submitPartialRefund = async () => {
    if (!partialRefundSale?.id) return;

    const lines = selectedRefundLines();
    if (!lines.length) {
      toast.error("Enter at least one quantity to refund.");
      return;
    }

    if (!tenantId) {
      toast.error("No active workspace");
      return;
    }

    const refundNo = `RF-${Date.now().toString().slice(-8)}`;
    const refundTotal = lines.reduce((sum, line) => sum + line.total, 0);
    const refundCostTotal = lines.reduce(
      (sum, line) => sum + line.costTotal,
      0,
    );

    try {
      setProcessingSaleId(partialRefundSale.id);

      if (!canUseOnlineSupabase) {
        await queuePartialRefundOffline(
          partialRefundSale,
          lines,
          refundNo,
          refundTotal,
          refundCostTotal,
        );
        toast.success(
          "Partial refund saved offline. It will sync when internet returns.",
        );
        closePartialRefund();
        setViewSale(null);
        return;
      }

      let saleForRefund = partialRefundSale;
      if (isOfflineSaleId(partialRefundSale.id)) {
        const resolvedSale =
          await resolveOnlineSaleForAction(partialRefundSale);
        if (!resolvedSale?.id || isOfflineSaleId(resolvedSale.id)) {
          await queuePartialRefundOffline(
            partialRefundSale,
            lines,
            refundNo,
            refundTotal,
            refundCostTotal,
          );
          toast.success(
            "Partial refund saved offline because the synced online sale ID is not ready yet.",
          );
          closePartialRefund();
          setViewSale(null);
          return;
        }
        saleForRefund = resolvedSale;
      }

      const { data: refund, error: refundError } = await (supabase as any)
        .from("sale_refunds")
        .insert({
          tenant_id: saleForRefund.tenant_id || tenantId,
          sale_id: saleForRefund.id,
          refund_no: refundNo,
          refund_type: "partial",
          refund_total: refundTotal,
          reason: refundReason.trim() || null,
          status: "completed",
          user_id: user?.id || saleForRefund.user_id || null,
        })
        .select()
        .single();

      if (refundError) throw refundError;

      const refundItemsPayload = lines.map((line) => ({
        tenant_id: saleForRefund.tenant_id || tenantId,
        refund_id: refund.id,
        sale_id: saleForRefund.id,
        sale_item_id: line.item.id,
        product_id: line.item.product_id,
        product_name: line.item.product_name || "Unknown Product",
        quantity: line.quantity,
        unit_price: line.unitPrice,
        unit_cost: line.unitCost,
        total: line.total,
        batch_id: line.item.batch_id || null,
      }));

      const { error: refundItemsError } = await (supabase as any)
        .from("sale_refund_items")
        .insert(refundItemsPayload);

      if (refundItemsError) throw refundItemsError;

      for (const line of lines) {
        const item = line.item;
        if (!item.product_id) continue;

        const { data: product, error: productError } = await (supabase as any)
          .from("products")
          .select("id, stock, stock_quantity, status, name")
          .eq("id", item.product_id)
          .eq("tenant_id", saleForRefund.tenant_id || tenantId)
          .maybeSingle();

        if (productError) throw productError;
        if (!product) continue;

        const currentStock = Number(
          product.stock ?? product.stock_quantity ?? 0,
        );
        const newStock = currentStock + line.quantity;

        const { error: stockError } = await (supabase as any)
          .from("products")
          .update({
            stock: newStock,
            stock_quantity: newStock,
            status: getRestoredProductStatus(product, newStock),
          })
          .eq("id", item.product_id)
          .eq("tenant_id", saleForRefund.tenant_id || tenantId);

        if (stockError) throw stockError;

        await restoreBatchQuantity(item.batch_id, line.quantity);

        const newRefundedQuantity =
          safeNumber(item.refunded_quantity) + line.quantity;
        const itemStatus =
          newRefundedQuantity >= safeNumber(item.quantity)
            ? "refunded"
            : "partial_refunded";

        const { error: itemUpdateError } = await (supabase as any)
          .from("sale_items")
          .update({
            refunded_quantity: newRefundedQuantity,
            refund_status: itemStatus,
          })
          .eq("id", item.id);

        if (itemUpdateError) throw itemUpdateError;

        const { error: movementError } = await (supabase as any)
          .from("stock_movements")
          .insert({
            tenant_id: partialRefundSale.tenant_id || tenantId,
            user_id: user?.id || saleForRefund.user_id || null,
            product_id: item.product_id,
            product_name:
              item.product_name || product.name || "Unknown Product",
            movement_type: "partial_refund",
            quantity_change: line.quantity,
            stock_before: currentStock,
            stock_after: newStock,
            reference:
              saleForRefund.invoice_no ||
              saleForRefund.receipt_no ||
              saleForRefund.id,
            reference_id: saleForRefund.id,
            notes: `Partial refund ${refundNo}: restored ${line.quantity} item(s)`,
          });

        if (movementError) throw movementError;
      }

      const refreshedItems = await loadSaleItems(saleForRefund.id);
      const allFullyRefunded = refreshedItems.every(
        (item) =>
          safeNumber(item.refunded_quantity) >= safeNumber(item.quantity),
      );
      const nextItemSummary = getNetItemSummaryFromItems(refreshedItems);

      const nextSubtotal = Math.max(
        0,
        safeNumber(saleForRefund.subtotal) - refundTotal,
      );
      const nextTotal = Math.max(0, getSaleTotal(saleForRefund) - refundTotal);
      const nextPaid = Math.max(
        0,
        safeNumber(saleForRefund.paid) - refundTotal,
      );
      const nextCostTotal = Math.max(
        0,
        firstPositiveNumber(
          saleForRefund.cost_total,
          saleForRefund.cogs_total,
        ) - refundCostTotal,
      );
      const nextProfit = Math.max(0, nextTotal - nextCostTotal);

      await update.mutateAsync({
        id: saleForRefund.id,
        status: allFullyRefunded ? "refunded" : "partial_refunded",
        items: nextItemSummary.net,
        subtotal: nextSubtotal,
        total: nextTotal,
        paid: nextPaid,
        due: Math.max(0, safeNumber(saleForRefund.due)),
        cost_total: nextCostTotal,
        cogs_total: nextCostTotal,
        gross_profit: nextProfit,
        profit: nextProfit,
        net_profit: nextProfit,
      } as any);

      await refreshSalesRelatedQueries();

      toast.success("Partial refund completed and stock restored.");
      closePartialRefund();
      setViewSale(null);
    } catch (error: any) {
      if (isNetworkError(error) && partialRefundSale) {
        try {
          await queuePartialRefundOffline(
            partialRefundSale,
            lines,
            refundNo,
            refundTotal,
            refundCostTotal,
          );
          toast.success(
            "Network failed. Partial refund was saved offline and will sync later.",
          );
          closePartialRefund();
          setViewSale(null);
          return;
        } catch (offlineError: any) {
          toast.error(
            offlineError?.message || "Failed to save partial refund offline",
          );
          return;
        }
      }

      toast.error(error?.message || "Failed to complete partial refund");
    } finally {
      setProcessingSaleId(null);
    }
  };

  const changeSaleStatusWithStockRestore = async (
    sale: SaleWithEBM,
    nextStatus: "cancelled" | "refunded",
  ) => {
    if (!sale?.id) return;

    const actionLabel = nextStatus === "refunded" ? "refund" : "cancel";

    try {
      setProcessingSaleId(sale.id);

      let saleForStatusChange = sale;
      if (canUseOnlineSupabase && isOfflineSaleId(sale.id)) {
        const resolvedSale = await resolveOnlineSaleForAction(sale);
        if (resolvedSale?.id && !isOfflineSaleId(resolvedSale.id)) {
          saleForStatusChange = resolvedSale;
        }
      }

      if (!canUseOnlineSupabase || isOfflineSaleId(saleForStatusChange.id)) {
        const saleItems = await loadSaleItems(sale.id);
        const restoredItems = saleItems
          .map((item) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: Math.max(
              0,
              safeNumber(item.quantity) - safeNumber(item.refunded_quantity),
            ),
            batch_id: item.batch_id || null,
          }))
          .filter((item) => item.product_id && item.quantity > 0);

        const locallyUpdatedItems = saleItems.map((item) => ({
          ...item,
          refunded_quantity: safeNumber(item.quantity),
          refund_status: "refunded",
        }));

        const localPatch: any = {
          id: sale.id,
          status: nextStatus,
          items: 0,
          subtotal: 0,
          total: 0,
          paid: 0,
          due: 0,
          cost_total: 0,
          cogs_total: 0,
          gross_profit: 0,
          profit: 0,
          net_profit: 0,
          sale_items: locallyUpdatedItems,
          line_items: locallyUpdatedItems,
        };

        await restoreStockInLocalCache(
          sale,
          restoredItems,
          nextStatus === "refunded" ? "refund" : "sale_cancel",
        );

        await savePending("sales", {
          ...localPatch,
          tenant_id: sale.tenant_id || tenantId,
          operation: "update",
          restore_stock_on_sync: true,
          restore_reason: nextStatus,
          restore_stock_items: restoredItems,
          invoice_no: sale.invoice_no,
          receipt_no: sale.receipt_no,
          user_id: user?.id || sale.user_id || null,
          sync_status: "pending",
        });

        await applyLocalSalePatch(sale.id, localPatch);
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["sale_items_summary"] });
        refreshLocalInventoryQueries();
        toast.success(
          `Sale ${nextStatus === "refunded" ? "refunded" : "cancelled"} offline and stock restored locally.`,
        );
        setViewSale(null);
        return;
      }

      await reverseSaleStock(saleForStatusChange, nextStatus);
      toast.success(
        nextStatus === "refunded"
          ? "Sale refunded and stock restored."
          : "Sale cancelled and stock restored.",
      );
      setViewSale(null);
    } catch (error: any) {
      if (isNetworkError(error)) {
        try {
          const saleItems = await loadSaleItems(sale.id);
          const restoredItems = saleItems
            .map((item) => ({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: Math.max(
                0,
                safeNumber(item.quantity) - safeNumber(item.refunded_quantity),
              ),
              batch_id: item.batch_id || null,
            }))
            .filter((item) => item.product_id && item.quantity > 0);

          const locallyUpdatedItems = saleItems.map((item) => ({
            ...item,
            refunded_quantity: safeNumber(item.quantity),
            refund_status: "refunded",
          }));

          const localPatch: any = {
            id: sale.id,
            status: nextStatus,
            items: 0,
            subtotal: 0,
            total: 0,
            paid: 0,
            due: 0,
            cost_total: 0,
            cogs_total: 0,
            gross_profit: 0,
            profit: 0,
            net_profit: 0,
            sale_items: locallyUpdatedItems,
            line_items: locallyUpdatedItems,
          };

          await restoreStockInLocalCache(
            sale,
            restoredItems,
            nextStatus === "refunded" ? "refund" : "sale_cancel",
          );

          await savePending("sales", {
            ...localPatch,
            tenant_id: sale.tenant_id || tenantId,
            operation: "update",
            restore_stock_on_sync: true,
            restore_reason: nextStatus,
            invoice_no: sale.invoice_no,
            receipt_no: sale.receipt_no,
            user_id: user?.id || sale.user_id || null,
            sync_status: "pending",
          });

          await applyLocalSalePatch(sale.id, localPatch);
          queryClient.invalidateQueries({ queryKey: ["sales"] });
          queryClient.invalidateQueries({ queryKey: ["sale_items_summary"] });
          refreshLocalInventoryQueries();
          toast.success(
            `Network failed. Sale ${nextStatus === "refunded" ? "refunded" : "cancelled"} offline and stock restored locally.`,
          );
          setViewSale(null);
          return;
        } catch (offlineError: any) {
          toast.error(
            offlineError?.message || `Failed to queue ${actionLabel}`,
          );
          return;
        }
      }

      toast.error(error?.message || `Failed to ${actionLabel} sale`);
    } finally {
      setProcessingSaleId(null);
    }
  };

  const cancelSale = (sale: SaleWithEBM) => {
    changeSaleStatusWithStockRestore(sale, "cancelled");
  };

  const refundSale = (sale: SaleWithEBM) => {
    changeSaleStatusWithStockRestore(sale, "refunded");
  };

  const retryEbmSubmission = async (sale: SaleWithEBM) => {
    if (!sale?.id) return;

    if (!canUseOnlineSupabase) {
      toast.info("EBM retry requires online login and stable internet.");
      return;
    }

    if (isOfflineSaleId(sale.id)) {
      toast.info("This sale must finish syncing before EBM retry can run.");
      return;
    }

    try {
      setProcessingSaleId(sale.id);

      await update.mutateAsync({
        id: sale.id,
        ebm_status: "pending",
      } as any);

      const { data, error } = await supabase.functions.invoke("ebm-vsdc", {
        body: {
          tenant_id: sale.tenant_id || tenantId,
          sale_id: sale.id,
          invoice_no: sale.invoice_no || sale.receipt_no,
        },
      });

      if (error) throw error;

      const payload: any = data || {};
      const nextStatus = payload.status || payload.ebm_status || "success";

      await update.mutateAsync({
        id: sale.id,
        ebm_status: nextStatus,
        ebm_receipt_no: payload.receipt_no || payload.ebm_receipt_no || sale.ebm_receipt_no || null,
        ebm_invoice_no: payload.invoice_no || payload.ebm_invoice_no || sale.ebm_invoice_no || null,
        ebm_qr_code: payload.qr_code || payload.ebm_qr_code || sale.ebm_qr_code || null,
        ebm_verification_code:
          payload.verification_code ||
          payload.ebm_verification_code ||
          sale.ebm_verification_code ||
          null,
        ebm_response: payload,
        ebm_synced_at: new Date().toISOString(),
      } as any);

      await refreshSalesRelatedQueries();

      if (nextStatus === "not_configured") {
        toast.info("Sale is saved. EBM credentials are not configured for this workspace.");
      } else {
        toast.success("EBM submission completed for this sale.");
      }
    } catch (error: any) {
      try {
        await update.mutateAsync({
          id: sale.id,
          ebm_status: "failed",
          ebm_response: {
            message: error?.message || "EBM retry failed",
            failed_at: new Date().toISOString(),
          },
        } as any);
      } catch {
        // Keep the original sale record unchanged if status update fails.
      }

      toast.error(error?.message || "EBM retry failed");
    } finally {
      setProcessingSaleId(null);
    }
  };

  const markCreditSalePaid = async (sale: SaleWithEBM) => {
    if (!sale?.id) return;

    try {
      setProcessingSaleId(sale.id);

      const total = getSaleTotal(sale);

      if (!canUseOnlineSupabase || isOfflineSaleId(sale.id)) {
        await savePending("sales", {
          id: sale.id,
          tenant_id: sale.tenant_id || tenantId,
          operation: "update",
          payment_method: sale.payment_method || "credit",
          paid: total,
          due: 0,
          status: "paid",
          credit_paid_on_sync: true,
        });

        await applyLocalSalePatch(sale.id, {
          id: sale.id,
          paid: total,
          due: 0,
          status: "paid",
        } as any);
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        toast.success(
          "Credit sale marked paid offline. It will sync when internet returns.",
        );
        return;
      }

      await update.mutateAsync({
        id: sale.id,
        paid: total,
        due: 0,
        status: "paid",
      } as any);

      await refreshSalesRelatedQueries();
      toast.success("Credit sale marked as paid.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark credit sale as paid");
    } finally {
      setProcessingSaleId(null);
    }
  };

  const buildSaleReceiptHtml = (sale: SaleWithEBM) => {
    const invoice = sale.invoice_no || sale.receipt_no || sale.id || "SALE";
    const ebmStatus = getEbmLabel(getEbmStatus(sale));
    const status = getDisplaySaleStatus(sale).replace(/_/g, " ");
    const lines = normalizeOfflineSaleItems(sale);
    const itemRows = lines.length
      ? lines
          .map(
            (item) => `
              <tr>
                <td>${item.product_name || "Item"}</td>
                <td class="right">${safeNumber(item.quantity)}</td>
                <td class="right">${formatCurrency(safeNumber(item.unit_price))}</td>
                <td class="right">${formatCurrency(safeNumber(item.total || safeNumber(item.unit_price) * safeNumber(item.quantity)))}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="muted center">Sale item details will appear here when line items are available.</td></tr>`;

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${invoice}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 24px; background: #f8fafc; }
    .receipt { max-width: 420px; margin: 0 auto; background: white; border: 1px solid #e5e7eb; border-radius: 18px; padding: 22px; }
    .brand { text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 14px; margin-bottom: 14px; }
    .brand h1 { margin: 0; font-size: 20px; letter-spacing: .04em; }
    .brand p, .muted { color: #64748b; font-size: 12px; }
    .row { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; margin: 7px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th { color: #64748b; border-bottom: 1px solid #e5e7eb; padding: 8px 0; text-align: left; }
    td { border-bottom: 1px solid #f1f5f9; padding: 8px 0; vertical-align: top; }
    .right { text-align: right; }
    .center { text-align: center; }
    .total { font-size: 16px; font-weight: 800; border-top: 2px solid #111827; padding-top: 10px; }
    .badge { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 4px 8px; font-size: 11px; }
    .footer { text-align: center; margin-top: 18px; border-top: 1px dashed #cbd5e1; padding-top: 14px; }
    @media print { body { background: white; padding: 0; } .receipt { border: 0; border-radius: 0; max-width: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="brand">
      <h1>ShopCore MSystem</h1>
      <p>Professional Sales Receipt</p>
      <span class="badge">${hasPendingSync(sale) ? "Offline / Pending Sync" : "Online Record"}</span>
    </div>
    <div class="row"><span>Invoice</span><strong>${invoice}</strong></div>
    <div class="row"><span>Date</span><strong>${formatDateTime(getSaleDate(sale))}</strong></div>
    <div class="row"><span>Customer</span><strong>${sale.customer_name || "Walk-in Customer"}</strong></div>
    <div class="row"><span>TIN</span><strong>${sale.customer_tin || "—"}</strong></div>
    <div class="row"><span>Cashier</span><strong>${sale.cashier || "—"}</strong></div>
    <div class="row"><span>Payment</span><strong>${getPaymentLabel(sale.payment_method)}</strong></div>
    <div class="row"><span>Status</span><strong>${status}</strong></div>
    <div class="row"><span>EBM</span><strong>${ebmStatus}</strong></div>
    <div class="row"><span>Fiscal Receipt</span><strong>${getFiscalReceiptNumber(sale)}</strong></div>
    <div class="row"><span>Verification</span><strong>${sale.ebm_verification_code || "—"}</strong></div>
    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="row"><span>Subtotal</span><strong>${formatCurrency(safeNumber(sale.subtotal))}</strong></div>
    <div class="row"><span>Tax</span><strong>${formatCurrency(safeNumber(sale.tax))}</strong></div>
    <div class="row"><span>Discount</span><strong>-${formatCurrency(safeNumber(sale.discount))}</strong></div>
    <div class="row total"><span>Total</span><strong>${formatCurrency(getSaleTotal(sale))}</strong></div>
    <div class="row"><span>Paid</span><strong>${formatCurrency(safeNumber(sale.paid))}</strong></div>
    <div class="row"><span>Due</span><strong>${formatCurrency(safeNumber(sale.due))}</strong></div>
    <div class="footer">
      <p class="muted">This receipt shows fiscal details when EBM submission has been completed for this workspace.</p>
      <p>Thank you for your purchase.</p>
    </div>
  </div>
</body>
</html>`;
  };

  const printSaleReceipt = (sale: SaleWithEBM) => {
    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) {
      toast.error("Popup blocked. Allow popups to print this receipt.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildSaleReceiptHtml(sale));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadSaleReceipt = (sale: SaleWithEBM) => {
    const invoice =
      sale.invoice_no || sale.receipt_no || sale.id || "sale-receipt";
    const blob = new Blob([buildSaleReceiptHtml(sale)], {
      type: "text/html;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice}_receipt.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded.");
  };

  const kpis = [
    {
      label: "Today's Sales",
      value: formatCurrency(periodStats.today.sales),
      icon: CalendarDays,
      color: "bg-orange-600 text-white border-orange-500",
    },
    {
      label: "Weekly Sales",
      value: formatCurrency(periodStats.week.sales),
      icon: TrendingUp,
      color: "bg-emerald-600 text-white border-emerald-500",
    },
    {
      label: "Monthly Sales",
      value: formatCurrency(periodStats.month.sales),
      icon: BarChart3,
      color: "bg-violet-600 text-white border-violet-500",
    },
    {
      label: "Outstanding",
      value: formatCurrency(stats.outstanding),
      icon: Wallet,
      color: "bg-rose-600 text-white border-rose-500",
    },
  ];

  const profitLossCards = [
    {
      label: "Today's Profit",
      value: formatCurrency(periodStats.today.profit),
      icon: DollarSign,
      color: "bg-emerald-600/20 text-white border-emerald-500/20",
    },
    {
      label: "Today's Loss",
      value: formatCurrency(periodStats.today.loss),
      icon: TrendingDown,
      color: "bg-rose-600/20 text-white border-rose-500/20",
    },
    {
      label: "Weekly Profit",
      value: formatCurrency(periodStats.week.profit),
      icon: DollarSign,
      color: "bg-blue-600/20 text-white border-blue-500/20",
    },
    {
      label: "Weekly Loss",
      value: formatCurrency(periodStats.week.loss),
      icon: TrendingDown,
      color: "bg-orange-600/20 text-white border-orange-500/20",
    },
    {
      label: "Monthly Profit",
      value: formatCurrency(periodStats.month.profit),
      icon: DollarSign,
      color: "bg-violet-600/20 text-white border-violet-500/20",
    },
    {
      label: "Monthly Loss",
      value: formatCurrency(periodStats.month.loss),
      icon: TrendingDown,
      color: "bg-rose-600/20 text-white border-rose-500/20",
    },
  ];

  if (isLoading) {
    return (
      <PageShell title="Sales" description="Loading...">
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Sales"
      description="Enterprise sales control center for transactions, invoices, credit collection, refunds, profitability, offline sync, receipt workflows, and EBM readiness."
    >
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0"
                >
                  <Receipt className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600 mb-3">
                    Sales Control Center
                  </Badge>
                  <h2 className="text-2xl font-bold tracking-tight">
                    Sales Transactions & Fiscal Invoices
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Monitor daily, weekly, and monthly sales, profit, loss,
                    payments, refunds, cancellations, outstanding balances, and
                    EBM fiscal submission status and receipt readiness.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                    <div className="rounded-2xl bg-blue-400 p-3 text-white">
                      <p className="text-xs text-muted-foreground">
                        Today Sales
                      </p>
                      <p className="text-sm font-semibold font-data">
                        {formatCurrency(periodStats.today.sales)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-emerald-400 p-3 text-white">
                      <p className="text-xs text-muted-foreground">
                        Week Sales
                      </p>
                      <p className="text-sm font-semibold font-data">
                        {formatCurrency(periodStats.week.sales)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-violet-400 p-3 text-white">
                      <p className="text-xs text-muted-foreground">
                        Month Sales
                      </p>
                      <p className="text-sm font-semibold font-data">
                        {formatCurrency(periodStats.month.sales)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-1 gap-3">
              {kpis.map((item) => {
                const Icon = item.icon;
                const valueClass =
                  String(item.value).length > 14
                    ? "text-base xl:text-lg break-words max-w-full"
                    : "text-2xl";

                return (
                  <div
                    key={item.label}
                    className={`rounded-3xl border bg-card shadow-sm p-4 ${item.color}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">
                          {item.label}
                        </p>
                        <p className={`${valueClass} font-bold font-data mt-1`}>
                          {item.value}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {profitLossCards.map((item) => (
              <div
                key={item.label}
                className={`rounded-3xl border p-4 shadow-sm ${item.color}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center"
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="font-bold font-data truncate">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 rounded-3xl border border-emerald-200 bg-emerald-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center"
                >
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-950">Sales Summary</h3>
                  <p className="text-xs text-muted-foreground">
                    Status, refund, cancellation, and collection control
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Completed",
                    value: stats.completed,
                    icon: ShieldCheck,
                  },
                  { label: "Refunded", value: stats.refunded, icon: RotateCcw },
                  { label: "Cancelled", value: stats.cancelled, icon: Ban },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-white border border-emerald-200 p-3 text-center"
                  >
                    <item.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="font-data font-bold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-white border border-cyan-200 p-4">
                <p className="text-xs text-muted-foreground">Collection Risk</p>
                <p className="text-sm font-medium mt-1">
                  {stats.outstanding > 0
                    ? `${formatCurrency(stats.outstanding)} still outstanding`
                    : "No outstanding balance"}
                </p>
              </div>
            </div>

            <div className="xl:col-span-7 rounded-3xl border border-cyan-200 bg-cyan-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center">
                  <ServerCog className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-cyan-950">EBM Sync Overview</h3>
                  <p className="text-xs text-muted-foreground">
                    Fiscalized receipts, pending invoices, failed submissions, and credential readiness
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "Fiscalized",
                    value: stats.ebmSuccess + stats.ebmSynced,
                    color: "bg-emerald-600 text-white",
                  },
                  {
                    label: "Pending",
                    value: stats.ebmPending,
                    color: "bg-orange-600 text-white",
                  },
                  {
                    label: "Not Configured",
                    value: stats.ebmNotConfigured,
                    color: "bg-cyan-600 text-white",
                  },
                  {
                    label: "Failed",
                    value: stats.ebmFailed,
                    color: "bg-rose-600 text-white",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-2xl p-4 ${item.color}`}
                  >
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold font-data">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">
                  Profit Calculation Note
                </p>
                <p className="text-sm font-medium mt-1">
                  Profit uses saved profit/cost fields when available. If cost
                  data is missing, profit is counted as 0 to avoid false profit.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-950">Sales Command Board</h3>
                  <p className="text-xs text-blue-800">Daily revenue, transaction flow, and cashier execution.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blue-600 p-3 text-white">
                  <p className="text-[11px] text-white/80">Today Orders</p>
                  <p className="font-data text-xl font-black">{periodStats.today.orders}</p>
                </div>
                <div className="rounded-2xl bg-emerald-600 p-3 text-white">
                  <p className="text-[11px] text-white/80">Collection</p>
                  <p className="font-data text-xl font-black">{analytics.collectionRate}%</p>
                </div>
                <div className="rounded-2xl bg-violet-600 p-3 text-white">
                  <p className="text-[11px] text-white/80">Avg Order</p>
                  <p className="font-data text-sm font-black break-words">{formatCurrency(analytics.avgOrderValue)}</p>
                </div>
                <div className="rounded-2xl bg-orange-600 p-3 text-white">
                  <p className="text-[11px] text-white/80">Offline Pending</p>
                  <p className="font-data text-xl font-black">{analytics.offlinePending}</p>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-violet-950">Payment Mix</h3>
                  <p className="text-xs text-violet-800">Cash, Mobile Money, cards, bank, and credit contribution.</p>
                </div>
              </div>
              <div className="space-y-3">
                {analytics.paymentMix.filter((row) => row.value > 0).slice(0, 4).map((row) => (
                  <div key={row.method}>
                    <div className="mb-1 flex items-center justify-between text-xs text-violet-900">
                      <span>{row.label}</span>
                      <span className="font-data font-bold">{row.percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white border border-violet-200">
                      <div className="h-full rounded-full bg-violet-600" style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))}
                {analytics.paymentMix.every((row) => row.value <= 0) && (
                  <p className="rounded-2xl bg-white border border-violet-200 p-3 text-xs text-violet-700">No payment mix available yet.</p>
                )}
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-950">Control Exceptions</h3>
                  <p className="text-xs text-orange-800">Issues requiring cashier, manager, or fiscal review.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white border border-orange-200 p-3">
                  <p className="text-[11px] text-orange-700">Credit Sales</p>
                  <p className="font-data text-xl font-black">{stats.creditSales}</p>
                </div>
                <div className="rounded-2xl bg-white border border-orange-200 p-3">
                  <p className="text-[11px] text-orange-700">EBM Failed</p>
                  <p className="font-data text-xl font-black">{stats.ebmFailed}</p>
                </div>
                <div className="rounded-2xl bg-white border border-orange-200 p-3">
                  <p className="text-[11px] text-orange-700">Refunded</p>
                  <p className="font-data text-xl font-black">{stats.refunded}</p>
                </div>
                <div className="rounded-2xl bg-white border border-orange-200 p-3">
                  <p className="text-[11px] text-orange-700">Expired</p>
                  <p className="font-data text-xl font-black">{stats.expiredProducts}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-950">Cashier Performance</h3>
                    <p className="text-xs text-blue-800">Revenue, transaction count, and gross profit by cashier.</p>
                  </div>
                </div>
                <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">Sales Team</Badge>
              </div>

              <div className="space-y-3">
                {analytics.cashierPerformance.length === 0 ? (
                  <div className="rounded-2xl border border-blue-200 bg-white p-3 text-xs text-blue-700">No cashier sales activity yet.</div>
                ) : (
                  analytics.cashierPerformance.map((row) => (
                    <div key={row.cashier} className="rounded-2xl border border-blue-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-blue-950">{row.cashier}</p>
                          <p className="text-xs text-blue-700">{row.orders} transaction(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="font-data text-sm font-black text-blue-700">{formatCurrency(row.revenue)}</p>
                          <p className="text-xs text-emerald-700">Profit {formatCurrency(row.profit)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="xl:col-span-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-950">Branch Performance</h3>
                    <p className="text-xs text-emerald-800">Branch revenue, gross profit, and order volume.</p>
                  </div>
                </div>
                <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">Branch Control</Badge>
              </div>

              <div className="space-y-3">
                {analytics.branchPerformance.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-white p-3 text-xs text-emerald-700">No branch sales activity yet.</div>
                ) : (
                  analytics.branchPerformance.map((row) => (
                    <div key={row.branch} className="rounded-2xl border border-emerald-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-emerald-950">{row.branch}</p>
                          <p className="text-xs text-emerald-700">{row.orders} order(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="font-data text-sm font-black text-emerald-700">{formatCurrency(row.revenue)}</p>
                          <p className="text-xs text-blue-700">Profit {formatCurrency(row.profit)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              {
                mode: "active" as SalesViewMode,
                label: "Active Sales",
                value: stats.completed,
                helper: "Normal completed transactions",
                icon: Receipt,
                color:
                  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
              },
              {
                mode: "credit" as SalesViewMode,
                label: "Credit Sales",
                value: formatCurrency(stats.creditBalance),
                helper: `${stats.creditSales} customer(s) owing`,
                icon: CreditCard,
                color: "bg-blue-600/20 text-white border-blue-500/20",
              },
              {
                mode: "deleted" as SalesViewMode,
                label: "Cancelled / Refunded",
                value: stats.deletedSales,
                helper: "Archived sales records",
                icon: Archive,
                color: "bg-rose-600/20 text-white border-rose-500/20",
              },
              {
                mode: "expired" as SalesViewMode,
                label: "Expired Products",
                value: stats.expiredProducts,
                helper: "Products past expiry date",
                icon: PackageX,
                color: "bg-orange-600/20 text-white border-orange-500/20",
              },
            ].map((item) => (
              <button
                key={item.mode}
                type="button"
                onClick={() => {
                  setViewMode(item.mode);
                  setPage(1);
                }}
                className={`rounded-3xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${item.color} ${
                  viewMode === item.mode ? "ring-2 ring-offset-2 ring-blue-600" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center"
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="font-bold font-data truncate">{item.value}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.helper}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {creditSalesList.length > 0 &&
            viewMode !== "credit" &&
            viewMode !== "expired" && (
              <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
                <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      Open Credit Sales
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Customers with outstanding balances. Open the Credit Sales
                      card to see the full list.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => {
                      setViewMode("credit");
                      setPage(1);
                    }}
                  >
                    View all credit sales
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditSalesList.slice(0, 5).map((sale) => (
                        <TableRow key={`credit-${sale.id}`}>
                          <TableCell className="font-data text-xs font-medium">
                            {sale.invoice_no || sale.receipt_no || "—"}
                          </TableCell>
                          <TableCell>
                            {sale.customer_name || "Walk-in Customer"}
                          </TableCell>
                          <TableCell className="text-right font-data">
                            {formatCurrency(getSaleTotal(sale))}
                          </TableCell>
                          <TableCell className="text-right font-data">
                            {formatCurrency(safeNumber(sale.paid))}
                          </TableCell>
                          <TableCell className="text-right font-data text-destructive">
                            {formatCurrency(safeNumber(sale.due))}
                          </TableCell>
                          <TableCell className="font-data text-xs text-muted-foreground">
                            {formatDateTimeShort(getSaleDate(sale))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              disabled={processingSaleId === sale.id}
                              onClick={() => markCreditSalePaid(sale)}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Mark Paid
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

          {viewMode === "expired" && (
            <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
              <div className="border-b p-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <PackageX className="w-4 h-4 text-orange-600" />
                  Expired Products
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Products whose expiry date has already passed.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-10 text-muted-foreground"
                      >
                        No expired products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    expiredProducts.map((product: any) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="font-data text-xs text-muted-foreground">
                          {product.sku || "—"}
                        </TableCell>
                        <TableCell className="text-right font-data">
                          {safeNumber(product.stock ?? product.stock_quantity)}
                        </TableCell>
                        <TableCell>
                          {formatDateTimeShort(getProductExpiryDate(product))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="rounded-full bg-orange-500/10 text-orange-600 border-orange-500/30"
                          >
                            Expired
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {viewMode !== "expired" && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-4 rounded-3xl border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Sales Intelligence</h3>
                      <p className="text-xs text-muted-foreground">
                        Average order, margin, collection, and sync readiness
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Avg Order</p>
                      <p className="mt-1 font-data text-lg font-bold">
                        {formatCurrency(analytics.avgOrderValue)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Margin</p>
                      <p className="mt-1 font-data text-lg font-bold">
                        {analytics.profitMargin.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Collection
                      </p>
                      <p className="mt-1 font-data text-lg font-bold">
                        {analytics.collectionRate}%
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Fiscal Ready</p>
                      <p className="mt-1 font-data text-lg font-bold">
                        {analytics.syncReady}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-4 rounded-3xl border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Period Performance</h3>
                      <p className="text-xs text-muted-foreground">
                        Sales and profit by active period
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {analytics.timeline.map((item) => {
                      const max = Math.max(periodStats.month.sales, 1);
                      const width = Math.max(
                        6,
                        Math.round((item.value / max) * 100),
                      );
                      return (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-medium">{item.label}</span>
                            <span className="font-data text-muted-foreground">
                              {formatCurrency(item.value)}
                            </span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[#0b3d5c]"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Profit: {formatCurrency(item.profit)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="xl:col-span-4 rounded-3xl border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        Payment & Offline Health
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Payment mix and records waiting for sync
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {analytics.paymentMix.map((item) => (
                      <div key={item.method}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span>{item.label}</span>
                          <span className="font-data">{item.percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{ width: `${Math.max(3, item.percent)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-muted/40 p-3 text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {analytics.offlinePending > 0 ? (
                          <WifiOff className="h-4 w-4 text-orange-600" />
                        ) : (
                          <Wifi className="h-4 w-4 text-emerald-600" />
                        )}
                        Pending Offline Sync
                      </span>
                      <span className="font-data font-bold">
                        {analytics.offlinePending}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-3xl border shadow-sm p-4">
                <div className="flex flex-col xl:flex-row gap-3">
                  <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-muted rounded-2xl">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by invoice, customer, TIN, EBM invoice, cashier, branch, or date..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => {
                        setStatusFilter(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[140px] h-11 rounded-2xl text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                        <SelectItem value="partial_refunded">
                          Partial Refunded
                        </SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={paymentFilter}
                      onValueChange={(v) => {
                        setPaymentFilter(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[150px] h-11 rounded-2xl text-xs">
                        <SelectValue placeholder="Payment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Methods</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="mobile">Mobile Money</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={ebmFilter}
                      onValueChange={(v) => {
                        setEbmFilter(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[145px] h-11 rounded-2xl text-xs">
                        <SelectValue placeholder="EBM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All EBM</SelectItem>
                        <SelectItem value="success">Fiscalized</SelectItem>
                        <SelectItem value="synced">Synced</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="pending_sync">Pending Sync</SelectItem>
                        <SelectItem value="not_configured">Not Configured</SelectItem>
                        <SelectItem value="not_synced">Not Synced</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>

                    <ExportMenu
                      onCSV={() => exportToCSV(exportRows, "sales", exportCols)}
                      onPDF={() =>
                        exportToPDF(
                          exportRows,
                          "sales",
                          "Sales Report",
                          exportCols,
                          {
                            subtitle: `${filtered.length} sales transactions`,
                            summary: [
                              {
                                label: "Today Sales",
                                value: formatCurrency(periodStats.today.sales),
                              },
                              {
                                label: "Weekly Sales",
                                value: formatCurrency(periodStats.week.sales),
                              },
                              {
                                label: "Monthly Sales",
                                value: formatCurrency(periodStats.month.sales),
                              },
                              {
                                label: "Monthly Profit",
                                value: formatCurrency(periodStats.month.profit),
                              },
                              {
                                label: "Monthly Loss",
                                value: formatCurrency(periodStats.month.loss),
                              },
                            ],
                          },
                        )
                      }
                    />

                    <Button
                      className="h-11 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => navigate("/pos")}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Record Sale in POS
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-3xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortHeader label="Invoice" sortKeyName="invoice_no" />
                      </TableHead>
                      <TableHead>
                        <SortHeader
                          label="Customer"
                          sortKeyName="customer_name"
                        />
                      </TableHead>
                      <TableHead>Customer TIN</TableHead>
                      <TableHead>EBM</TableHead>
                      <TableHead className="text-center">Net Items</TableHead>
                      <TableHead className="text-right">
                        <SortHeader label="Total" sortKeyName="total" />
                      </TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>
                        <SortHeader label="Status" sortKeyName="status" />
                      </TableHead>
                      <TableHead>
                        <SortHeader label="Date" sortKeyName="date" />
                      </TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paged.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="text-center py-12 text-muted-foreground"
                        >
                          <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          No sales found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paged.map((s) => {
                        const ebmStatus = getEbmStatus(s);

                        return (
                          <TableRow
                            key={s.id}
                            className="cursor-pointer hover:bg-muted/30"
                            onClick={() => setViewSale(s)}
                          >
                            <TableCell className="font-data text-xs font-medium">
                              {s.invoice_no}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </div>
                                <span className="truncate">
                                  {s.customer_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-data text-xs text-muted-foreground">
                              {s.customer_tin || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] rounded-full ${ebmStatusColors[ebmStatus] || ebmStatusColors.not_synced}`}
                              >
                                {getEbmLabel(ebmStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-data text-sm">
                              <div className="flex flex-col items-center gap-1 leading-tight">
                                <Badge
                                  variant="secondary"
                                  className="rounded-full text-[10px]"
                                >
                                  Net: {getSaleItemSummary(s).net}
                                </Badge>
                                {getSaleItemSummary(s).refunded > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-600"
                                  >
                                    Refunded: {getSaleItemSummary(s).refunded}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-data text-sm font-medium">
                              {formatCurrency(getSaleTotal(s))}
                            </TableCell>
                            <TableCell className="text-right font-data text-sm">
                              {formatCurrency(Number(s.paid ?? 0))}
                            </TableCell>
                            <TableCell className="text-right font-data text-sm">
                              {Number(s.due) > 0 ? (
                                <span className="text-destructive">
                                  {formatCurrency(Number(s.due ?? 0))}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="text-[10px] rounded-full"
                              >
                                {getPaymentLabel(s.payment_method)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] rounded-full ${statusColors[getDisplaySaleStatus(s)] || ""}`}
                              >
                                {getDisplaySaleStatus(s)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-data text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTimeShort(getSaleDate(s))}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewSale(s);
                                    }}
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      printSaleReceipt(s);
                                    }}
                                  >
                                    <Printer className="w-3.5 h-3.5 mr-2" />
                                    Print Receipt
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadSaleReceipt(s);
                                    }}
                                  >
                                    <Download className="w-3.5 h-3.5 mr-2" />
                                    Download Receipt
                                  </DropdownMenuItem>
                                  {canRetryEbmSubmission(s) && (
                                    <DropdownMenuItem
                                      disabled={processingSaleId === s.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        retryEbmSubmission(s);
                                      }}
                                    >
                                      <Send className="w-3.5 h-3.5 mr-2" />
                                      Retry EBM Submission
                                    </DropdownMenuItem>
                                  )}
                                  {isCreditSale(s) && safeNumber(s.due) > 0 && (
                                    <DropdownMenuItem
                                      disabled={processingSaleId === s.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markCreditSalePaid(s);
                                      }}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                      Mark Credit as Paid
                                    </DropdownMenuItem>
                                  )}
                                  {canRefundSaleOfflineSafe(s) && (
                                    <DropdownMenuItem
                                      disabled={
                                        processingSaleId === s.id ||
                                        loadingRefundItems
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openPartialRefund(s);
                                      }}
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 mr-2" />
                                      Partial Refund
                                    </DropdownMenuItem>
                                  )}
                                  {canRefundSaleOfflineSafe(s) && (
                                    <DropdownMenuItem
                                      disabled={processingSaleId === s.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        refundSale(s);
                                      }}
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 mr-2" />
                                      Refund
                                    </DropdownMenuItem>
                                  )}
                                  {canCancelSaleOfflineSafe(s) && (
                                    <DropdownMenuItem
                                      disabled={processingSaleId === s.id}
                                      className="text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelSale(s);
                                      }}
                                    >
                                      <Ban className="w-3.5 h-3.5 mr-2" />
                                      Cancel
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                {filtered.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                      {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                      {filtered.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (n) => (
                          <Button
                            key={n}
                            variant={n === currentPage ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8 text-xs"
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </Button>
                        ),
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
          <DialogContent className="w-[96vw] max-w-5xl overflow-hidden rounded-3xl p-0">
            <div className="max-h-[88vh] overflow-y-auto p-5 sm:p-6">
              <DialogHeader className="pr-8">
                <DialogTitle className="flex flex-wrap items-center gap-2 break-words">
                  <FileText className="w-5 h-5 shrink-0" />
                  <span className="min-w-0 break-words">
                    {viewSale?.invoice_no}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  {viewSale ? formatDateTime(getSaleDate(viewSale)) : "—"} ·{" "}
                  {viewSale?.branch || "Branch not assigned"}
                </DialogDescription>
              </DialogHeader>

              {viewSale && (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="break-words text-sm font-medium">
                        {viewSale.customer_name || "Walk-in Customer"}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        Customer TIN
                      </p>
                      <p className="break-words text-sm font-medium font-data">
                        {viewSale.customer_tin || "—"}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Cashier</p>
                      <p className="break-words text-sm font-medium">
                        {viewSale.cashier || "—"}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge
                        variant="outline"
                        className={`mt-1 max-w-full rounded-full text-xs ${statusColors[getDisplaySaleStatus(viewSale)] || ""}`}
                      >
                        <span className="truncate">
                          {getDisplaySaleStatus(viewSale).replace(/_/g, " ")}
                        </span>
                      </Badge>
                    </div>
                    <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Payment</p>
                      <p className="break-words text-sm">
                        {getPaymentLabel(viewSale.payment_method)}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        EBM Status
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-1 max-w-full rounded-full text-xs ${ebmStatusColors[getEbmStatus(viewSale)] || ebmStatusColors.not_synced}`}
                      >
                        <span className="truncate">
                          {getEbmLabel(getEbmStatus(viewSale))}
                        </span>
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ServerCog className="h-4 w-4 shrink-0 text-violet-600" />
                      <p className="text-sm font-semibold">
                        EBM Fiscal Details
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div className="min-w-0 rounded-xl bg-background/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          EBM Invoice No
                        </p>
                        <p className="break-words font-data">
                          {viewSale.ebm_invoice_no || "Not assigned"}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-background/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          Fiscal Receipt No
                        </p>
                        <p className="break-words font-data">
                          {getFiscalReceiptNumber(viewSale)}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-background/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          Verification Code
                        </p>
                        <p className="break-words font-data">
                          {viewSale.ebm_verification_code || "Not assigned"}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-background/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          Synced At
                        </p>
                        <p className="break-words font-data">
                          {viewSale.ebm_synced_at
                            ? formatDateTime(viewSale.ebm_synced_at)
                            : "Not synced"}
                        </p>
                      </div>
                    </div>

                    {viewSale.ebm_qr_code && (
                      <div className="mt-3 rounded-xl border bg-background p-3 text-xs font-data">
                        <div className="flex items-center gap-2 mb-1">
                          <QrCode className="h-4 w-4 shrink-0" />
                          QR Data
                        </div>
                        <p className="break-all">{viewSale.ebm_qr_code}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.85fr]">
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="grid grid-cols-3 gap-3 rounded-xl border bg-background/70 p-3 text-center">
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">
                            Original Items
                          </p>
                          <p className="font-data font-bold">
                            {getSaleItemSummary(viewSale).original}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">
                            Refunded
                          </p>
                          <p className="font-data font-bold text-orange-600">
                            {getSaleItemSummary(viewSale).refunded}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">
                            Net Items
                          </p>
                          <p className="font-data font-bold text-[#0b3d5c]">
                            {getSaleItemSummary(viewSale).net}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-muted/30 p-4 space-y-2">
                      <div className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="break-words text-right font-data">
                          {formatCurrency(Number(viewSale.subtotal ?? 0))}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="break-words text-right font-data">
                          {formatCurrency(Number(viewSale.tax ?? 0))}
                        </span>
                      </div>
                      {Number(viewSale.discount) > 0 && (
                        <div className="flex justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Discount
                          </span>
                          <span className="break-words text-right font-data text-accent">
                            -{formatCurrency(Number(viewSale.discount ?? 0))}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 border-t pt-2 text-sm font-bold">
                        <span>Total</span>
                        <span className="break-words text-right font-data">
                          {formatCurrency(getSaleTotal(viewSale))}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Gross Profit
                        </span>
                        <span className="break-words text-right font-data">
                          {formatCurrency(getSaleGrossProfit(viewSale))}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">Paid</span>
                        <span className="break-words text-right font-data">
                          {formatCurrency(Number(viewSale.paid ?? 0))}
                        </span>
                      </div>
                      {Number(viewSale.due) > 0 && (
                        <div className="flex justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">Due</span>
                          <span className="break-words text-right font-data text-destructive">
                            {formatCurrency(Number(viewSale.due ?? 0))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex max-h-[32vh] flex-col-reverse gap-2 overflow-y-auto border-t bg-background/95 p-4 sm:max-h-none sm:flex-row sm:flex-wrap sm:justify-end">
              {viewSale &&
                isCreditSale(viewSale) &&
                safeNumber(viewSale.due) > 0 && (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl sm:w-auto"
                    disabled={processingSaleId === viewSale.id}
                    onClick={() => markCreditSalePaid(viewSale)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Mark Credit Paid
                  </Button>
                )}
              {viewSale && canRefundSaleOfflineSafe(viewSale) && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl sm:w-auto"
                  disabled={
                    processingSaleId === viewSale.id || loadingRefundItems
                  }
                  onClick={() => openPartialRefund(viewSale)}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Partial Refund
                </Button>
              )}
              {viewSale && canRefundSaleOfflineSafe(viewSale) && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl sm:w-auto"
                  disabled={processingSaleId === viewSale.id}
                  onClick={() => refundSale(viewSale)}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Refund & Restore Stock
                </Button>
              )}
              {viewSale && canCancelSaleOfflineSafe(viewSale) && (
                <Button
                  variant="outline"
                  disabled={processingSaleId === viewSale.id}
                  className="w-full rounded-xl text-destructive sm:w-auto"
                  onClick={() => cancelSale(viewSale)}
                >
                  <Ban className="w-4 h-4 mr-1" />
                  Cancel & Restore Stock
                </Button>
              )}
              <Button
                className="w-full rounded-xl sm:w-auto"
                variant="outline"
                onClick={() => setViewSale(null)}
              >
                Close
              </Button>
              {viewSale && canRetryEbmSubmission(viewSale) && (
                <Button
                  className="w-full rounded-xl sm:w-auto"
                  variant="outline"
                  disabled={processingSaleId === viewSale.id}
                  onClick={() => retryEbmSubmission(viewSale)}
                >
                  <Send className="w-4 h-4 mr-1" />
                  Retry EBM Submission
                </Button>
              )}
              {viewSale && (
                <Button
                  className="w-full rounded-xl sm:w-auto"
                  variant="outline"
                  onClick={() => downloadSaleReceipt(viewSale)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Receipt
                </Button>
              )}
              {viewSale && (
                <Button
                  className="w-full rounded-xl sm:w-auto"
                  variant="outline"
                  onClick={() => printSaleReceipt(viewSale)}
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Print Receipt
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!partialRefundSale}
          onOpenChange={(open) => !open && closePartialRefund()}
        >
          <DialogContent className="max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-600" />
                Partial Refund{" "}
                {partialRefundSale?.invoice_no
                  ? `· ${partialRefundSale.invoice_no}`
                  : ""}
              </DialogTitle>
              <DialogDescription>
                Refund only selected products from this sale. The system will
                restore only those quantities to stock and to the original stock
                batch when available.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-2xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Sold</TableHead>
                      <TableHead className="text-center">
                        Already Refunded
                      </TableHead>
                      <TableHead className="text-center">Refund Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Refund Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partialRefundItems.map((item) => {
                      const id = item.id || "";
                      const maxQty = refundableQuantity(item);
                      const qty = Math.max(
                        0,
                        Math.min(maxQty, safeNumber(refundQuantities[id])),
                      );

                      return (
                        <TableRow
                          key={id || `${item.product_id}-${item.product_name}`}
                        >
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">
                                {item.product_name || "Unknown Product"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.sku || "No SKU"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-data">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-center font-data">
                            {safeNumber(item.refunded_quantity)}
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="number"
                              min="0"
                              max={maxQty}
                              value={refundQuantities[id] ?? 0}
                              onChange={(e) => {
                                const value = Math.max(
                                  0,
                                  Math.min(maxQty, safeNumber(e.target.value)),
                                );
                                setRefundQuantities((prev) => ({
                                  ...prev,
                                  [id]: value,
                                }));
                              }}
                              className="w-20 rounded-xl border bg-background px-2 py-1 text-center text-sm outline-none"
                            />
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Max {maxQty}
                            </p>
                          </TableCell>
                          <TableCell className="text-right font-data">
                            {formatCurrency(safeNumber(item.unit_price))}
                          </TableCell>
                          <TableCell className="text-right font-data font-semibold">
                            {formatCurrency(qty * safeNumber(item.unit_price))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Refund Reason
                </label>
                <input
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Example: customer returned damaged item"
                  className="mt-1 w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="rounded-2xl border bg-orange-500/10 p-4 text-sm text-orange-700">
                Refund Total:{" "}
                <span className="font-data font-bold">
                  {formatCurrency(
                    selectedRefundLines().reduce(
                      (sum, line) => sum + line.total,
                      0,
                    ),
                  )}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closePartialRefund}>
                Cancel
              </Button>
              <Button
                disabled={processingSaleId === partialRefundSale?.id}
                onClick={submitPartialRefund}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {processingSaleId === partialRefundSale?.id
                  ? "Processing..."
                  : "Complete Partial Refund"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}
