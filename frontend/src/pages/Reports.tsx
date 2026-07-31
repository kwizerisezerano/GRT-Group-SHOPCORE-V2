import { useState, useMemo } from "react";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useSales,
  useProducts,
  usePurchases,
  useExpenses,
} from "@/hooks/useSupabaseData";
import { isOnline } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  CreditCard,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  PieChart as PieChartIcon,
  Activity,
  Download,
  Receipt,
  Layers3,
  ShieldCheck,
  CalendarDays,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
  Database,
  Printer,
  FolderDown,
  FileSpreadsheet,
  Gauge,
  Target,
  Wallet,
  Banknote,
} from "lucide-react";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  subMonths,
  isWithinInterval,
} from "date-fns";
import { ExportMenu } from "@/components/ExportMenu";
import { formatCurrency } from "@/utils/currency";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import warehouseBg from "@/assets/bg-warehouse.jpg";

const BRAND = "#2563eb";

const BTN_PRIMARY = "bg-blue-600 text-white hover:bg-blue-700 border-blue-600";
const BTN_SUCCESS = "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600";
const BTN_WARNING = "bg-orange-600 text-white hover:bg-orange-700 border-orange-600";
const BTN_INFO = "bg-cyan-600 text-white hover:bg-cyan-700 border-cyan-600";
const BTN_PURPLE = "bg-violet-600 text-white hover:bg-violet-700 border-violet-600";
const FIELD_BLUE = "rounded-2xl border-blue-200 bg-blue-50 text-blue-700 placeholder:text-blue-700/70";


const PIE_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
  "#14b8a6",
  "#fb923c",
];

const salesChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "#2563eb" },
  profit: { label: "Profit", color: "#10b981" },
  loss: { label: "Loss", color: "#f43f5e" },
  orders: { label: "Orders", color: "#0ea5e9" },
};

const purchasesChartConfig: ChartConfig = {
  amount: { label: "Purchases", color: "#f59e0b" },
};

const expensesChartConfig: ChartConfig = {
  amount: { label: "Expenses", color: "#f43f5e" },
};

const overviewChartConfig: ChartConfig = {
  sales: { label: "Sales", color: "#10b981" },
  profit: { label: "Profit", color: "#0ea5e9" },
  loss: { label: "Loss", color: "#f43f5e" },
  purchases: { label: "Purchases", color: "#f59e0b" },
  expenses: { label: "Expenses", color: "#f43f5e" },
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

function getRecordDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value?: string | null) {
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

function formatDateShort(value?: string | null) {
  const date = getRecordDate(value);
  if (!date) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSaleDate(sale: any) {
  return (
    sale.date ||
    sale.created_offline_at ||
    sale.updated_offline_at ||
    sale.created_at ||
    new Date().toISOString()
  );
}

function getExpenseDate(expense: any) {
  return (
    expense.date ||
    expense.created_offline_at ||
    expense.updated_offline_at ||
    expense.created_at ||
    new Date().toISOString()
  );
}

function getPurchaseDate(purchase: any) {
  return (
    purchase.date ||
    purchase.created_offline_at ||
    purchase.updated_offline_at ||
    purchase.created_at ||
    new Date().toISOString()
  );
}

function isPendingSync(row: any) {
  const status = String(row?.sync_status || "").toLowerCase();
  return (
    String(row?.id || "").startsWith("offline-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    status.includes("pending")
  );
}

function isDeletedRecord(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function isArchivedProduct(row: any) {
  const status = String(row?.status || "active").toLowerCase();
  return (
    isDeletedRecord(row) ||
    ["inactive", "archived", "deleted", "pending_delete", "discontinued"].includes(status) ||
    Boolean(row?.archived_at || row?.deleted_at)
  );
}

function isApprovedExpense(row: any) {
  return !isDeletedRecord(row) && String(row?.status || "pending").toLowerCase() === "approved";
}

function getExpenseAccountingLabel(row: any) {
  return isApprovedExpense(row) ? "Approved Accounting Expense" : "Excluded From P&L";
}

function isRecordInside(
  value: string | null | undefined,
  interval: { start: Date; end: Date },
) {
  const date = getRecordDate(value);
  if (!date) return false;
  return isWithinInterval(date, interval);
}

function isSameReportDay(value: string | null | undefined, day: Date) {
  const date = getRecordDate(value);
  if (!date) return false;
  return format(date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
}

function getProductStock(product: any) {
  return Math.max(0, safeNumber(product?.stock ?? product?.stock_quantity));
}

function getProductReorderLevel(product: any) {
  return Math.max(
    0,
    safeNumber(
      product?.min_stock ?? product?.min_stock_level ?? product?.reorder_level,
    ),
  );
}

function getProductCost(product: any) {
  return safeNumber(
    product?.cost_price ?? product?.purchase_price ?? product?.unit_cost,
  );
}

function getProductPrice(product: any) {
  return safeNumber(
    product?.selling_price ?? product?.price ?? product?.sale_price,
  );
}

function getProductCategory(product: any) {
  return (
    product.category?.name ??
    product.category_name ??
    product.category ??
    "Uncategorized"
  );
}

function getProductBrand(product: any) {
  return product.brand?.name ?? product.brand_name ?? product.brand ?? "-";
}

function getSaleStatus(sale: any) {
  return String(sale?.status || sale?.refund_status || "").toLowerCase();
}

function getSaleItemsArray(sale: any) {
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

function getSaleItemCount(sale: any) {
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

function getSaleCostTotal(sale: any) {
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

function getSaleOriginalTotal(sale: any) {
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

function getSaleRefundedTotal(sale: any) {
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

function isSaleCancelledOrFullyRefunded(sale: any) {
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

function getSaleTotal(sale: any) {
  const originalTotal = getSaleOriginalTotal(sale);

  if (isSaleCancelledOrFullyRefunded(sale)) return 0;

  const refundedTotal = getSaleRefundedTotal(sale);
  return Math.max(originalTotal - refundedTotal, 0);
}

function getSaleGrossProfit(sale: any) {
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

function getDisplaySaleStatus(sale: any) {
  if (isSaleCancelledOrFullyRefunded(sale)) return "refunded";

  const refundedTotal = getSaleRefundedTotal(sale);
  if (refundedTotal > 0) return "partially_refunded";

  return sale.status || "completed";
}

function buildPeriodSummary(
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

function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  positive,
  color = "navy",
}: {
  label: string;
  value: string;
  change?: string;
  icon: any;
  positive?: boolean;
  color?: "navy" | "sky" | "emerald" | "amber" | "rose" | "purple" | "teal";
}) {
  const styles = {
    navy: {
      card: "bg-gradient-to-br from-blue-50 to-white border-blue-100",
      icon: "bg-blue-500/10 text-blue-700",
    },
    sky: {
      card: "bg-gradient-to-br from-sky-50 to-white border-sky-100",
      icon: "bg-sky-500/10 text-sky-600",
    },
    emerald: {
      card: "bg-gradient-to-br from-emerald-50 to-white border-emerald-100",
      icon: "bg-emerald-500/10 text-emerald-600",
    },
    amber: {
      card: "bg-gradient-to-br from-amber-50 to-white border-amber-100",
      icon: "bg-amber-500/10 text-amber-600",
    },
    rose: {
      card: "bg-gradient-to-br from-rose-50 to-white border-rose-100",
      icon: "bg-rose-500/10 text-rose-600",
    },
    purple: {
      card: "bg-gradient-to-br from-violet-50 to-white border-violet-100",
      icon: "bg-violet-500/10 text-violet-600",
    },
    teal: {
      card: "bg-gradient-to-br from-teal-50 to-white border-teal-100",
      icon: "bg-teal-500/10 text-teal-600",
    },
  };

  return (
    <Card
      className={`rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${styles[color].card}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          <div
            className={`h-11 w-11 rounded-2xl flex items-center justify-center ${styles[color].icon}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>

        <p
          className={`font-bold tracking-tight font-data leading-tight ${value.length > 16 ? "text-lg xl:text-xl break-words" : "text-2xl"}`}
        >
          {value}
        </p>

        {change && (
          <div
            className={`flex items-center gap-1.5 mt-2 text-xs font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}
          >
            {positive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {change}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PeriodCard({
  label,
  dateLabel,
  sales,
  profit,
  loss,
  expenses,
  orders,
  color,
  icon: Icon,
}: {
  label: string;
  dateLabel: string;
  sales: number;
  profit: number;
  loss: number;
  expenses: number;
  orders: number;
  color: "emerald" | "blue" | "violet" | "amber";
  icon: any;
}) {
  const styleMap = {
    emerald: {
      accent: "bg-emerald-500",
      soft: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
      text: "text-emerald-700",
    },
    blue: {
      accent: "bg-blue-500",
      soft: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      text: "text-blue-700",
    },
    violet: {
      accent: "bg-violet-500",
      soft: "bg-violet-500/10 text-violet-700 border-violet-500/20",
      text: "text-violet-700",
    },
    amber: {
      accent: "bg-amber-500",
      soft: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      text: "text-amber-700",
    },
  }[color];

  const netPosition = profit > 0 ? "Profit positive" : loss > 0 ? "Loss position" : "Neutral";

  return (
    <Card className="group relative overflow-hidden rounded-[1.75rem] border border-blue-200 bg-blue-50 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${styleMap.accent}`} />
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-muted/50 opacity-70 transition group-hover:scale-110" />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black tracking-tight">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel}</p>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${styleMap.soft}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sales</p>
              <p className={`mt-1 font-data text-2xl font-black leading-tight ${styleMap.text} ${formatCurrency(sales).length > 12 ? "text-xl break-words" : ""}`}>
                {formatCurrency(sales)}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full bg-background/80">
              {orders} orders
            </Badge>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] text-muted-foreground">Profit</p>
            <p className="mt-1 break-words font-data text-sm font-black text-emerald-700">
              {formatCurrency(profit)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] text-muted-foreground">Loss</p>
            <p className="mt-1 break-words font-data text-sm font-black text-rose-700">
              {formatCurrency(loss)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] text-muted-foreground">Expenses</p>
            <p className="mt-1 break-words font-data text-sm font-black">
              {formatCurrency(expenses)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Status</span>
          <span className={profit > 0 ? "font-semibold text-emerald-700" : loss > 0 ? "font-semibold text-rose-700" : "font-semibold"}>
            {netPosition}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-52 flex flex-col items-center justify-center text-center text-muted-foreground">
      <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function Reports() {
  const { data: sales, isLoading: loadingSales } = useSales();
  const { data: products, isLoading: loadingProducts } = useProducts();
  const { data: purchases, isLoading: loadingPurchases } = usePurchases();
  const { data: expenses, isLoading: loadingExpenses } = useExpenses();
  const [period, setPeriod] = useState("30");
  const offlineModeActive = !isOnline() || isOfflineMode();

  const isLoading =
    loadingSales || loadingProducts || loadingPurchases || loadingExpenses;

  const analytics = useMemo(() => {
    if (!sales || !products || !purchases || !expenses) return null;

    const days = parseInt(period);
    const now = new Date();

    const start = startOfDay(subDays(now, days - 1));
    const end = endOfDay(now);
    const interval = { start, end };

    const todayInterval = { start: startOfDay(now), end: endOfDay(now) };
    const yesterdayDate = subDays(now, 1);
    const yesterdayInterval = {
      start: startOfDay(yesterdayDate),
      end: endOfDay(yesterdayDate),
    };
    const weekInterval = {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
    const monthInterval = {
      start: startOfMonth(now),
      end: endOfMonth(now),
    };

    const activeSales = (sales ?? []).filter(
      (row: any) => !isDeletedRecord(row),
    );
    const activeProducts = (products ?? []).filter(
      (row: any) => !isArchivedProduct(row),
    );
    const activePurchases = (purchases ?? []).filter(
      (row: any) => !isDeletedRecord(row),
    );
    const activeExpenses = (expenses ?? []).filter(
      (row: any) => isApprovedExpense(row),
    );

    const periodSales = activeSales.filter((s) =>
      isRecordInside(getSaleDate(s), interval),
    );
    const periodPurchases = activePurchases.filter((p) =>
      isRecordInside(getPurchaseDate(p), interval),
    );
    const periodExpenses = activeExpenses.filter((e) =>
      isRecordInside(getExpenseDate(e), interval),
    );

    const pendingRecords = [
      ...activeSales,
      ...activeProducts,
      ...activePurchases,
      ...activeExpenses,
    ].filter(isPendingSync).length;

    const offlineRecords = [
      ...activeSales,
      ...activeProducts,
      ...activePurchases,
      ...activeExpenses,
    ].filter(isPendingSync).length;

    const todaySummary = buildPeriodSummary(
      activeSales,
      activeExpenses,
      todayInterval.start,
      todayInterval.end,
    );
    const yesterdaySummary = buildPeriodSummary(
      activeSales,
      activeExpenses,
      yesterdayInterval.start,
      yesterdayInterval.end,
    );
    const weekSummary = buildPeriodSummary(
      activeSales,
      activeExpenses,
      weekInterval.start,
      weekInterval.end,
    );
    const monthSummary = buildPeriodSummary(
      activeSales,
      activeExpenses,
      monthInterval.start,
      monthInterval.end,
    );
    const selectedSummary = buildPeriodSummary(
      activeSales,
      activeExpenses,
      interval.start,
      interval.end,
    );

    const todaySales = activeSales.filter((s) =>
      isRecordInside(getSaleDate(s), todayInterval),
    );
    const yesterdaySales = activeSales.filter((s) =>
      isRecordInside(getSaleDate(s), yesterdayInterval),
    );
    const weekSales = activeSales.filter((s) =>
      isRecordInside(getSaleDate(s), weekInterval),
    );
    const monthSales = activeSales.filter((s) =>
      isRecordInside(getSaleDate(s), monthInterval),
    );

    const totalRevenue = selectedSummary.sales;
    const totalOrders = periodSales.filter(
      (sale) => getSaleTotal(sale) > 0,
    ).length;
    const totalPurchaseValue = periodPurchases.reduce(
      (a, p) => a + safeNumber(p.total),
      0,
    );
    const totalExpenseValue = periodExpenses.reduce(
      (a, e) => a + safeNumber(e.amount),
      0,
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const profit = selectedSummary.netProfit;
    const loss = selectedSummary.loss;
    const profitMargin =
      totalRevenue > 0 ? (Math.max(profit, 0) / totalRevenue) * 100 : 0;

    const dailyDates = eachDayOfInterval(interval);

    const dailySales = dailyDates.map((d) => {
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);
      const summary = buildPeriodSummary(
        activeSales,
        activeExpenses,
        dayStart,
        dayEnd,
      );

      return {
        date: format(d, "dd MMM"),
        revenue: summary.sales,
        profit: summary.profit,
        loss: summary.loss,
        orders: summary.orders,
      };
    });

    const dailyPurchases = dailyDates.map((d) => {
      const dayPurchases = periodPurchases.filter((p) =>
        isSameReportDay(getPurchaseDate(p), d),
      );

      return {
        date: format(d, "dd MMM"),
        amount: dayPurchases.reduce((a, p) => a + safeNumber(p.total), 0),
      };
    });

    const monthStart = subMonths(now, 5);
    const months = eachMonthOfInterval({
      start: startOfMonth(monthStart),
      end: endOfMonth(now),
    });

    const monthlyOverview = months.map((m) => {
      const mInterval = { start: startOfMonth(m), end: endOfMonth(m) };
      const summary = buildPeriodSummary(
        activeSales,
        activeExpenses,
        mInterval.start,
        mInterval.end,
      );

      return {
        month: format(m, "MMM"),
        sales: summary.sales,
        profit: summary.profit,
        loss: summary.loss,
        purchases: activePurchases
          .filter((p) => isRecordInside(getPurchaseDate(p), mInterval))
          .reduce((a, p) => a + safeNumber(p.total), 0),
        expenses: activeExpenses
          .filter((e) => isRecordInside(getExpenseDate(e), mInterval))
          .reduce((a, e) => a + safeNumber(e.amount), 0),
      };
    });

    const paymentMethods = periodSales.reduce(
      (acc, s) => {
        const netTotal = getSaleTotal(s);
        if (netTotal <= 0) return acc;

        const method = s.payment_method || "cash";
        acc[method] = (acc[method] || 0) + netTotal;
        return acc;
      },
      {} as Record<string, number>,
    );

    const paymentPie = Object.entries(paymentMethods).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
      value,
    }));

    const expenseCategories = periodExpenses.reduce(
      (acc, e) => {
        const category = e.category || "Uncategorized";
        acc[category] = (acc[category] || 0) + safeNumber(e.amount);
        return acc;
      },
      {} as Record<string, number>,
    );

    const expensePie = Object.entries(expenseCategories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const totalProducts = activeProducts.length;
    const lowStock = activeProducts.filter((p) => {
      const stock = getProductStock(p);
      const reorder = getProductReorderLevel(p);
      const status = String(p.status || "active").toLowerCase();
      return (
        status !== "deleted" && reorder > 0 && stock > 0 && stock <= reorder
      );
    }).length;

    const outOfStock = activeProducts.filter((p) => {
      const stock = getProductStock(p);
      const status = String(p.status || "active").toLowerCase();
      return status !== "deleted" && stock <= 0;
    }).length;

    const inventoryValue = activeProducts.reduce(
      (a, p) => a + getProductCost(p) * getProductStock(p),
      0,
    );

    const topProducts = [...activeProducts]
      .sort(
        (a, b) =>
          getProductPrice(b) * getProductStock(b) -
          getProductPrice(a) * getProductStock(a),
      )
      .slice(0, 8)
      .map((p) => ({
        name: p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name,
        value: getProductPrice(p) * getProductStock(p),
        stock: getProductStock(p),
      }));

    const categoryStock = activeProducts.reduce(
      (acc, p) => {
        const category = getProductCategory(p);
        acc[category] = (acc[category] || 0) + getProductStock(p);
        return acc;
      },
      {} as Record<string, number>,
    );

    const categoryPie = Object.entries(categoryStock)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const purchaseStatuses = activePurchases.reduce(
      (acc, p) => {
        const status = p.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const purchaseStatusPie = Object.entries(purchaseStatuses).map(
      ([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }),
    );

    const recentSales = [...activeSales]
      .sort((a, b) => {
        const ad = getRecordDate(getSaleDate(a))?.getTime() || 0;
        const bd = getRecordDate(getSaleDate(b))?.getTime() || 0;
        return bd - ad;
      })
      .slice(0, 10);

    return {
      totalRevenue,
      totalOrders,
      totalPurchaseValue,
      totalExpenseValue,
      avgOrderValue,
      profit,
      loss,
      profitMargin,
      dailySales,
      monthlyOverview,
      paymentPie,
      expensePie,
      totalProducts,
      lowStock,
      outOfStock,
      inventoryValue,
      topProducts,
      categoryPie,
      purchaseStatusPie,
      dailyPurchases,
      todaySales,
      yesterdaySales,
      weekSales,
      monthSales,
      today: todaySummary,
      yesterday: yesterdaySummary,
      week: weekSummary,
      month: monthSummary,
      pendingRecords,
      offlineRecords,
      recentSales,
      rangeLabel: `${formatDateTime(start.toISOString())} - ${formatDateTime(end.toISOString())}`,
    };
  }, [sales, products, purchases, expenses, period]);

  if (isLoading) {
    return (
      <PageShell
        title="Reports & Analytics"
        description="Comprehensive business insights and performance metrics."
      >
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-3xl" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-3xl" />
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  if (!analytics) return null;

  const topSummaryCards = [
    {
      label: "Today Sales",
      value: formatCurrency(analytics.today.sales),
      helper: `${analytics.today.orders} orders`,
      icon: Clock,
      wrapper: "bg-rose-600 text-white border-rose-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Yesterday Sales",
      value: formatCurrency(analytics.yesterday.sales),
      helper: `${analytics.yesterday.orders} orders`,
      icon: CalendarDays,
      wrapper: "bg-emerald-600 text-white border-emerald-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "This Week Sales",
      value: formatCurrency(analytics.week.sales),
      helper: `${analytics.week.orders} orders`,
      icon: BarChart3,
      wrapper: "bg-orange-600 text-white border-orange-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "This Month Sales",
      value: formatCurrency(analytics.month.sales),
      helper: `${analytics.month.orders} orders`,
      icon: DollarSign,
      wrapper: "bg-violet-600 text-white border-violet-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
  ];

  const salesReportRows = (sales ?? [])
    .filter((row: any) => !isDeletedRecord(row))
    .map((s: any) => ({
      date: formatDateTime(getSaleDate(s)),
      invoice: s.invoice_no || s.receipt_no || "",
      customer: s.customer_name || "Walk-in Customer",
      items: getSaleItemCount(s).net,
      original_total: formatCurrency(getSaleOriginalTotal(s)),
      refunded: formatCurrency(getSaleRefundedTotal(s)),
      net_total: formatCurrency(getSaleTotal(s)),
      cost_total: formatCurrency(getSaleCostTotal(s)),
      gross_profit: formatCurrency(getSaleGrossProfit(s)),
      payment: s.payment_method || "cash",
      status: getDisplaySaleStatus(s),
    }));

  const expenseReportRows = (expenses ?? [])
    .filter((row: any) => isApprovedExpense(row))
    .map((e: any) => ({
      date: formatDateTime(getExpenseDate(e)),
      reference: e.reference || "",
      title: e.title || "",
      category: e.category || "Uncategorized",
      amount: formatCurrency(safeNumber(e.amount)),
      branch: e.branch || "",
      paid_to: e.paid_to || "",
      payment_method: e.payment_method || "",
      status: e.status || "",
      accounting_basis: getExpenseAccountingLabel(e),
      recurring: e.is_recurring ? "Yes" : "No",
    }));

  const purchaseReportRows = (purchases ?? [])
    .filter((row: any) => !isDeletedRecord(row))
    .map((p: any) => ({
      date: formatDateTime(getPurchaseDate(p)),
      reference: p.po_number || p.purchase_no || p.reference || "",
      supplier: p.supplier_name || p.supplier || "",
      subtotal: formatCurrency(safeNumber(p.subtotal)),
      tax: formatCurrency(safeNumber(p.tax)),
      total: formatCurrency(safeNumber(p.total)),
      paid: formatCurrency(safeNumber(p.paid)),
      due: formatCurrency(safeNumber(p.due)),
      status: p.status || "",
    }));

  const inventoryReportRows = (products ?? [])
    .filter((row: any) => !isArchivedProduct(row))
    .map((p: any) => ({
      sku: p.sku || "",
      name: p.name || "",
      category: getProductCategory(p),
      brand: getProductBrand(p),
      stock: getProductStock(p),
      reorder_level: getProductReorderLevel(p),
      cost: formatCurrency(getProductCost(p)),
      price: formatCurrency(getProductPrice(p)),
      stock_value: formatCurrency(getProductStock(p) * getProductCost(p)),
      potential_sales_value: formatCurrency(
        getProductStock(p) * getProductPrice(p),
      ),
      status: p.status || "",
    }));

  const financialReportRows = [
    { metric: "Today Sales", value: formatCurrency(analytics.today.sales) },
    { metric: "Today Profit", value: formatCurrency(analytics.today.profit) },
    { metric: "Today Loss", value: formatCurrency(analytics.today.loss) },
    {
      metric: "Yesterday Sales",
      value: formatCurrency(analytics.yesterday.sales),
    },
    { metric: "This Week Sales", value: formatCurrency(analytics.week.sales) },
    {
      metric: "This Month Sales",
      value: formatCurrency(analytics.month.sales),
    },
    {
      metric: "Selected Range Revenue",
      value: formatCurrency(analytics.totalRevenue),
    },
    {
      metric: "Selected Range Profit",
      value: formatCurrency(Math.max(analytics.profit, 0)),
    },
    { metric: "Selected Range Loss", value: formatCurrency(analytics.loss) },
    {
      metric: "Purchases",
      value: formatCurrency(analytics.totalPurchaseValue),
    },
    { metric: "Expenses", value: formatCurrency(analytics.totalExpenseValue) },
    {
      metric: "Inventory Value",
      value: formatCurrency(analytics.inventoryValue),
    },
    {
      metric: "Average Order Value",
      value: formatCurrency(analytics.avgOrderValue),
    },
    { metric: "Profit Margin", value: `${analytics.profitMargin.toFixed(1)}%` },
  ];


  const periodReportDefinitions = [
    {
      key: "daily",
      label: "Daily",
      filename: "daily_operations_report",
      title: "Daily Operations Report",
      buttonClass: BTN_PRIMARY,
      subtitle: `Business activity for ${format(new Date(), "dd MMM yyyy")}`,
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
    },
    {
      key: "weekly",
      label: "Weekly",
      filename: "weekly_operations_report",
      title: "Weekly Operations Report",
      buttonClass: BTN_SUCCESS,
      subtitle: `Business activity from ${format(startOfWeek(new Date(), { weekStartsOn: 1 }), "dd MMM yyyy")} to ${format(endOfWeek(new Date(), { weekStartsOn: 1 }), "dd MMM yyyy")}`,
      start: startOfWeek(new Date(), { weekStartsOn: 1 }),
      end: endOfWeek(new Date(), { weekStartsOn: 1 }),
    },
    {
      key: "monthly",
      label: "Monthly",
      filename: "monthly_operations_report",
      title: "Monthly Operations Report",
      buttonClass: BTN_PURPLE,
      subtitle: `Business activity for ${format(new Date(), "MMMM yyyy")}`,
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    },
    {
      key: "yearly",
      label: "Yearly",
      filename: "yearly_operations_report",
      title: "Yearly Operations Report",
      buttonClass: BTN_WARNING,
      subtitle: `Business activity for ${format(new Date(), "yyyy")}`,
      start: startOfYear(new Date()),
      end: endOfYear(new Date()),
    },
  ];

  const buildOperationsReportRows = (range: { start: Date; end: Date }) => {
    const rangeSales = (sales ?? []).filter((row: any) => !isDeletedRecord(row) && isRecordInside(getSaleDate(row), range));
    const rangePurchases = (purchases ?? []).filter((row: any) => !isDeletedRecord(row) && isRecordInside(getPurchaseDate(row), range));
    const rangeExpenses = (expenses ?? []).filter((row: any) => isApprovedExpense(row) && isRecordInside(getExpenseDate(row), range));
    const summary = buildPeriodSummary(rangeSales, rangeExpenses, range.start, range.end);
    const purchaseTotal = rangePurchases.reduce((sum: number, row: any) => sum + safeNumber(row.total), 0);
    const expenseTotal = rangeExpenses.reduce((sum: number, row: any) => sum + safeNumber(row.amount), 0);
    const pendingSync = [...rangeSales, ...rangePurchases, ...rangeExpenses].filter(isPendingSync).length;

    return [
      {
        section: "Executive Summary",
        metric: "Sales Revenue",
        value: formatCurrency(summary.sales),
        count: `${summary.orders} orders`,
        notes: "Net sales after cancelled and refunded transactions",
      },
      {
        section: "Executive Summary",
        metric: "Gross Profit",
        value: formatCurrency(summary.profit),
        count: `${rangeSales.length} sale records`,
        notes: "Calculated from sale item cost data where available",
      },
      {
        section: "Executive Summary",
        metric: "Loss Position",
        value: formatCurrency(summary.loss),
        count: summary.loss > 0 ? "Loss recorded" : "No loss",
        notes: "Loss after operating expenses",
      },
      {
        section: "Procurement",
        metric: "Purchase Value",
        value: formatCurrency(purchaseTotal),
        count: `${rangePurchases.length} purchase records`,
        notes: "Purchasing activity in selected reporting period",
      },
      {
        section: "Expenses",
        metric: "Approved Operating Expenses",
        value: formatCurrency(expenseTotal),
        count: `${rangeExpenses.length} expense records`,
        notes: "Approved expense activity used for profit and loss",
      },
      {
        section: "Inventory",
        metric: "Inventory Value",
        value: formatCurrency(analytics.inventoryValue),
        count: `${analytics.totalProducts} products`,
        notes: `${analytics.lowStock} low stock, ${analytics.outOfStock} out of stock`,
      },
      {
        section: "Connectivity",
        metric: "Pending Sync Records",
        value: String(pendingSync),
        count: offlineModeActive ? "Offline cache" : "Live data",
        notes: "Records waiting for branch synchronization",
      },
    ];
  };

  const buildOperationsSummary = (range: { start: Date; end: Date }) => {
    const rangeSales = (sales ?? []).filter((row: any) => !isDeletedRecord(row) && isRecordInside(getSaleDate(row), range));
    const rangePurchases = (purchases ?? []).filter((row: any) => !isDeletedRecord(row) && isRecordInside(getPurchaseDate(row), range));
    const rangeExpenses = (expenses ?? []).filter((row: any) => isApprovedExpense(row) && isRecordInside(getExpenseDate(row), range));
    const summary = buildPeriodSummary(rangeSales, rangeExpenses, range.start, range.end);
    const purchaseTotal = rangePurchases.reduce((sum: number, row: any) => sum + safeNumber(row.total), 0);

    return [
      { label: "Sales", value: formatCurrency(summary.sales) },
      { label: "Profit", value: formatCurrency(summary.profit) },
      { label: "Loss", value: formatCurrency(summary.loss) },
      { label: "Purchases", value: formatCurrency(purchaseTotal) },
      { label: "Expenses", value: formatCurrency(summary.expenses) },
      { label: "Orders", value: String(summary.orders) },
    ];
  };

  const exportOperationsReport = (
    definition: (typeof periodReportDefinitions)[number],
    formatType: "csv" | "pdf",
  ) => {
    const rows = buildOperationsReportRows({ start: definition.start, end: definition.end });
    const summary = buildOperationsSummary({ start: definition.start, end: definition.end });

    if (formatType === "csv") {
      exportToCSV(rows, definition.filename);
      return;
    }

    exportToPDF(rows, definition.filename, definition.title, undefined, {
      subtitle: definition.subtitle,
      summary,
    });
  };

  const exportFinancialPDF = () => {
    exportToPDF(
      financialReportRows,
      "financial_summary_report",
      "Financial Summary Report",
      undefined,
      {
        subtitle: `Business performance for the last ${period} days`,
        summary: [
          { label: "Revenue", value: formatCurrency(analytics.totalRevenue) },
          {
            label: "Profit",
            value: formatCurrency(Math.max(analytics.profit, 0)),
          },
          { label: "Loss", value: formatCurrency(analytics.loss) },
          {
            label: "Expenses",
            value: formatCurrency(analytics.totalExpenseValue),
          },
          {
            label: "Purchases",
            value: formatCurrency(analytics.totalPurchaseValue),
          },
        ],
      },
    );
  };

  const printExecutiveReport = () => {
    const html = `
      <html>
        <head>
          <title>ShopCore Executive Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            .brand { display:flex; align-items:center; justify-content:space-between; border-bottom: 3px solid ${BRAND}; padding-bottom: 14px; margin-bottom: 22px; }
            h1 { margin:0; color:${BRAND}; }
            .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin: 18px 0; }
            .card { border:1px solid #e5e7eb; border-radius:16px; padding:14px; }
            .label { font-size:11px; color:#6b7280; text-transform:uppercase; }
            .value { font-size:20px; font-weight:800; margin-top:6px; }
            table { width:100%; border-collapse:collapse; margin-top:18px; }
            th, td { border-bottom:1px solid #e5e7eb; text-align:left; padding:10px; font-size:12px; }
            th { background:#f8fafc; color:#334155; }
            @media print { body { padding: 12px; } .grid { grid-template-columns: repeat(2, 1fr); } }
          </style>
        </head>
        <body>
          <div class="brand">
            <div>
              <h1>ShopCore Executive Report</h1>
              <div>Period: Last ${period} days · Generated ${formatDateTime(new Date().toISOString())}</div>
            </div>
            <strong>Management Suite</strong>
          </div>
          <div class="grid">
            <div class="card"><div class="label">Revenue</div><div class="value">${formatCurrency(analytics.totalRevenue)}</div></div>
            <div class="card"><div class="label">Profit</div><div class="value">${formatCurrency(Math.max(analytics.profit, 0))}</div></div>
            <div class="card"><div class="label">Loss</div><div class="value">${formatCurrency(analytics.loss)}</div></div>
            <div class="card"><div class="label">Expenses</div><div class="value">${formatCurrency(analytics.totalExpenseValue)}</div></div>
            <div class="card"><div class="label">Purchases</div><div class="value">${formatCurrency(analytics.totalPurchaseValue)}</div></div>
            <div class="card"><div class="label">Inventory Value</div><div class="value">${formatCurrency(analytics.inventoryValue)}</div></div>
            <div class="card"><div class="label">Orders</div><div class="value">${analytics.totalOrders}</div></div>
            <div class="card"><div class="label">Profit Margin</div><div class="value">${analytics.profitMargin.toFixed(1)}%</div></div>
          </div>
          <h2>Financial Highlights</h2>
          <table>
            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>${financialReportRows.map((row) => `<tr><td>${row.metric}</td><td>${row.value}</td></tr>`).join("")}</tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <PageBackground image={warehouseBg} opacity={0.04}>
      <PageShell
        title="Reports & Analytics"
        description="Daily, weekly, monthly, yearly, financial, sales, purchase, expense, inventory, and operational reporting center."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
            {topSummaryCards.map((item) => (
              <div
                key={item.label}
                className={`group relative min-h-[112px] overflow-hidden rounded-[1.35rem] border px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${item.wrapper}`}
              >
                <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-white/10 transition group-hover:scale-110" />
                <div className="absolute right-5 top-7 h-2.5 w-2.5 rounded-full bg-white/35" />
                <div className="relative flex h-full items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.iconBox}`}>
                    <item.icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white/90">{item.label}</p>
                    <p className={`mt-1 font-data text-2xl font-black leading-tight ${item.valueColor} ${String(item.value).length > 12 ? "text-xl break-words" : ""}`}>
                      {item.value}
                    </p>
                    <Badge variant="outline" className="mt-2 rounded-full border-white/20 bg-white/20 px-3 py-0.5 text-xs font-semibold text-white hover:bg-white/20">
                      {item.helper}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1.5rem] border border-blue-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date Range</p>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 font-medium shadow-sm hover:border-slate-300 transition-colors">
                    <CalendarDays className="mr-2 h-4 w-4 text-slate-500" />
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                    <SelectItem value="1" className="rounded-lg">Today</SelectItem>
                    <SelectItem value="7" className="rounded-lg">Last 7 days</SelectItem>
                    <SelectItem value="30" className="rounded-lg">Last 30 days</SelectItem>
                    <SelectItem value="90" className="rounded-lg">Last 90 days</SelectItem>
                    <SelectItem value="365" className="rounded-lg">Last 12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Report Type</p>
                <Select defaultValue="sales-overview">
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 font-medium shadow-sm hover:border-slate-300 transition-colors">
                    <BarChart3 className="mr-2 h-4 w-4 text-slate-500" />
                    <SelectValue placeholder="Select report" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                    <SelectItem value="sales-overview" className="rounded-lg">Sales Overview</SelectItem>
                    <SelectItem value="financial-summary" className="rounded-lg">Financial Summary</SelectItem>
                    <SelectItem value="purchase-report" className="rounded-lg">Purchase Report</SelectItem>
                    <SelectItem value="expense-report" className="rounded-lg">Expense Report</SelectItem>
                    <SelectItem value="inventory-report" className="rounded-lg">Inventory Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Branch</p>
                <Select defaultValue="all">
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 font-medium shadow-sm hover:border-slate-300 transition-colors">
                    <Layers3 className="mr-2 h-4 w-4 text-slate-500" />
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                    <SelectItem value="all" className="rounded-lg">All Branches</SelectItem>
                    <SelectItem value="main" className="rounded-lg">Main Branch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className={`h-12 rounded-2xl px-6 ${BTN_PRIMARY}`}
                onClick={printExecutiveReport}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Generate Report
              </Button>

              <ExportMenu
                label="Export Report"
                onCSV={() => exportToCSV(financialReportRows, "financial_summary_report")}
                onPDF={exportFinancialPDF}
              />
            </div>
          </div>
          {(analytics.pendingRecords > 0 || offlineModeActive) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-800 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {analytics.pendingRecords > 0 ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <Database className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {offlineModeActive
                        ? "Reports are using cached offline data"
                        : "Some offline records are waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending records: {analytics.pendingRecords}.
                      Offline-created/edited records in this report:{" "}
                      {analytics.offlineRecords}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.95fr]">
            <Card className="rounded-[1.35rem] border border-blue-100 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base font-black">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                  Sales Overview
                </CardTitle>
                <CardDescription>Selected period sales, orders, average order value, and growth signals.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-700">Total Sales</p>
                    <p className="font-data text-lg font-black">{formatCurrency(analytics.totalRevenue)}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-semibold text-blue-700">Total Orders</p>
                    <p className="font-data text-lg font-black">{analytics.totalOrders}</p>
                  </div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
                    <p className="text-xs font-semibold text-violet-700">Average Order</p>
                    <p className="font-data text-lg font-black">{formatCurrency(analytics.avgOrderValue)}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-xs font-semibold text-cyan-700">Margin</p>
                    <p className="font-data text-lg font-black">{analytics.profitMargin.toFixed(1)}%</p>
                  </div>
                </div>
                <ChartContainer config={salesChartConfig} className="h-[250px] w-full">
                  <LineChart data={analytics.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="orders" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-[1.35rem] border border-blue-100 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-base font-black">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-700">
                        <PieChartIcon className="h-5 w-5" />
                      </span>
                      Sales by Category
                    </CardTitle>
                    <CardDescription>Revenue distribution by payment activity.</CardDescription>
                  </div>
                  <Select defaultValue="top">
                    <SelectTrigger className="h-10 w-36 rounded-2xl border-blue-200 bg-blue-50 text-xs text-blue-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top Categories</SelectItem>
                      <SelectItem value="all">All Activity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {analytics.paymentPie.length > 0 ? (
                  <div className="grid items-center gap-4 lg:grid-cols-[0.9fr_1fr]">
                    <ChartContainer config={salesChartConfig} className="h-[260px] w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie data={analytics.paymentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92} innerRadius={0}>
                          {analytics.paymentPie.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="space-y-4">
                      {analytics.paymentPie.slice(0, 5).map((item, i) => {
                        const total = analytics.paymentPie.reduce((sum, row) => sum + safeNumber(row.value), 0);
                        const percent = total > 0 ? Math.round((safeNumber(item.value) / total) * 100) : 0;
                        return (
                          <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span>{item.name}</span>
                            </div>
                            <span className="font-data font-bold">{percent}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No sales distribution available" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="rounded-[1.35rem] border border-orange-100 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base font-black">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-700">
                    <Receipt className="h-5 w-5" />
                  </span>
                  Purchases Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3"><p className="text-xs text-orange-700">Total Purchases</p><p className="font-data font-black">{formatCurrency(analytics.totalPurchaseValue)}</p></div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3"><p className="text-xs text-blue-700">Bills</p><p className="font-data font-black">{(purchases ?? []).length}</p></div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3"><p className="text-xs text-violet-700">Growth</p><p className="font-data font-black">0%</p></div>
                </div>
                <ChartContainer config={purchasesChartConfig} className="h-[180px] w-full">
                  <AreaChart data={analytics.dailyPurchases}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="amount" stroke="#f97316" fill="#fed7aa" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-[1.35rem] border border-rose-100 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base font-black">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-700">
                    <Wallet className="h-5 w-5" />
                  </span>
                  Expenses Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3"><p className="text-xs text-rose-700">Total Expenses</p><p className="font-data font-black">{formatCurrency(analytics.totalExpenseValue)}</p></div>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3"><p className="text-xs text-orange-700">Payments</p><p className="font-data font-black">{(expenses ?? []).length}</p></div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3"><p className="text-xs text-violet-700">Growth</p><p className="font-data font-black">0%</p></div>
                </div>
                <ChartContainer config={expensesChartConfig} className="h-[180px] w-full">
                  <AreaChart data={analytics.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="loss" stroke="#e11d48" fill="#fecdd3" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-[1.35rem] border border-emerald-100 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base font-black">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                  Profit Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Total Profit</p><p className="font-data font-black">{formatCurrency(Math.max(analytics.profit, 0))}</p></div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3"><p className="text-xs text-cyan-700">Margin</p><p className="font-data font-black">{analytics.profitMargin.toFixed(1)}%</p></div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3"><p className="text-xs text-violet-700">Growth</p><p className="font-data font-black">0%</p></div>
                </div>
                <ChartContainer config={salesChartConfig} className="h-[180px] w-full">
                  <AreaChart data={analytics.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="profit" stroke="#16a34a" fill="#bbf7d0" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-[1.75rem] border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-700">
                  <Gauge className="h-3.5 w-3.5" />
                  Performance Snapshot
                </div>
                <h3 className="mt-2 text-xl font-black tracking-tight">Download Center</h3>
                <p className="text-sm text-muted-foreground">
                  Download daily, weekly, monthly, yearly, sales, inventory, financial, purchase, expense, and executive reports.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
              <ExportMenu
                label="Export Sales"
                onCSV={() => {
                  const rows = (sales ?? [])
                    .filter((row: any) => !isDeletedRecord(row))
                    .map((s) => ({
                      date: formatDateTime(getSaleDate(s)),
                      invoice: s.invoice_no,
                      customer: s.customer_name,
                      items: s.items,
                      subtotal: formatCurrency(s.subtotal),
                      tax: formatCurrency(s.tax),
                      discount: formatCurrency(s.discount),
                      original_total: formatCurrency(getSaleOriginalTotal(s)),
                      refunded: formatCurrency(getSaleRefundedTotal(s)),
                      net_total: formatCurrency(getSaleTotal(s)),
                      cost_total: formatCurrency(getSaleCostTotal(s)),
                      gross_profit: formatCurrency(getSaleGrossProfit(s)),
                      paid: formatCurrency(s.paid),
                      due: formatCurrency(s.due),
                      payment: s.payment_method,
                      status: getDisplaySaleStatus(s),
                    }));
                  exportToCSV(rows, "sales_report");
                }}
                onPDF={() => {
                  const rows = (sales ?? [])
                    .filter((row: any) => !isDeletedRecord(row))
                    .map((s) => ({
                      date: formatDateTime(getSaleDate(s)),
                      invoice: s.invoice_no,
                      customer: s.customer_name,
                      original_total: formatCurrency(getSaleOriginalTotal(s)),
                      refunded: formatCurrency(getSaleRefundedTotal(s)),
                      net_total: formatCurrency(getSaleTotal(s)),
                      cost_total: formatCurrency(getSaleCostTotal(s)),
                      profit: formatCurrency(getSaleGrossProfit(s)),
                      paid: formatCurrency(s.paid),
                      due: formatCurrency(s.due),
                      status: getDisplaySaleStatus(s),
                    }));

                  exportToPDF(rows, "sales_report", "Sales Report", undefined, {
                    subtitle: `Period: last ${period} days`,
                    summary: [
                      {
                        label: "Today Sales",
                        value: formatCurrency(analytics.today.sales),
                      },
                      {
                        label: "Today Profit",
                        value: formatCurrency(analytics.today.profit),
                      },
                      {
                        label: "Today Loss",
                        value: formatCurrency(analytics.today.loss),
                      },
                      {
                        label: "Yesterday Sales",
                        value: formatCurrency(analytics.yesterday.sales),
                      },
                      {
                        label: "Yesterday Profit",
                        value: formatCurrency(analytics.yesterday.profit),
                      },
                      {
                        label: "Yesterday Loss",
                        value: formatCurrency(analytics.yesterday.loss),
                      },
                      {
                        label: "Week Sales",
                        value: formatCurrency(analytics.week.sales),
                      },
                      {
                        label: "Week Profit",
                        value: formatCurrency(analytics.week.profit),
                      },
                      {
                        label: "Week Loss",
                        value: formatCurrency(analytics.week.loss),
                      },
                      {
                        label: "Month Sales",
                        value: formatCurrency(analytics.month.sales),
                      },
                      {
                        label: "Month Profit",
                        value: formatCurrency(analytics.month.profit),
                      },
                      {
                        label: "Month Loss",
                        value: formatCurrency(analytics.month.loss),
                      },
                    ],
                  });
                }}
              />

              <ExportMenu
                label="Export Inventory"
                onCSV={() => {
                  const rows = (products ?? [])
                    .filter((row: any) => !isArchivedProduct(row))
                    .map((p) => ({
                      sku: p.sku,
                      name: p.name,
                      category: getProductCategory(p),
                      brand: getProductBrand(p),
                      stock: getProductStock(p),
                      reorder_level: getProductReorderLevel(p),
                      cost: getProductCost(p),
                      price: getProductPrice(p),
                      value: (getProductStock(p) * getProductCost(p)).toFixed(
                        2,
                      ),
                      status: p.status,
                    }));
                  exportToCSV(rows, "inventory_report");
                }}
                onPDF={() => {
                  const rows = (products ?? [])
                    .filter((row: any) => !isArchivedProduct(row))
                    .map((p) => ({
                      sku: p.sku,
                      name: p.name,
                      category: getProductCategory(p),
                      stock: getProductStock(p),
                      cost: formatCurrency(getProductCost(p)),
                      price: formatCurrency(getProductPrice(p)),
                      value: formatCurrency(
                        getProductStock(p) * getProductCost(p),
                      ),
                    }));

                  exportToPDF(rows, "inventory_report", "Inventory Report");
                }}
              />

              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className={FIELD_BLUE}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Today</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last 12 months</SelectItem>
                </SelectContent>
              </Select>

              {periodReportDefinitions.map((definition) => (
                <div key={definition.key} className="flex gap-2">
                  <Button
                    className={`rounded-2xl gap-2 ${definition.buttonClass}`}
                    onClick={() => exportOperationsReport(definition, "csv")}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {definition.label} CSV
                  </Button>
                  <Button
                    className={`rounded-2xl gap-2 ${definition.buttonClass}`}
                    onClick={() => exportOperationsReport(definition, "pdf")}
                  >
                    <FolderDown className="w-4 h-4" />
                    {definition.label} PDF
                  </Button>
                </div>
              ))}

              <Button
                className={`rounded-2xl gap-2 ${BTN_INFO}`}
                onClick={() =>
                  exportToCSV(financialReportRows, "financial_summary_report")
                }
              >
                <FileSpreadsheet className="w-4 h-4" />
                Financial CSV
              </Button>

              <Button
                className={`rounded-2xl gap-2 ${BTN_PURPLE}`}
                onClick={exportFinancialPDF}
              >
                <FolderDown className="w-4 h-4" />
                Financial PDF
              </Button>

              <Button
                className={`rounded-2xl gap-2 ${BTN_PRIMARY}`}
                onClick={printExecutiveReport}
              >
                <Printer className="w-4 h-4" />
                Print Executive
              </Button>
            </div>
          </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Selected Range Revenue"
              value={formatCurrency(analytics.totalRevenue)}
              icon={DollarSign}
              change={`${analytics.totalOrders} orders`}
              positive
              color="emerald"
            />
            <KpiCard
              label="Selected Range Profit"
              value={formatCurrency(Math.max(analytics.profit, 0))}
              icon={TrendingUp}
              positive={analytics.profit >= 0}
              change={analytics.profit >= 0 ? "Profitable" : "No profit"}
              color={analytics.profit >= 0 ? "purple" : "rose"}
            />
            <KpiCard
              label="Selected Range Loss"
              value={formatCurrency(analytics.loss)}
              icon={TrendingDown}
              positive={analytics.loss === 0}
              change={analytics.loss > 0 ? "Loss position" : "No loss"}
              color={analytics.loss > 0 ? "rose" : "emerald"}
            />
            <KpiCard
              label="Average Order"
              value={formatCurrency(analytics.avgOrderValue)}
              icon={ShoppingCart}
              change="Sales efficiency"
              positive
              color="sky"
            />
          </div>

          <Tabs defaultValue="sales" className="space-y-5">
            <TabsList className="h-auto flex flex-wrap justify-start rounded-3xl border border-blue-200 bg-blue-50 p-1">
              <TabsTrigger value="sales" className="rounded-2xl gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <TrendingUp className="w-4 h-4" />
                Sales
              </TabsTrigger>
              <TabsTrigger value="recent" className="rounded-2xl gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Clock className="w-4 h-4" />
                Recent Sales
              </TabsTrigger>
              <TabsTrigger value="financial" className="rounded-2xl gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Gauge className="w-4 h-4" />
                Financial
              </TabsTrigger>
              <TabsTrigger value="purchases" className="rounded-2xl gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Receipt className="w-4 h-4" />
                Purchases
              </TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-2xl gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Wallet className="w-4 h-4" />
                Expenses
              </TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-2xl gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Package className="w-4 h-4" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="overview" className="rounded-2xl gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Activity className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="exports" className="rounded-2xl gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Download className="w-4 h-4" />
                Export Center
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="space-y-4">
              <div className="grid lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-700" />
                      Sales, Profit & Loss Trend
                    </CardTitle>
                    <CardDescription>
                      Daily revenue, profit, and loss over the selected period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={salesChartConfig}
                      className="h-[320px] w-full"
                    >
                      <AreaChart data={analytics.dailySales}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatCurrency(v)}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <defs>
                          <linearGradient
                            id="fillRevenue"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={BRAND}
                              stopOpacity={0.32}
                            />
                            <stop
                              offset="95%"
                              stopColor={BRAND}
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="fillProfit"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.28}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="fillLoss"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f43f5e"
                              stopOpacity={0.22}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f43f5e"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke={BRAND}
                          fill="url(#fillRevenue)"
                          strokeWidth={3}
                        />
                        <Area
                          type="monotone"
                          dataKey="profit"
                          stroke="#10b981"
                          fill="url(#fillProfit)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="loss"
                          stroke="#f43f5e"
                          fill="url(#fillLoss)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-sky-600" />
                      Payment Methods
                    </CardTitle>
                    <CardDescription>Revenue by payment type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.paymentPie.length > 0 ? (
                      <>
                        <ChartContainer
                          config={salesChartConfig}
                          className="h-[250px] w-full"
                        >
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={analytics.paymentPie}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={88}
                              innerRadius={52}
                              paddingAngle={3}
                            >
                              {analytics.paymentPie.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>

                        <div className="space-y-2 mt-3">
                          {analytics.paymentPie.map((item, i) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      PIE_COLORS[i % PIE_COLORS.length],
                                  }}
                                />
                                <span>{item.name}</span>
                              </div>
                              <span className="font-data font-semibold">
                                {formatCurrency(item.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyState message="No sales data available" />
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Today Orders</CardTitle>
                  <CardDescription>Number of orders per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={salesChartConfig}
                    className="h-[230px] w-full"
                  >
                    <BarChart data={analytics.dailySales}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="orders"
                        fill="#0ea5e9"
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recent" className="space-y-4">
              <Card className="rounded-3xl border shadow-sm overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base">
                    Recent Sales History
                  </CardTitle>
                  <CardDescription>
                    Saved sales records used for daily, weekly, and monthly
                    reports.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="grid grid-cols-12 gap-4 px-5 py-3 border-y bg-blue-50 text-xs font-medium text-muted-foreground uppercase">
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Invoice</div>
                    <div className="col-span-3">Customer</div>
                    <div className="col-span-2">Payment</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>

                  {analytics.recentSales.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      No recent sales found
                    </div>
                  ) : (
                    analytics.recentSales.map((s) => (
                      <div
                        key={s.id}
                        className="grid grid-cols-12 gap-4 px-5 py-4 border-b last:border-b-0 items-center text-sm hover:bg-cyan-50 transition"
                      >
                        <div className="col-span-2 text-muted-foreground">
                          {formatDateShort(getSaleDate(s))}
                        </div>
                        <div className="col-span-2 font-data text-xs">
                          {s.invoice_no || "-"}
                        </div>
                        <div className="col-span-3 truncate">
                          {s.customer_name || "Walk-in Customer"}
                        </div>
                        <div className="col-span-2 capitalize">
                          {s.payment_method || "cash"}
                        </div>
                        <div className="col-span-1">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              getDisplaySaleStatus(s).includes("refund") ||
                              getDisplaySaleStatus(s).includes("cancel")
                                ? "bg-rose-500/10 text-rose-600"
                                : getDisplaySaleStatus(s).includes("partial")
                                  ? "bg-orange-500/10 text-orange-600"
                                  : "bg-emerald-500/10 text-emerald-600"
                            }`}
                          >
                            {getDisplaySaleStatus(s)}
                          </span>
                        </div>
                        <div className="col-span-2 text-right font-data font-semibold">
                          {formatCurrency(getSaleTotal(s))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                <KpiCard
                  label="Gross Revenue"
                  value={formatCurrency(analytics.totalRevenue)}
                  icon={Banknote}
                  color="emerald"
                />
                <KpiCard
                  label="Gross Profit"
                  value={formatCurrency(Math.max(analytics.profit, 0))}
                  icon={TrendingUp}
                  color="purple"
                  positive
                  change={`${analytics.profitMargin.toFixed(1)}% margin`}
                />
                <KpiCard
                  label="Approved Operating Expenses"
                  value={formatCurrency(analytics.totalExpenseValue)}
                  icon={Wallet}
                  color="rose"
                />
                <KpiCard
                  label="Purchase Spend"
                  value={formatCurrency(analytics.totalPurchaseValue)}
                  icon={ShoppingCart}
                  color="amber"
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-blue-700" />
                      Financial Control Trend
                    </CardTitle>
                    <CardDescription>
                      Monthly sales, profit, loss, purchases, and expenses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={overviewChartConfig}
                      className="h-[360px] w-full"
                    >
                      <AreaChart data={analytics.monthlyOverview}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatCurrency(v)}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <defs>
                          <linearGradient
                            id="financialSales"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.28}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="financialExpenses"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f43f5e"
                              stopOpacity={0.22}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f43f5e"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke="#10b981"
                          fill="url(#financialSales)"
                          strokeWidth={3}
                        />
                        <Area
                          type="monotone"
                          dataKey="expenses"
                          stroke="#f43f5e"
                          fill="url(#financialExpenses)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="profit"
                          stroke="#0ea5e9"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="loss"
                          stroke="#f43f5e"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-600" />
                      Smart Financial Health
                    </CardTitle>
                    <CardDescription>
                      Management-ready financial observations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-2xl border bg-cyan-50 p-4">
                      <p className="text-xs text-muted-foreground">
                        Profit Margin
                      </p>
                      <p className="text-3xl font-black font-data">
                        {analytics.profitMargin.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-cyan-50 p-4">
                      <p className="text-xs text-muted-foreground">
                        Cost Pressure
                      </p>
                      <p className="font-bold">
                        {analytics.totalRevenue > 0 &&
                        analytics.totalExpenseValue / analytics.totalRevenue >
                          0.45
                          ? "High expenses"
                          : analytics.totalRevenue === 0
                            ? "No revenue"
                            : "Controlled"}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-cyan-50 p-4">
                      <p className="text-xs text-muted-foreground">
                        Recommended Focus
                      </p>
                      <p className="font-bold">
                        {analytics.lowStock > 0
                          ? "Restock low inventory"
                          : analytics.loss > 0
                            ? "Reduce loss drivers"
                            : "Scale profitable lines"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="purchases" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  label="Total POs"
                  value={String(
                    (purchases ?? []).filter(
                      (row: any) => !isDeletedRecord(row),
                    ).length,
                  )}
                  icon={ShoppingCart}
                  color="sky"
                />
                <KpiCard
                  label="Total Due"
                  value={formatCurrency(
                    (purchases ?? [])
                      .filter((row: any) => !isDeletedRecord(row))
                      .reduce((a, p) => a + safeNumber(p.due), 0),
                  )}
                  icon={CreditCard}
                  color="rose"
                />
                <KpiCard
                  label="Received"
                  value={String(
                    (purchases ?? []).filter(
                      (p: any) =>
                        !isDeletedRecord(p) && p.status === "received",
                    ).length,
                  )}
                  icon={Package}
                  positive
                  change="Completed"
                  color="emerald"
                />
                <KpiCard
                  label="Pending"
                  value={String(
                    (purchases ?? []).filter(
                      (p: any) => !isDeletedRecord(p) && p.status === "ordered",
                    ).length,
                  )}
                  icon={BarChart3}
                  change="Awaiting receiving"
                  color="amber"
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Purchase Spending
                    </CardTitle>
                    <CardDescription>Daily purchase amounts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={purchasesChartConfig}
                      className="h-[320px] w-full"
                    >
                      <AreaChart data={analytics.dailyPurchases}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatCurrency(v)}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <defs>
                          <linearGradient
                            id="fillPurchases"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f59e0b"
                              stopOpacity={0.34}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f59e0b"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="amount"
                          stroke="#f59e0b"
                          fill="url(#fillPurchases)"
                          strokeWidth={3}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Purchase Status</CardTitle>
                    <CardDescription>Breakdown by PO status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.purchaseStatusPie.length > 0 ? (
                      <>
                        <ChartContainer
                          config={purchasesChartConfig}
                          className="h-[250px] w-full"
                        >
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={analytics.purchaseStatusPie}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={88}
                              innerRadius={52}
                              paddingAngle={3}
                            >
                              {analytics.purchaseStatusPie.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>

                        <div className="space-y-2 mt-3">
                          {analytics.purchaseStatusPie.map((item, i) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      PIE_COLORS[i % PIE_COLORS.length],
                                  }}
                                />
                                <span>{item.name}</span>
                              </div>
                              <span className="font-data font-semibold">
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyState message="No purchase data available" />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  label="Total Expenses"
                  value={formatCurrency(analytics.totalExpenseValue)}
                  icon={Wallet}
                  color="rose"
                />
                <KpiCard
                  label="Expense Categories"
                  value={String(analytics.expensePie.length)}
                  icon={PieChartIcon}
                  color="purple"
                />
                <KpiCard
                  label="Pending Sync"
                  value={String(analytics.pendingRecords)}
                  icon={Database}
                  color={analytics.pendingRecords > 0 ? "amber" : "emerald"}
                />
                <KpiCard
                  label="Range Loss"
                  value={formatCurrency(analytics.loss)}
                  icon={TrendingDown}
                  color={analytics.loss > 0 ? "rose" : "emerald"}
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Expense Category Ranking
                    </CardTitle>
                    <CardDescription>
                      Highest cost categories in the selected period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.expensePie.length > 0 ? (
                      <ChartContainer
                        config={expensesChartConfig}
                        className="h-[330px] w-full"
                      >
                        <BarChart
                          data={analytics.expensePie.slice(0, 10)}
                          layout="vertical"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-border"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => formatCurrency(v)}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={140}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="value"
                            fill="#f43f5e"
                            radius={[0, 10, 10, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <EmptyState message="No expense data available" />
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Expense Mix</CardTitle>
                    <CardDescription>
                      Part-to-whole expense distribution
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.expensePie.length > 0 ? (
                      <>
                        <ChartContainer
                          config={expensesChartConfig}
                          className="h-[240px] w-full"
                        >
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={analytics.expensePie.slice(0, 6)}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={84}
                              innerRadius={48}
                              paddingAngle={3}
                            >
                              {analytics.expensePie.slice(0, 6).map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                        <div className="space-y-2 mt-3">
                          {analytics.expensePie.slice(0, 6).map((item, i) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      PIE_COLORS[i % PIE_COLORS.length],
                                  }}
                                />
                                <span className="truncate">{item.name}</span>
                              </div>
                              <span className="font-data font-semibold">
                                {formatCurrency(item.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyState message="No expenses recorded" />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  label="Total Products"
                  value={String(analytics.totalProducts)}
                  icon={Package}
                  color="navy"
                />
                <KpiCard
                  label="Inventory Value"
                  value={formatCurrency(analytics.inventoryValue)}
                  icon={DollarSign}
                  color="teal"
                />
                <KpiCard
                  label="Low Stock"
                  value={String(analytics.lowStock)}
                  icon={TrendingDown}
                  positive={analytics.lowStock === 0}
                  change={
                    analytics.lowStock > 0 ? "Needs attention" : "All good"
                  }
                  color="amber"
                />
                <KpiCard
                  label="Out of Stock"
                  value={String(analytics.outOfStock)}
                  icon={Package}
                  positive={analytics.outOfStock === 0}
                  change={analytics.outOfStock > 0 ? "Critical" : "All stocked"}
                  color="rose"
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Top Products by Value
                    </CardTitle>
                    <CardDescription>
                      Highest value items in inventory
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.topProducts.length > 0 ? (
                      <ChartContainer
                        config={{ value: { label: "Value", color: BRAND } }}
                        className="h-[330px] w-full"
                      >
                        <BarChart
                          data={analytics.topProducts}
                          layout="vertical"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-border"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => formatCurrency(v)}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={130}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="value"
                            fill={BRAND}
                            radius={[0, 10, 10, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <EmptyState message="No products available" />
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Stock by Category
                    </CardTitle>
                    <CardDescription>Units per category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.categoryPie.length > 0 ? (
                      <>
                        <ChartContainer
                          config={{
                            stock: { label: "Stock", color: "#14b8a6" },
                          }}
                          className="h-[250px] w-full"
                        >
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={analytics.categoryPie}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={88}
                              innerRadius={52}
                              paddingAngle={3}
                            >
                              {analytics.categoryPie.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>

                        <div className="space-y-2 mt-3">
                          {analytics.categoryPie.slice(0, 6).map((item, i) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      PIE_COLORS[i % PIE_COLORS.length],
                                  }}
                                />
                                <span className="truncate">{item.name}</span>
                              </div>
                              <span className="font-data font-semibold">
                                {item.value.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyState message="No inventory data available" />
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Expenses by Category
                  </CardTitle>
                  <CardDescription>
                    Spending distribution across categories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.expensePie.length > 0 ? (
                    <ChartContainer
                      config={expensesChartConfig}
                      className="h-[250px] w-full"
                    >
                      <BarChart data={analytics.expensePie.slice(0, 10)}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatCurrency(v)}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="value"
                          fill="#f43f5e"
                          radius={[10, 10, 0, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <EmptyState message="No expenses recorded" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overview" className="space-y-4">
              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    6-Month Business Overview
                  </CardTitle>
                  <CardDescription>
                    Sales, profit, loss, purchases, and expenses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={overviewChartConfig}
                    className="h-[380px] w-full"
                  >
                    <LineChart data={analytics.monthlyOverview}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatCurrency(v)}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="#0ea5e9"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="loss"
                        stroke="#f43f5e"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="purchases"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expenses"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-3 gap-4">
                <Card className="rounded-3xl border shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <p className="font-semibold">Profit Health</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Current profit margin is{" "}
                      <span className="font-semibold text-foreground">
                        {analytics.profitMargin.toFixed(1)}%
                      </span>
                      .
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="font-semibold">Report Coverage</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Includes Today, Yesterday, This Week, This Month, selected
                      range sales, profit, loss, inventory, purchases, expenses,
                      payment methods, sync-aware offline data, and trend
                      analytics.
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                        <Download className="w-5 h-5" />
                      </div>
                      <p className="font-semibold">Exports Ready</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sales and inventory reports can be exported as CSV or PDF
                      for management review.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="exports" className="space-y-4">
              <Card className="rounded-3xl border shadow-sm overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="w-4 h-4 text-blue-700" />
                    Report Download Center
                  </CardTitle>
                  <CardDescription>
                    Download management, sales, inventory, purchase, expense,
                    and financial reports.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[
                      {
                        title: "Financial Summary",
                        desc: "Revenue, profit, loss, expenses, purchases, margin",
                        csv: () =>
                          exportToCSV(
                            financialReportRows,
                            "financial_summary_report",
                          ),
                        pdf: exportFinancialPDF,
                        icon: Gauge,
                      },
                      {
                        title: "Sales Report",
                        desc: "Invoices, refunds, profit, payments, status",
                        csv: () => exportToCSV(salesReportRows, "sales_report"),
                        pdf: () =>
                          exportToPDF(
                            salesReportRows,
                            "sales_report",
                            "Sales Report",
                          ),
                        icon: Receipt,
                      },
                      {
                        title: "Inventory Report",
                        desc: "Stock, reorder, cost, price, inventory value",
                        csv: () =>
                          exportToCSV(inventoryReportRows, "inventory_report"),
                        pdf: () =>
                          exportToPDF(
                            inventoryReportRows,
                            "inventory_report",
                            "Inventory Report",
                          ),
                        icon: Package,
                      },
                      {
                        title: "Purchase Report",
                        desc: "Purchase orders, supplier spend, paid and due",
                        csv: () =>
                          exportToCSV(purchaseReportRows, "purchase_report"),
                        pdf: () =>
                          exportToPDF(
                            purchaseReportRows,
                            "purchase_report",
                            "Purchase Report",
                          ),
                        icon: ShoppingCart,
                      },
                      {
                        title: "Expense Report",
                        desc: "Expense records, categories, payment methods, status",
                        csv: () =>
                          exportToCSV(expenseReportRows, "expense_report"),
                        pdf: () =>
                          exportToPDF(
                            expenseReportRows,
                            "expense_report",
                            "Expense Report",
                          ),
                        icon: Wallet,
                      },
                      {
                        title: "Executive Print",
                        desc: "Printable one-page executive business report",
                        csv: () =>
                          exportToCSV(financialReportRows, "executive_summary"),
                        pdf: printExecutiveReport,
                        icon: Printer,
                      },
                    ].map((report) => {
                      const Icon = report.icon;
                      return (
                        <div
                          key={report.title}
                          className="rounded-3xl border bg-violet-50 p-5 hover:bg-cyan-50 transition"
                        >
                          <div className="mb-4 flex items-start gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold">{report.title}</h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {report.desc}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-2xl flex-1"
                              onClick={report.csv}
                            >
                              CSV
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-2xl flex-1"
                                            onClick={report.pdf}
                            >
                              PDF / Print
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PageShell>
    </PageBackground>
  );
}
