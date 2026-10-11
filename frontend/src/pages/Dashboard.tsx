import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageBackground } from "@/components/PageBackground";
import {
  useSales,
  useProducts,
  usePurchases,
  useExpenses,
  useCustomers,
} from "@/hooks/useSupabaseData";
import { useStockMovements } from "@/hooks/useStockMovements";
import { Button } from "@/components/ui/button";
import {
  PageContainer,
  StatGrid,
  SectionCard,  EmptyNote,
  chartAxis,
  chartTooltip,
  toneIconClass,
  type StatItem,
} from "@/components/patterns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/utils/currency";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Box,
  CheckCircle2,
  DollarSign,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  ArrowRight,
  Layers3,
  Settings,
  ShieldCheck,
  ServerCog,
  UserCog,
  HelpCircle,
  ClipboardCheck,
  Gauge,
  Activity,
  PackageX,
  PackageCheck,
  UploadCloud,
  CreditCard,
  ScanLine,
  FileWarning,
  Command,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNow,
  isValid,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import bgWarehouse from "@/assets/bg-warehouse.jpg";

const QUICK_ACTIONS = [
  { label: "New Sale", to: "/pos", icon: Receipt, color: "bg-emerald-500/10 text-emerald-600" },
  { label: "Add Product", to: "/products", icon: Package, color: "bg-primary/10 text-muted-foreground" },
  { label: "New Purchase", to: "/purchases", icon: ShoppingCart, color: "bg-orange-500/10 text-orange-600" },
  { label: "Add Expense", to: "/expenses", icon: Wallet, color: "bg-rose-500/10 text-rose-600" },
  { label: "Stock Audit", to: "/stock-movements", icon: Activity, color: "bg-primary/10 text-muted-foreground" },
  { label: "Reports", to: "/reports", icon: BarChart3, color: "bg-primary/10 text-muted-foreground" },
];

const SYSTEM_SEARCH_MODULES = [
  { title: "Dashboard", description: "Executive overview, sales, profit, loss, stock health", to: "/dashboard", keywords: "overview executive sales profit loss dashboard home", icon: BarChart3 },
  { title: "Point of Sale", description: "Record sales, receipt, checkout, payments, barcode", to: "/pos", keywords: "pos sale receipt checkout payment cash card mobile barcode", icon: Receipt },
  { title: "Sales", description: "Invoices, refunds, credit sales, EBM status, fiscal records", to: "/sales", keywords: "sales invoice refund credit paid due ebm fiscal customer", icon: ShoppingCart },
  { title: "Products", description: "Product catalog, prices, stock, SKU, barcode", to: "/products", keywords: "products items catalog sku barcode price stock inventory", icon: Package },
  { title: "Stock Overview", description: "Inventory levels, stock value, low stock, out of stock", to: "/inventory", keywords: "inventory stock overview low stock out of stock value", icon: Box },
  { title: "Stock Movements", description: "Inventory audit trail, stock in, stock out, references", to: "/stock-movements", keywords: "stock movement history audit trail stock in stock out reference", icon: Activity },
  { title: "Stock Adjustments", description: "Adjust stock, damage, wastage, correction, opening stock", to: "/adjustments", keywords: "adjustment damage wastage correction stock movement", icon: Layers3 },
  { title: "Purchases", description: "Purchase orders, suppliers, receiving, procurement", to: "/purchases", keywords: "purchases procurement order supplier receive stock", icon: Truck },
  { title: "Customers", description: "CRM, balances, loyalty, customer records", to: "/customers", keywords: "customers crm balance loyalty phone email", icon: Users },
  { title: "Expenses", description: "Business spending, categories, approvals, recurring costs", to: "/expenses", keywords: "expenses spending cost category approval recurring", icon: Wallet },
  { title: "Reports", description: "Sales reports, profit, loss, inventory, exports", to: "/reports", keywords: "reports analytics export pdf csv profit loss sales inventory", icon: BarChart3 },
  { title: "Notifications", description: "Alerts, low stock, sync warnings, system messages", to: "/notifications", keywords: "notifications alerts warning low stock sync messages", icon: Bell },
  { title: "Settings", description: "Business profile, receipt, tax, currency, offline settings", to: "/settings", keywords: "settings business profile receipt tax currency offline", icon: Settings },
  { title: "User Management", description: "Users, roles, permissions, invitations, module access", to: "/user-management", keywords: "users roles permissions invite access admin cashier accountant", icon: UserCog },
  { title: "EBM Settings", description: "RRA EBM, VSDC, TIN, fiscal integration, product sync", to: "/ebm-settings", keywords: "ebm rra vsdc tin fiscal tax invoice integration", icon: ServerCog },
  { title: "QA Verification", description: "System health, offline readiness, sync queue, diagnostics", to: "/qa", keywords: "qa verification diagnostics system health offline sync tests", icon: ShieldCheck },
  { title: "Support", description: "Tickets, help desk, support requests, issue tracking", to: "/support", keywords: "support tickets help desk issues request", icon: HelpCircle },
  { title: "Activity Logs", description: "Audit trail, user activity, security events", to: "/activity-logs", keywords: "activity logs audit security history user actions", icon: ClipboardCheck },
];

type DashboardSearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  to: string;
  icon: any;
  score: number;
};

const ANALYTICS_COLORS = {
  revenue: "#3B82F6",
  revenue2: "#06B6D4",
  profit: "#10B981",
  success: "#22C55E",
  warning: "#F59E0B",
  orange: "#FB923C",
  danger: "#EF4444",
  rose: "#F43F5E",
  violet: "#8B5CF6",
  purple: "#A855F7",
  indigo: "#6366F1",
  teal: "#14B8A6",
};

const PAYMENT_COLORS = [
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
];


function lowerSearchText(value: any) {
  return String(value ?? "").toLowerCase();
}

function pushSearchResult(results: DashboardSearchResult[], result: DashboardSearchResult, query: string) {
  const text = `${result.title} ${result.subtitle} ${result.type}`.toLowerCase();
  let score = result.score;

  if (text === query) score += 100;
  if (text.startsWith(query)) score += 50;
  if (text.includes(query)) score += 20;

  results.push({ ...result, score });
}

function percentChange(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function safeNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function safeDate(value: any, fallback = new Date()) {
  if (!value) return fallback;
  const date = new Date(value);
  return isValid(date) ? date : fallback;
}

function safeDateText(value: any) {
  const date = safeDate(value, new Date());
  return formatDistanceToNow(date, { addSuffix: true });
}

function compactCurrency(value: number) {
  if (Math.abs(value) < 1_000_000) return formatCurrency(value);
  return `RF ${new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function getSaleDate(sale: any) {
  return sale?.date || sale?.created_at || sale?.created_offline_at || new Date().toISOString();
}

function getExpenseDate(expense: any) {
  return expense?.date || expense?.created_at || expense?.created_offline_at || new Date().toISOString();
}

function getPurchaseDate(purchase: any) {
  return purchase?.date || purchase?.created_at || purchase?.created_offline_at || new Date().toISOString();
}

function firstPositiveNumber(...values: any[]) {
  for (const value of values) {
    const n = safeNumber(value);
    if (n > 0) return n;
  }
  return 0;
}

function getSaleRawTotal(sale: any) {
  return firstPositiveNumber(sale.total, sale.grand_total, sale.amount, sale.subtotal);
}

function getSaleRefundTotal(sale: any) {
  return safeNumber(
    sale.refund_total ??
      sale.refunded_total ??
      sale.total_refunded ??
      sale.refund_amount ??
      sale.return_total ??
      0
  );
}

function getSaleItemsArray(sale: any) {
  const candidates = [sale?.sale_items, sale?.saleItems, sale?.line_items, sale?.items_data, sale?.items_list];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (Array.isArray(sale?.items)) return sale.items;

  return [];
}

function getSaleItemSummary(sale: any) {
  const items = getSaleItemsArray(sale);

  if (items.length > 0) {
    const original = items.reduce((sum: number, item: any) => sum + safeNumber(item.quantity ?? item.qty ?? 0), 0);
    const refunded = items.reduce(
      (sum: number, item: any) =>
        sum + safeNumber(item.refunded_quantity ?? item.qty_refunded ?? item.refund_qty ?? item.returned_quantity ?? 0),
      0
    );

    return {
      original,
      refunded,
      net: Math.max(0, original - refunded),
    };
  }

  const original = safeNumber(sale.items ?? sale.item_count ?? sale.total_items ?? 0);
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
      const soldQty = safeNumber(item.quantity ?? item.qty ?? 0);
      const refundedQty = safeNumber(
        item.refunded_quantity ?? item.qty_refunded ?? item.refund_qty ?? item.returned_quantity ?? 0
      );
      const netQty = Math.max(0, soldQty - refundedQty);
      const unitCost = firstPositiveNumber(item.unit_cost, item.cost_price, item.purchase_price);

      if (unitCost > 0) return sum + netQty * unitCost;

      const totalCost = firstPositiveNumber(item.cost_total, item.cogs_total);
      if (totalCost > 0 && soldQty > 0) return sum + totalCost * (netQty / soldQty);

      return sum;
    }, 0);

    if (itemCost > 0) return itemCost;
  }

  const originalTotal = getSaleRawTotal(sale);
  const netTotal = getSaleTotal(sale);
  const ratio = originalTotal > 0 ? Math.min(1, netTotal / originalTotal) : 1;

  const directCost = firstPositiveNumber(
    sale.cost_total,
    sale.cogs_total,
    sale.cost_of_goods_sold,
    sale.total_cost
  );

  return directCost > 0 ? directCost * ratio : 0;
}

function getSaleStatus(sale: any) {
  return String(sale?.status || "completed").trim().toLowerCase().replace(/\s+/g, "_");
}

function isPendingRecord(row: any) {
  const status = String(row?.sync_status || "").toLowerCase();
  return (
    status.includes("pending") ||
    String(row?.id || "").startsWith("offline-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at
  );
}

function isCancelledSale(sale: any) {
  const status = getSaleStatus(sale);
  return status.includes("cancel") || status.includes("void") || !!sale?.cancelled_at;
}

function isFullyRefundedSale(sale: any) {
  if (isCancelledSale(sale)) return true;

  const status = getSaleStatus(sale);
  const rawTotal = getSaleRawTotal(sale);
  const refundTotal = getSaleRefundTotal(sale);

  if (status.includes("partial")) return false;

  return (
    status === "refunded" ||
    status === "fully_refunded" ||
    status === "full_refund" ||
    !!sale?.refunded_at ||
    (rawTotal > 0 && refundTotal >= rawTotal)
  );
}

function getSaleTotal(sale: any) {
  if (isFullyRefundedSale(sale)) return 0;

  const total = getSaleRawTotal(sale);
  const refundTotal = getSaleRefundTotal(sale);

  return Math.max(0, total - refundTotal);
}

function getSaleGrossProfit(sale: any) {
  if (isFullyRefundedSale(sale)) return 0;

  const netTotal = getSaleTotal(sale);
  if (netTotal <= 0) return 0;

  const costTotal = getSaleCostTotal(sale);
  if (costTotal > 0) return Math.max(0, netTotal - costTotal);

  const originalTotal = getSaleRawTotal(sale);
  const ratio = originalTotal > 0 ? Math.min(1, netTotal / originalTotal) : 1;

  const existingProfit = firstPositiveNumber(
    sale.profit,
    sale.gross_profit,
    sale.net_profit,
    sale.margin_amount
  );

  if (existingProfit > 0) return Math.max(0, existingProfit * ratio);

  return 0;
}

function productStock(product: any) {
  return Math.max(0, safeNumber(product.stock ?? product.stock_quantity));
}

function isArchivedProduct(product: any) {
  const status = String(product?.status || "").toLowerCase();
  const operation = String(product?.operation || "").toLowerCase();
  const syncStatus = String(product?.sync_status || "").toLowerCase();
  return ["inactive", "archived", "deleted", "pending_delete"].includes(status) || operation === "delete" || syncStatus === "pending_delete";
}

function productMinStock(product: any) {
  return Math.max(0, safeNumber(product.min_stock ?? product.min_stock_level ?? product.reorder_level));
}

function productCost(product: any) {
  return safeNumber(product.cost_price ?? product.purchase_price ?? product.unit_cost);
}

function productPrice(product: any) {
  return safeNumber(product.selling_price ?? product.price ?? product.sale_price);
}

function productMargin(product: any) {
  const price = productPrice(product);
  const cost = productCost(product);
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

function productHealth(product: any) {
  let score = 100;
  if (!product.name) score -= 20;
  if (!product.sku) score -= 15;
  if (!product.barcode) score -= 8;
  if (!product.category) score -= 10;
  if (productPrice(product) <= 0) score -= 20;
  if (productCost(product) <= 0) score -= 15;
  if (productMargin(product) < 0) score -= 25;
  if (productStock(product) <= 0) score -= 15;
  if (productMinStock(product) > 0 && productStock(product) <= productMinStock(product)) score -= 8;
  if (isPendingRecord(product)) score -= 5;
  return Math.max(0, Math.min(100, score));
}

function stockMovementRisk(movement: any) {
  const type = String(movement?.movement_type || "").toLowerCase();
  const qty = safeNumber(movement?.quantity_change);
  const before = safeNumber(movement?.stock_before);
  const after = safeNumber(movement?.stock_after);
  let score = 0;

  if (["damage", "wastage", "correction"].includes(type)) score += 35;
  if (after < 0) score += 40;
  if (!movement?.reference && !movement?.reference_id) score += 15;
  if (Math.abs(qty) >= 100) score += 15;
  if (before >= 0 && after >= 0 && Math.abs(after - before) !== Math.abs(qty)) score += 20;
  if (isPendingRecord(movement)) score += 8;

  return Math.min(100, score);
}

function filterByRange(items: any[], start: Date, end: Date, getDate: (item: any) => string) {
  return items.filter((item) => {
    const d = safeDate(getDate(item), new Date(0));
    return isValid(d) && isWithinInterval(d, { start, end });
  });
}

function buildPeriodSummary(sales: any[], expenses: any[], start: Date, end: Date) {
  const periodSales = filterByRange(sales, start, end, getSaleDate).filter((sale) => !isCancelledSale(sale));
  const periodExpenses = filterByRange(expenses, start, end, getExpenseDate);

  const salesTotal = periodSales.reduce((sum, sale) => sum + getSaleTotal(sale), 0);
  const grossProfit = periodSales.reduce((sum, sale) => sum + getSaleGrossProfit(sale), 0);
  const expenseTotal = periodExpenses.reduce((sum, expense) => sum + safeNumber(expense.amount), 0);
  const netProfit = grossProfit - expenseTotal;
  const loss = netProfit < 0 ? Math.abs(netProfit) : 0;

  return {
    sales: salesTotal,
    grossProfit,
    expenses: expenseTotal,
    profit: Math.max(netProfit, 0),
    loss,
    netProfit,
    orders: periodSales.length,
  };
}

function getMetricTone(value: number) {
  if (value >= 80) return "text-emerald-600";
  if (value >= 55) return "text-orange-600";
  return "text-rose-600";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const { data: sales = [], isLoading: lSales } = useSales();
  const { data: products = [], isLoading: lProducts } = useProducts();
  const { data: purchases = [] } = usePurchases();
  const { data: expenses = [] } = useExpenses();
  const { data: customers = [] } = useCustomers();
  const { data: movements = [] } = useStockMovements(1000);

  const loading = lSales || lProducts;

  const stats = useMemo(() => {
    const now = new Date();

    const todayStart = startOfDay(now);
    const todayEnd = now;
    const yesterdayStart = startOfDay(subDays(now, 1));
    const yesterdayEnd = todayStart;
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const previousWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const previousWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));

    const today = buildPeriodSummary(sales, expenses, todayStart, todayEnd);
    const yesterday = buildPeriodSummary(sales, expenses, yesterdayStart, yesterdayEnd);
    const week = buildPeriodSummary(sales, expenses, weekStart, weekEnd);
    const previousWeek = buildPeriodSummary(sales, expenses, previousWeekStart, previousWeekEnd);
    const month = buildPeriodSummary(sales, expenses, monthStart, monthEnd);
    const previousMonth = buildPeriodSummary(sales, expenses, previousMonthStart, previousMonthEnd);

    const activeProducts = products.filter((product) => !isArchivedProduct(product));

    const lowStockItems = activeProducts.filter((product) => {
      const stock = productStock(product);
      const minStock = productMinStock(product);
      return minStock > 0 && stock > 0 && stock <= minStock;
    });

    const outOfStockItems = activeProducts.filter((product) => productStock(product) <= 0);
    const negativeMarginProducts = activeProducts.filter((product) => productMargin(product) < 0);
    const missingPriceProducts = activeProducts.filter((product) => productPrice(product) <= 0 || productCost(product) <= 0);
    const noBarcodeProducts = activeProducts.filter((product) => !product.barcode);
    const healthyProducts = activeProducts.filter((product) => productHealth(product) >= 80);

    const totalInventoryValue = activeProducts.reduce(
      (sum, product) => sum + productStock(product) * productCost(product),
      0
    );

    const retailInventoryValue = activeProducts.reduce(
      (sum, product) => sum + productStock(product) * productPrice(product),
      0
    );

    const inventoryPotentialProfit = Math.max(0, retailInventoryValue - totalInventoryValue);

    const allBusinessRows = [...sales, ...products, ...purchases, ...expenses, ...customers, ...movements];
    const pendingRecords = allBusinessRows.filter(isPendingRecord).length;
    const offlineRecords = allBusinessRows.filter(
      (row: any) =>
        String(row?.id || "").startsWith("offline-") ||
        row?.offline_id ||
        row?.created_offline_at ||
        row?.updated_offline_at
    ).length;

    const pendingPurchases = purchases.filter((purchase) =>
      ["draft", "ordered", "pending", "partial"].includes(String(purchase.status || "").toLowerCase())
    );

    const monthPurchases = filterByRange(purchases, monthStart, monthEnd, getPurchaseDate);
    const purchaseValue = purchases.reduce((sum, p) => sum + safeNumber((p as any).total ?? (p as any).amount ?? (p as any).grand_total), 0);
    const monthPurchaseValue = monthPurchases.reduce((sum, p) => sum + safeNumber((p as any).total ?? (p as any).amount ?? (p as any).grand_total), 0);

    const overdueBalances = customers.reduce(
      (sum, customer) => sum + safeNumber(customer.outstanding_balance),
      0
    );

    const days = eachDayOfInterval({ start: subDays(now, 6), end: now });

    const chartData = days.map((day) => {
      const dayStart = startOfDay(day);
      const nextDay = new Date(dayStart.getTime() + 86400000);
      const daySummary = buildPeriodSummary(sales, expenses, dayStart, nextDay);
      const dayPurchaseValue = filterByRange(purchases, dayStart, nextDay, getPurchaseDate).reduce(
        (sum, p) => sum + safeNumber((p as any).total ?? (p as any).amount ?? (p as any).grand_total),
        0
      );

      return {
        day: format(day, "EEE"),
        sales: Math.round(daySummary.sales),
        profit: Math.round(daySummary.profit),
        loss: Math.round(daySummary.loss),
        expenses: Math.round(daySummary.expenses),
        purchases: Math.round(dayPurchaseValue),
        orders: daySummary.orders,
      };
    });

    const categoryMap = new Map<string, number>();

    products.forEach((product) => {
      const category = product.category || "Other";
      const value = productStock(product) * productPrice(product);
      categoryMap.set(category, (categoryMap.get(category) || 0) + value);
    });

    const categoryData = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const salesByPaymentMap = new Map<string, number>();
    sales.forEach((sale: any) => {
      if (isCancelledSale(sale)) return;
      const method = sale.payment_method || sale.payment_type || "Unknown";
      salesByPaymentMap.set(method, (salesByPaymentMap.get(method) || 0) + getSaleTotal(sale));
    });

    const salesByPayment = Array.from(salesByPaymentMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const recentSales = [...sales]
      .sort((a, b) => safeDate(getSaleDate(b)).getTime() - safeDate(getSaleDate(a)).getTime())
      .slice(0, 7);

    const topProducts = [...activeProducts]
      .filter((product) => productStock(product) > 0)
      .sort((a, b) => productPrice(b) * productStock(b) - productPrice(a) * productStock(a))
      .slice(0, 7);

    const recentMovements = [...movements]
      .sort((a: any, b: any) => safeDate(b.created_at || b.created_offline_at).getTime() - safeDate(a.created_at || a.created_offline_at).getTime())
      .slice(0, 8);

    const riskMovements = movements.filter((movement: any) => stockMovementRisk(movement) >= 15);
    const criticalMovements = movements.filter((movement: any) => stockMovementRisk(movement) >= 70);
    const negativeAfterMovements = movements.filter((movement: any) => safeNumber(movement.stock_after) < 0);

    const stockIn = movements.filter((m: any) => safeNumber(m.quantity_change) > 0).reduce((sum: number, m: any) => sum + safeNumber(m.quantity_change), 0);
    const stockOut = movements.filter((m: any) => safeNumber(m.quantity_change) < 0).reduce((sum: number, m: any) => sum + Math.abs(safeNumber(m.quantity_change)), 0);

    const avgProductHealth = activeProducts.length
      ? Math.round(activeProducts.reduce((sum, product) => sum + productHealth(product), 0) / activeProducts.length)
      : 0;

    const grossMarginRate = month.sales > 0 ? (month.grossProfit / month.sales) * 100 : 0;
    const netMarginRate = month.sales > 0 ? (month.netProfit / month.sales) * 100 : 0;
    const inventoryHealthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
            lowStockItems.length * 3 -
            outOfStockItems.length * 5 -
            negativeMarginProducts.length * 4 -
            missingPriceProducts.length * 3 -
            noBarcodeProducts.length * 1
        )
      )
    );
    const salesHealthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          70 +
            Math.min(20, month.orders * 2) +
            (month.netProfit > 0 ? 10 : -15) -
            (month.loss > 0 ? 20 : 0)
        )
      )
    );
    const syncHealthScore = Math.max(0, Math.min(100, 100 - pendingRecords * 4));
    const riskHealthScore = Math.max(0, Math.min(100, 100 - riskMovements.length * 2 - criticalMovements.length * 10));
    const systemHealthScore = Math.round((inventoryHealthScore + salesHealthScore + syncHealthScore + riskHealthScore + avgProductHealth) / 5);

    const productSearchQuality = activeProducts.length
      ? Math.round(((activeProducts.length - noBarcodeProducts.length - missingPriceProducts.length) / activeProducts.length) * 100)
      : 0;

    return {
      today,
      yesterday,
      week,
      previousWeek,
      month,
      previousMonth,
      todayChange: percentChange(today.sales, yesterday.sales),
      weekChange: percentChange(week.sales, previousWeek.sales),
      monthChange: percentChange(month.sales, previousMonth.sales),
      totalProducts: activeProducts.length,
      activeCustomers: customers.length,
      lowStock: lowStockItems.length,
      outOfStock: outOfStockItems.length,
      lowStockItems: lowStockItems.slice(0, 8),
      totalInventoryValue,
      retailInventoryValue,
      inventoryPotentialProfit,
      pendingPurchases: pendingPurchases.length,
      overdueBalances,
      chartData,
      categoryData,
      salesByPayment,
      recentSales,
      topProducts,
      recentMovements,
      pendingRecords,
      offlineRecords,
      activeProducts: activeProducts.length,
      healthyProducts: healthyProducts.length,
      fullyRefunded: sales.filter(isFullyRefundedSale).length,
      partialRefunded: sales.filter((sale) => getSaleStatus(sale).includes("partial")).length,
      cancelledSales: sales.filter(isCancelledSale).length,
      purchaseValue,
      monthPurchaseValue,
      riskMovements: riskMovements.length,
      criticalMovements: criticalMovements.length,
      negativeAfterMovements: negativeAfterMovements.length,
      stockIn,
      stockOut,
      netStockMovement: stockIn - stockOut,
      avgProductHealth,
      systemHealthScore,
      inventoryHealthScore,
      salesHealthScore,
      syncHealthScore,
      riskHealthScore,
      grossMarginRate,
      netMarginRate,
      negativeMarginProducts: negativeMarginProducts.length,
      missingPriceProducts: missingPriceProducts.length,
      noBarcodeProducts: noBarcodeProducts.length,
      productSearchQuality,
    };
  }, [sales, products, purchases, expenses, customers, movements]);

  const dashboardSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [] as DashboardSearchResult[];

    const results: DashboardSearchResult[] = [];

    SYSTEM_SEARCH_MODULES.forEach((module) => {
      const text = `${module.title} ${module.description} ${module.keywords}`.toLowerCase();

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `module-${module.to}`,
            title: module.title,
            subtitle: module.description,
            type: "Module",
            to: module.to,
            icon: module.icon,
            score: 100,
          },
          q
        );
      }
    });

    QUICK_ACTIONS.forEach((action) => {
      const text = `${action.label} ${action.to}`.toLowerCase();

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `quick-${action.to}`,
            title: action.label,
            subtitle: `Quick action · ${action.to}`,
            type: "Quick Action",
            to: action.to,
            icon: action.icon,
            score: 95,
          },
          q
        );
      }
    });

    sales.forEach((sale: any) => {
      const invoice = sale.invoice_no || sale.receipt_no || sale.id || "";
      const text = [
        invoice,
        sale.customer_name,
        sale.customer_tin,
        sale.payment_method,
        sale.status,
        sale.branch,
        sale.cashier,
        getSaleTotal(sale),
        safeDateText(sale.created_at || sale.created_offline_at || sale.date),
      ].map(lowerSearchText).join(" ");

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `sale-${sale.id || invoice}`,
            title: `Sale ${invoice || "record"}`,
            subtitle: `${sale.customer_name || "Walk-in Customer"} · ${formatCurrency(getSaleTotal(sale))}`,
            type: "Sale",
            to: "/sales",
            icon: Receipt,
            score: 80,
          },
          q
        );
      }
    });

    products.filter((product: any) => !isArchivedProduct(product)).forEach((product: any) => {
      const text = [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.brand,
        product.unit,
        product.status,
        product.stock,
        product.stock_quantity,
        product.selling_price,
        product.price,
        product.cost_price,
        product.purchase_price,
        product.supplier_name,
        product.location,
      ].map(lowerSearchText).join(" ");

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `product-${product.id || product.sku || product.name}`,
            title: product.name || "Unnamed product",
            subtitle: `Product · SKU ${product.sku || "—"} · Stock ${productStock(product)}`,
            type: "Product",
            to: "/products",
            icon: Package,
            score: 78,
          },
          q
        );
      }
    });

    customers.forEach((customer: any) => {
      const text = [
        customer.name,
        customer.email,
        customer.phone,
        customer.code,
        customer.city,
        customer.address,
        customer.customer_group,
        customer.type,
        customer.outstanding_balance,
        customer.total_spent,
      ].map(lowerSearchText).join(" ");

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `customer-${customer.id || customer.email || customer.phone}`,
            title: customer.name || "Unnamed customer",
            subtitle: `${customer.phone || customer.email || "No contact"} · Balance ${formatCurrency(safeNumber(customer.outstanding_balance))}`,
            type: "Customer",
            to: "/customers",
            icon: Users,
            score: 76,
          },
          q
        );
      }
    });

    purchases.forEach((purchase: any) => {
      const text = [
        purchase.purchase_no,
        purchase.invoice_no,
        purchase.supplier_name,
        purchase.status,
        purchase.payment_status,
        (purchase as any).total,
        (purchase as any).amount,
        purchase.created_at,
      ].map(lowerSearchText).join(" ");

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `purchase-${purchase.id || purchase.purchase_no}`,
            title: purchase.purchase_no || purchase.invoice_no || "Purchase order",
            subtitle: `${purchase.supplier_name || "Supplier"} · ${formatCurrency(safeNumber((purchase as any).total ?? (purchase as any).amount))}`,
            type: "Purchase",
            to: "/purchases",
            icon: Truck,
            score: 72,
          },
          q
        );
      }
    });

    expenses.forEach((expense: any) => {
      const text = [
        expense.title,
        expense.description,
        expense.category,
        expense.status,
        expense.payment_method,
        expense.amount,
        expense.date,
        expense.created_at,
      ].map(lowerSearchText).join(" ");

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `expense-${expense.id || expense.title}`,
            title: expense.title || expense.category || "Expense",
            subtitle: `${expense.category || "Expense"} · ${formatCurrency(safeNumber(expense.amount))}`,
            type: "Expense",
            to: "/expenses",
            icon: Wallet,
            score: 70,
          },
          q
        );
      }
    });

    movements.forEach((movement: any) => {
      const text = [
        movement.product_name,
        movement.product_id,
        movement.movement_type,
        movement.reference,
        movement.notes,
        movement.quantity_change,
        movement.stock_after,
      ].map(lowerSearchText).join(" ");

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `movement-${movement.id || movement.reference}`,
            title: movement.product_name || "Stock movement",
            subtitle: `${movement.movement_type || "movement"} · Qty ${safeNumber(movement.quantity_change)}`,
            type: "Stock Activity",
            to: "/stock-movements",
            icon: ArrowUpRight,
            score: 68,
          },
          q
        );
      }
    });

    const metricSearch = [
      { title: "Today's Sales", value: formatCurrency(stats.today.sales), to: "/sales", icon: Receipt },
      { title: "Weekly Sales", value: formatCurrency(stats.week.sales), to: "/reports", icon: TrendingUp },
      { title: "Monthly Sales", value: formatCurrency(stats.month.sales), to: "/reports", icon: BarChart3 },
      { title: "Today Profit", value: formatCurrency(stats.today.profit), to: "/reports", icon: DollarSign },
      { title: "Today Loss", value: formatCurrency(stats.today.loss), to: "/reports", icon: TrendingDown },
      { title: "Inventory Value", value: formatCurrency(stats.totalInventoryValue), to: "/inventory", icon: Box },
      { title: "Retail Inventory Value", value: formatCurrency(stats.retailInventoryValue), to: "/inventory", icon: PackageCheck },
      { title: "Low Stock", value: String(stats.lowStock), to: "/inventory", icon: AlertTriangle },
      { title: "Out of Stock", value: String(stats.outOfStock), to: "/inventory", icon: PackageX },
      { title: "Customers", value: String(stats.activeCustomers), to: "/customers", icon: Users },
      { title: "System Health", value: `${stats.systemHealthScore}%`, to: "/qa", icon: Gauge },
      { title: "Stock Risk", value: String(stats.riskMovements), to: "/stock-movements", icon: FileWarning },
    ];

    metricSearch.forEach((metric) => {
      const text = `${metric.title} ${metric.value}`.toLowerCase();

      if (text.includes(q)) {
        pushSearchResult(
          results,
          {
            id: `metric-${metric.title}`,
            title: metric.title,
            subtitle: `Dashboard metric · ${metric.value}`,
            type: "Dashboard Metric",
            to: metric.to,
            icon: metric.icon,
            score: 65,
          },
          q
        );
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 14);
  }, [globalSearch, sales, products, customers, purchases, expenses, movements, stats]);

  // Two "hero" stats rendered inside the operations banner using the brand
  // indigo/violet system. Kept deliberately small (2 cards) so the banner
  // doesn't turn into another wall of saturated colour.

  // One calm row of secondary stats (bg-card + border + small icon chip)
  // consolidating the most meaningful metrics that used to live in the old
  // topSummaryCards + kpis walls of solid colour.

  const healthCards = [
    { label: "Inventory Health", value: stats.inventoryHealthScore, icon: PackageCheck, to: "/inventory" },
    { label: "Sales Health", value: stats.salesHealthScore, icon: Receipt, to: "/sales" },
    { label: "Audit Health", value: stats.riskHealthScore, icon: ShieldCheck, to: "/stock-movements" },
    { label: "Catalog Health", value: stats.avgProductHealth, icon: Gauge, to: "/products" },
  ];

  /*
   * Everything waiting on a decision, in one list, worst first.
   *
   * This used to be four panels — "Attention Required", "Executive Alerts",
   * an operations board and a priorities strip — carrying the same handful of
   * numbers between them. Repeating a figure four times does not make it four
   * times more urgent; it makes the page long enough that none of it gets
   * read. One list, and a row only exists when its count is non-zero, so the
   * length of the section is itself the signal.
   */
  const attentionFeed = [
    {
      id: "out-of-stock",
      title: "Products out of stock",
      count: stats.outOfStock,
      display: String(stats.outOfStock),
      helper: "Nothing left to sell — these cannot be rung up at the till",
      to: "/inventory",
      icon: PackageX,
      tone: "rose" as const,
    },
    {
      id: "negative-margin",
      title: "Products selling at a loss",
      count: stats.negativeMarginProducts,
      display: String(stats.negativeMarginProducts),
      helper: "Selling price is below cost, or cost was never entered",
      to: "/products",
      icon: TrendingDown,
      tone: "rose" as const,
    },
    {
      id: "critical-movements",
      title: "Stock movements needing audit",
      count: stats.riskMovements,
      display: String(stats.riskMovements),
      helper: `${stats.criticalMovements} critical · ${stats.negativeAfterMovements} went negative`,
      to: "/stock-movements",
      icon: ShieldCheck,
      tone: stats.criticalMovements > 0 ? ("rose" as const) : ("amber" as const),
    },
    {
      id: "low-stock",
      title: "Products below reorder point",
      count: stats.lowStock,
      display: String(stats.lowStock),
      helper: "Still sellable, but they need reordering now",
      to: "/inventory",
      icon: Package,
      tone: "amber" as const,
    },
    {
      id: "catalog-quality",
      title: "Missing barcodes or prices",
      count: stats.noBarcodeProducts + stats.missingPriceProducts,
      display: String(stats.noBarcodeProducts + stats.missingPriceProducts),
      helper: "Slows the cashier down and leaves gaps in reporting",
      to: "/products",
      icon: ScanLine,
      tone: "amber" as const,
    },
    {
      id: "pending-purchases",
      title: "Purchases awaiting follow-up",
      count: stats.pendingPurchases,
      display: String(stats.pendingPurchases),
      helper: "Ordered but not yet received or reviewed",
      to: "/purchases",
      icon: Truck,
      tone: "amber" as const,
    },
    {
      id: "credit-exposure",
      title: "Customer credit outstanding",
      count: stats.overdueBalances,
      display: compactCurrency(stats.overdueBalances),
      helper: "Money sold but not yet collected",
      to: "/customers",
      icon: CreditCard,
      tone: "violet" as const,
    },
    {
      id: "pending-sync",
      title: "Records waiting to sync",
      count: stats.pendingRecords,
      display: String(stats.pendingRecords),
      helper: `${stats.offlineRecords} created or edited while offline`,
      to: "/settings",
      icon: UploadCloud,
      tone: "sky" as const,
    },
  ].filter((item) => item.count > 0);

  const criticalCount = attentionFeed.filter((item) => item.tone === "rose").length;

  const replenishmentQueue = stats.lowStockItems.slice(0, 6).map((product: any) => ({
    id: product.id,
    name: product.name || "Unnamed product",
    stock: productStock(product),
    min: productMinStock(product),
    value: productPrice(product) * productStock(product),
  }));

  const statCards: StatItem[] = [
    {
      label: "Today's Sales",
      value: formatCurrency(stats.today.sales),
      icon: Receipt,
      tone: "indigo",
      helper: `${stats.today.orders} order${stats.today.orders === 1 ? "" : "s"} today`,
    },
    {
      label: "Today's Profit",
      value: formatCurrency(stats.today.profit),
      icon: DollarSign,
      tone: stats.today.profit >= 0 ? "emerald" : "rose",
      helper: stats.today.loss > 0 ? `${formatCurrency(stats.today.loss)} loss` : "net positive today",
    },
    {
      label: "Monthly Sales",
      value: formatCurrency(stats.month.sales),
      icon: BarChart3,
      tone: "sky",
      helper: `${stats.monthChange >= 0 ? "+" : ""}${stats.monthChange.toFixed(1)}% vs last month`,
    },
    {
      label: "Inventory Value",
      value: compactCurrency(stats.totalInventoryValue),
      icon: Box,
      tone: "violet",
      helper: `${compactCurrency(stats.inventoryPotentialProfit)} potential profit`,
    },
    {
      label: "Stock Risk",
      value: String(stats.riskMovements),
      icon: FileWarning,
      tone: stats.riskMovements > 0 ? "amber" : "cyan",
      helper: `${stats.criticalMovements} critical`,
    },
    {
      label: "System Health",
      value: `${stats.systemHealthScore}%`,
      icon: Gauge,
      tone: stats.systemHealthScore >= 70 ? "teal" : stats.systemHealthScore >= 55 ? "amber" : "rose",
      helper: "operation score",
    },
  ];

  if (loading) {
    return (
      <PageBackground image={bgWarehouse} opacity={0.04}>
        <PageContainer>
          <Skeleton className="h-16 w-80 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-44 rounded-3xl" />
          <div className="grid gap-4 xl:grid-cols-12">
            <Skeleton className="h-80 rounded-3xl xl:col-span-8" />
            <Skeleton className="h-80 rounded-3xl xl:col-span-4" />
          </div>
        </PageContainer>
      </PageBackground>
    );
  }

  return (
    <PageBackground image={bgWarehouse} opacity={0.04}>
      <PageContainer className="animate-fade-in">
        {/* Title, and the one control that belongs on a dashboard: a way out
            of it. Everything else here is a read, not a write. */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Operations Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(), "EEEE, d MMMM yyyy")} · {stats.today.orders} order
              {stats.today.orders === 1 ? "" : "s"} so far today
            </p>
          </div>

          <div ref={searchRef} className="relative w-full max-w-md xl:w-96">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={globalSearch}
                onChange={(event) => {
                  setGlobalSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Jump to a module, product or report..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {searchOpen && globalSearch.trim() && (
              <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-xl">
                {dashboardSearchResults.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nothing matches "{globalSearch}".
                  </p>
                ) : (
                  dashboardSearchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.title}`}
                      type="button"
                      onClick={() => {
                        navigate(result.to);
                        setSearchOpen(false);
                        setGlobalSearch("");
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <result.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {result.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <StatGrid items={statCards} columns={6} />


        <SectionCard
          icon={AlertTriangle}
          tone={criticalCount > 0 ? "rose" : attentionFeed.length > 0 ? "amber" : "emerald"}
          title="Needs attention"
          description={
            attentionFeed.length === 0
              ? "Nothing is waiting on a decision right now"
              : `${attentionFeed.length} item${attentionFeed.length === 1 ? "" : "s"}${
                  criticalCount > 0 ? ` · ${criticalCount} critical` : ""
                }`
          }
          actions={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Open reports
              </Link>
            </Button>
          }
        >
          {attentionFeed.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Stock, margins and purchasing are all within their thresholds.
              </p>
            </div>
          ) : (
            <div className="stagger-children grid gap-2 md:grid-cols-2">
              {attentionFeed.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  className="lift group flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 hover:border-primary/40"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneIconClass[item.tone]}`}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.helper}
                    </span>
                  </span>

                  <span className="shrink-0 font-data text-lg font-bold text-foreground">
                    {item.display}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="grid gap-4 xl:grid-cols-12">
          <SectionCard
            className="xl:col-span-8"
            icon={BarChart3}
            tone="violet"
            title="Revenue and profit"
            description="Last 7 days, against the expenses that ate into it"
            actions={
              <Badge variant="secondary" className="rounded-full">
                Live
              </Badge>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={stats.chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ANALYTICS_COLORS.revenue} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={ANALYTICS_COLORS.revenue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => compactCurrency(Number(value))}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(Number(value)), name]}
                  {...chartTooltip}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke={ANALYTICS_COLORS.revenue}
                  strokeWidth={2.5}
                  fill="url(#dashSales)"
                />
                <Bar dataKey="expenses" name="Expenses" fill={ANALYTICS_COLORS.warning} radius={[6, 6, 0, 0]} barSize={18} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke={ANALYTICS_COLORS.profit}
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard
            className="xl:col-span-4"
            icon={Package}
            tone="cyan"
            title="Inventory by category"
            description="Where retail stock value sits"
          >
            {stats.categoryData.length === 0 ? (
              <EmptyNote icon={Package} text="No categorised stock yet." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={stats.categoryData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {stats.categoryData.map((_, index) => (
                        <Cell key={index} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(Number(value))}
                      {...chartTooltip}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-2">
                  {stats.categoryData.slice(0, 5).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }}
                        />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                      </span>
                      <span className="shrink-0 font-data font-semibold text-foreground">
                        {compactCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <SectionCard
            className="xl:col-span-8"
            icon={Receipt}
            tone="emerald"
            title="Recent sales"
            description="The latest transactions across every branch"
            actions={
              <Link to="/sales" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            }
          >
            {stats.recentSales.length === 0 ? (
              <EmptyNote icon={Receipt} text="No sales yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th className="text-center">Items</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Profit</th>
                      <th className="text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSales.map((sale: any) => {
                      const summary = getSaleItemSummary(sale);
                      const status = getSaleStatus(sale);
                      const flagged =
                        isFullyRefundedSale(sale) || status.includes("partial") || isCancelledSale(sale);

                      return (
                        <tr key={sale.id} className="border-b transition hover:bg-muted/40 last:border-0">
                          <td className="font-data text-xs">
                            {sale.invoice_no || sale.receipt_no || "-"}
                          </td>
                          <td>
                            <div className="flex flex-col">
                              <span className="truncate">{sale.customer_name || "Walk-in Customer"}</span>
                              {flagged && (
                                <span className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                                  {status.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-center font-data text-xs">
                            {summary.net}
                            {summary.refunded > 0 ? (
                              <span className="ml-1 text-amber-600 dark:text-amber-400">
                                (-{summary.refunded})
                              </span>
                            ) : null}
                          </td>
                          <td className="text-right font-data font-semibold">
                            {formatCurrency(getSaleTotal(sale))}
                          </td>
                          <td className="text-right font-data font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(getSaleGrossProfit(sale))}
                          </td>
                          <td className="whitespace-nowrap text-right text-xs text-muted-foreground">
                            {safeDateText(sale.created_at || sale.created_offline_at || sale.date)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            className="xl:col-span-4"
            icon={Activity}
            tone="cyan"
            title="Stock activity"
            description="Movements in and out, newest first"
          >
            {!stats.recentMovements || stats.recentMovements.length === 0 ? (
              <EmptyNote icon={Activity} text="No stock activity yet." />
            ) : (
              <div className="space-y-1">
                {stats.recentMovements.slice(0, 7).map((movement: any) => {
                  const up = safeNumber(movement.quantity_change) > 0;
                  return (
                    <Link
                      key={movement.id}
                      to="/stock-movements"
                      className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-muted/50"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          up
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {movement.product_name || "-"}
                        </span>
                        <span className="block truncate text-xs capitalize text-muted-foreground">
                          {movement.movement_type || "movement"} · {movement.reference || "no reference"}
                        </span>
                      </span>

                      <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                        {safeDateText(movement.created_at || movement.created_offline_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <SectionCard
            className="xl:col-span-7"
            icon={PackageX}
            tone={stats.lowStock > 0 ? "amber" : "teal"}
            title="Replenishment queue"
            description="Below reorder point, most valuable first"
            actions={
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link to="/purchases">
                  <Truck className="mr-2 h-4 w-4" />
                  Raise a purchase
                </Link>
              </Button>
            }
          >
            {replenishmentQueue.length === 0 ? (
              <EmptyNote icon={PackageCheck} text="Every product is above its reorder point." />
            ) : (
              <div className="space-y-2">
                {replenishmentQueue.map((product) => {
                  const pct = product.min > 0 ? Math.min(100, (product.stock / product.min) * 100) : 0;
                  return (
                    <Link
                      key={product.id}
                      to="/inventory"
                      className="block rounded-2xl border border-border bg-muted/30 p-3 transition hover:border-primary/40 hover:bg-muted/50"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {product.name}
                        </span>
                        <span className="shrink-0 font-data text-xs text-muted-foreground">
                          {product.stock} / {product.min} min
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            product.stock === 0 ? "bg-rose-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            className="xl:col-span-5"
            icon={CreditCard}
            tone="emerald"
            title="Sales by payment method"
            description="Revenue distribution by tender type"
          >
            {stats.salesByPayment.length === 0 ? (
              <EmptyNote icon={CreditCard} text="No payments recorded yet." />
            ) : (
              <ResponsiveContainer width="100%" height={252}>
                <BarChart data={stats.salesByPayment} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => compactCurrency(Number(value))}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(Number(value))}
                    {...chartTooltip}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
                    {stats.salesByPayment.map((_, index) => (
                      <Cell key={index} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <SectionCard
            className="xl:col-span-5"
            icon={Gauge}
            tone={stats.systemHealthScore >= 70 ? "teal" : stats.systemHealthScore >= 55 ? "amber" : "rose"}
            title="System health"
            description="Operational readiness across the modules"
            actions={
              <Badge
                variant="outline"
                className={`rounded-full ${getMetricTone(stats.systemHealthScore)}`}
              >
                {stats.systemHealthScore}%
              </Badge>
            }
          >
            <div className="space-y-3">
              {healthCards.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="block rounded-2xl border border-border bg-muted/30 p-3 transition hover:border-primary/40 hover:bg-muted/50"
                >
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      {item.label}
                    </span>
                    <span className={`font-data font-bold ${getMetricTone(item.value)}`}>
                      {item.value}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        item.value >= 80
                          ? "bg-emerald-500"
                          : item.value >= 55
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.max(item.value, 3)}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            className="xl:col-span-7"
            icon={Box}
            tone="violet"
            title="Top inventory value"
            description="Where the most capital is tied up"
            actions={
              <Link to="/inventory" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            }
          >
            {stats.topProducts.length === 0 ? (
              <EmptyNote icon={Box} text="No product stock value yet." />
            ) : (
              <div className="space-y-1">
                {stats.topProducts.slice(0, 6).map((product: any, index: number) => {
                  const value = productPrice(product) * productStock(product);
                  const top = productPrice(stats.topProducts[0]) * productStock(stats.topProducts[0]);
                  const pct = top > 0 ? (value / top) * 100 : 0;

                  return (
                    <Link
                      key={product.id}
                      to="/inventory"
                      className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted/50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-data text-xs font-bold text-primary">
                        {index + 1}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="mb-1 flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-foreground">
                            {product.name || "Unnamed product"}
                          </span>
                          <span className="shrink-0 font-data text-sm font-semibold text-foreground">
                            {compactCurrency(value)}
                          </span>
                        </span>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-violet-500 transition-all duration-700"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          icon={Command}
          tone="indigo"
          title="Quick actions"
          description="The tasks that get run most, one click away"
        >
          <div className="stagger-children grid grid-cols-3 gap-3 sm:grid-cols-6">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="lift group flex flex-col items-center gap-2 rounded-2xl border border-border bg-muted/30 p-3 text-center hover:border-primary/40"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${action.color}`}
                >
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium leading-tight text-foreground">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </PageContainer>
    </PageBackground>
  );
}
