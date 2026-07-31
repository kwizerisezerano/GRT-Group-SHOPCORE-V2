import { useMemo, useState } from "react";
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
import { isOnline } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/utils/currency";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Box,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
  Zap,
  X,
  Wifi,
  WifiOff,
  Database,
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
  RotateCcw,
  RefreshCcw,
  Eye,
  CreditCard,
  ScanLine,
  Timer,
  Target,
  Crown,
  FileWarning,
  ClipboardList,
  ArrowLeftRight,
  MapPin,
  Percent,
  Banknote,
  Route,
  Lock,
  UserRound,
  FileText,
  Archive,
  Smartphone,
  Command,
} from "lucide-react";
import {
  Area,
  AreaChart,
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

const NAVY = "#2563EB";

const QUICK_ACTIONS = [
  { label: "New Sale", to: "/pos", icon: Receipt, color: "bg-emerald-500/10 text-emerald-600" },
  { label: "Add Product", to: "/products", icon: Package, color: "bg-violet-500/10 text-violet-600" },
  { label: "New Purchase", to: "/purchases", icon: ShoppingCart, color: "bg-orange-500/10 text-orange-600" },
  { label: "Add Expense", to: "/expenses", icon: Wallet, color: "bg-rose-500/10 text-rose-600" },
  { label: "Stock Audit", to: "/stock-movements", icon: Activity, color: "bg-blue-500/10 text-blue-600" },
  { label: "Reports", to: "/reports", icon: BarChart3, color: "bg-cyan-500/10 text-cyan-600" },
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

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

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

const HEALTH_GRADIENTS: Record<string, string> = {
  "Inventory Health": "from-amber-400 to-orange-500",
  "Sales Health": "from-emerald-400 to-green-600",
  "Sync Health": "from-cyan-400 to-blue-500",
  "Audit Health": "from-violet-400 to-purple-600",
  "Catalog Health": "from-blue-400 to-indigo-500",
};

const INVENTORY_BAR_GRADIENTS = [
  "from-emerald-400 to-green-600",
  "from-blue-400 to-cyan-500",
  "from-violet-400 to-purple-600",
  "from-orange-400 to-amber-500",
  "from-pink-400 to-rose-500",
  "from-indigo-400 to-blue-600",
];

const PAYMENT_COLORS = [
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
];

function healthGradient(label: string, value: number) {
  if (HEALTH_GRADIENTS[label]) return HEALTH_GRADIENTS[label];
  if (value >= 80) return "from-emerald-400 to-green-600";
  if (value >= 55) return "from-amber-400 to-orange-500";
  return "from-rose-400 to-red-600";
}


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

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeInsight, setActiveInsight] = useState<"revenue" | "profit" | "inventory" | "risk">("revenue");

  const { data: sales = [], isLoading: lSales } = useSales();
  const { data: products = [], isLoading: lProducts } = useProducts();
  const { data: purchases = [] } = usePurchases();
  const { data: expenses = [] } = useExpenses();
  const { data: customers = [] } = useCustomers();
  const { data: movements = [] } = useStockMovements(1000);

  const offlineModeActive = !isOnline() || isOfflineMode();
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

  const notificationItems = useMemo(() => {
    const items: any[] = [];

    if (stats.lowStock > 0 || stats.outOfStock > 0) {
      items.push({
        id: "low-stock",
        title: "Stock Alerts",
        message: `${stats.lowStock} item${stats.lowStock === 1 ? "" : "s"} below minimum stock. ${stats.outOfStock} out of stock.`,
        type: "warning",
        to: "/inventory",
        icon: AlertTriangle,
      });
    }

    if (stats.negativeMarginProducts > 0 || stats.missingPriceProducts > 0) {
      items.push({
        id: "pricing-risk",
        title: "Pricing Risk",
        message: `${stats.negativeMarginProducts} loss-risk product${stats.negativeMarginProducts === 1 ? "" : "s"} and ${stats.missingPriceProducts} product${stats.missingPriceProducts === 1 ? "" : "s"} missing cost/selling price.`,
        type: "danger",
        to: "/products",
        icon: DollarSign,
      });
    }

    if (stats.riskMovements > 0) {
      items.push({
        id: "stock-risk",
        title: "Stock Audit Risk",
        message: `${stats.riskMovements} stock movement${stats.riskMovements === 1 ? "" : "s"} need review. Critical: ${stats.criticalMovements}.`,
        type: "danger",
        to: "/stock-movements",
        icon: FileWarning,
      });
    }

    if (stats.pendingPurchases > 0) {
      items.push({
        id: "pending-purchases",
        title: "Pending Purchases",
        message: `${stats.pendingPurchases} purchase order${stats.pendingPurchases === 1 ? "" : "s"} awaiting follow-up.`,
        type: "info",
        to: "/purchases",
        icon: ShoppingCart,
      });
    }

    if (stats.overdueBalances > 0) {
      items.push({
        id: "customer-balances",
        title: "Customer Balances",
        message: `${formatCurrency(stats.overdueBalances)} currently due from customers.`,
        type: "danger",
        to: "/customers",
        icon: Users,
      });
    }

    if (stats.today.orders === 0) {
      items.push({
        id: "no-sales-today",
        title: "No Sales Today",
        message: "No sales have been recorded today yet.",
        type: "info",
        to: "/pos",
        icon: Receipt,
      });
    }

    if (stats.pendingRecords > 0) {
      items.push({
        id: "pending-sync",
        title: "Offline Sync Pending",
        message: `${stats.pendingRecords} record${stats.pendingRecords === 1 ? "" : "s"} waiting to sync when online login is available.`,
        type: "warning",
        to: "/settings",
        icon: Database,
      });
    }

    if (items.length === 0) {
      items.push({
        id: "all-good",
        title: "Operations Clear",
        message: "No urgent alerts right now.",
        type: "success",
        to: "/notifications",
        icon: CheckCircle2,
      });
    }

    return items;
  }, [
    stats.lowStock,
    stats.outOfStock,
    stats.negativeMarginProducts,
    stats.missingPriceProducts,
    stats.riskMovements,
    stats.criticalMovements,
    stats.pendingPurchases,
    stats.overdueBalances,
    stats.today.orders,
    stats.pendingRecords,
  ]);

  const alertCount = notificationItems.filter((item) => item.id !== "all-good").length;

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
      { title: "Pending Sync", value: String(stats.pendingRecords), to: "/settings", icon: Database },
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

  const topSummaryCards = [
    {
      label: "Today's Sales",
      value: formatCurrency(stats.today.sales),
      helper: `${stats.today.orders} order${stats.today.orders === 1 ? "" : "s"} today`,
      icon: Receipt,
      wrapper: "bg-rose-600 border-rose-600 text-white",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
      to: "/sales",
    },
    {
      label: "System Health",
      value: `${stats.systemHealthScore}%`,
      helper: `${getMetricTone(stats.systemHealthScore).includes("emerald") ? "Strong" : stats.systemHealthScore >= 55 ? "Needs review" : "Critical"} operation score`,
      icon: Gauge,
      wrapper: "bg-emerald-600 border-emerald-600 text-white",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
      to: "/qa",
    },
    {
      label: "Monthly Sales",
      value: formatCurrency(stats.month.sales),
      helper: `${stats.monthChange >= 0 ? "+" : ""}${stats.monthChange.toFixed(1)}% vs last month`,
      icon: BarChart3,
      wrapper: "bg-orange-600 border-orange-600 text-white",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
      to: "/reports",
    },
    {
      label: "Inventory Value",
      value: compactCurrency(stats.totalInventoryValue),
      helper: `${compactCurrency(stats.inventoryPotentialProfit)} potential profit`,
      icon: Box,
      wrapper: "bg-violet-600 border-violet-600 text-white",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
      to: "/inventory",
    },
  ];

  const kpis = [
    {
      label: "Today Sales",
      value: formatCurrency(stats.today.sales),
      change: `${stats.todayChange >= 0 ? "+" : ""}${stats.todayChange.toFixed(1)}% vs yesterday`,
      icon: ShoppingCart,
      bg: "bg-blue-600",
      up: stats.todayChange >= 0,
      to: "/sales",
    },
    {
      label: "Weekly Sales",
      value: formatCurrency(stats.week.sales),
      change: `${stats.weekChange >= 0 ? "+" : ""}${stats.weekChange.toFixed(1)}% vs last week`,
      icon: TrendingUp,
      bg: "bg-emerald-600",
      up: stats.weekChange >= 0,
      to: "/reports",
    },
    {
      label: "Monthly Sales",
      value: formatCurrency(stats.month.sales),
      change: `${stats.monthChange >= 0 ? "+" : ""}${stats.monthChange.toFixed(1)}% vs last month`,
      icon: BarChart3,
      bg: "bg-orange-600",
      up: stats.monthChange >= 0,
      to: "/reports",
    },
    {
      label: "Today Profit",
      value: formatCurrency(stats.today.profit),
      change: stats.today.loss > 0 ? `${formatCurrency(stats.today.loss)} loss` : "Net positive today",
      icon: DollarSign,
      bg: "bg-emerald-600",
      up: stats.today.netProfit >= 0,
      to: "/reports",
    },
    {
      label: "Stock Risk",
      value: String(stats.riskMovements),
      change: `${stats.criticalMovements} critical · ${stats.negativeAfterMovements} negative after`,
      icon: FileWarning,
      bg: "bg-rose-600",
      up: stats.riskMovements === 0,
      to: "/stock-movements",
    },
  ];

  const healthCards = [
    { label: "Inventory Health", value: stats.inventoryHealthScore, icon: PackageCheck, to: "/inventory" },
    { label: "Sales Health", value: stats.salesHealthScore, icon: Receipt, to: "/sales" },
    { label: "Sync Health", value: stats.syncHealthScore, icon: UploadCloud, to: "/settings" },
    { label: "Audit Health", value: stats.riskHealthScore, icon: ShieldCheck, to: "/stock-movements" },
    { label: "Catalog Health", value: stats.avgProductHealth, icon: Gauge, to: "/products" },
  ];

  const periodCards = [
    { label: "Today's Profit", value: formatCurrency(stats.today.profit), helper: `Expenses: ${formatCurrency(stats.today.expenses)}`, icon: DollarSign, color: "emerald", to: "/reports" },
    { label: "Today's Loss", value: formatCurrency(stats.today.loss), helper: "Loss only shows when net profit is negative", icon: TrendingDown, color: "rose", to: "/reports" },
    { label: "Weekly Profit", value: formatCurrency(stats.week.profit), helper: `Expenses: ${formatCurrency(stats.week.expenses)}`, icon: DollarSign, color: "blue", to: "/reports" },
    { label: "Weekly Loss", value: formatCurrency(stats.week.loss), helper: "Current week net loss", icon: TrendingDown, color: "orange", to: "/reports" },
    { label: "Monthly Profit", value: formatCurrency(stats.month.profit), helper: `Net margin: ${stats.netMarginRate.toFixed(1)}%`, icon: Percent, color: "violet", to: "/reports" },
    { label: "Monthly Loss", value: formatCurrency(stats.month.loss), helper: "Current month net loss", icon: TrendingDown, color: "rose", to: "/reports" },
  ];

  const insightTabs = [
    { key: "revenue" as const, label: "Revenue", icon: Receipt },
    { key: "profit" as const, label: "Profit", icon: DollarSign },
    { key: "inventory" as const, label: "Inventory", icon: Package },
    { key: "risk" as const, label: "Risk", icon: ShieldCheck },
  ];

  const insightCards = {
    revenue: [
      { label: "Today", value: formatCurrency(stats.today.sales), helper: `${stats.today.orders} orders`, icon: Receipt },
      { label: "Week", value: formatCurrency(stats.week.sales), helper: `${stats.week.orders} orders`, icon: CalendarDays },
      { label: "Month", value: formatCurrency(stats.month.sales), helper: `${stats.month.orders} orders`, icon: BarChart3 },
    ],
    profit: [
      { label: "Gross Profit", value: formatCurrency(stats.month.grossProfit), helper: `${stats.grossMarginRate.toFixed(1)}% gross margin`, icon: DollarSign },
      { label: "Net Profit", value: formatCurrency(stats.month.profit), helper: `${stats.netMarginRate.toFixed(1)}% net margin`, icon: TrendingUp },
      { label: "Expenses", value: formatCurrency(stats.month.expenses), helper: "Month expenses", icon: Wallet },
    ],
    inventory: [
      { label: "Cost Value", value: compactCurrency(stats.totalInventoryValue), helper: "Stock cost value", icon: Box },
      { label: "Retail Value", value: compactCurrency(stats.retailInventoryValue), helper: "Stock selling value", icon: PackageCheck },
      { label: "Search Quality", value: `${stats.productSearchQuality}%`, helper: "SKU/barcode/price readiness", icon: ScanLine },
    ],
    risk: [
      { label: "Low Stock", value: String(stats.lowStock), helper: `${stats.outOfStock} out of stock`, icon: AlertTriangle },
      { label: "Audit Risk", value: String(stats.riskMovements), helper: `${stats.criticalMovements} critical`, icon: FileWarning },
      { label: "Sync Pending", value: String(stats.pendingRecords), helper: `${stats.offlineRecords} offline records`, icon: UploadCloud },
    ],
  };

  const executiveControlCards = [
    {
      label: "Cash Flow Pulse",
      value: formatCurrency(stats.month.netProfit),
      helper: `${stats.netMarginRate.toFixed(1)}% net margin · ${formatCurrency(stats.month.expenses)} expenses`,
      icon: Banknote,
      to: "/reports",
      tone: stats.month.netProfit >= 0 ? "emerald" : "rose",
    },
    {
      label: "Inventory Capital",
      value: compactCurrency(stats.retailInventoryValue),
      helper: `${compactCurrency(stats.totalInventoryValue)} cost value · ${stats.activeProducts} active products`,
      icon: Archive,
      to: "/inventory",
      tone: "violet",
    },
    {
      label: "Operational Exposure",
      value: String(stats.lowStock + stats.outOfStock + stats.riskMovements),
      helper: `${stats.lowStock} low stock · ${stats.outOfStock} out · ${stats.riskMovements} audit risks`,
      icon: ShieldCheck,
      to: "/qa",
      tone: stats.lowStock + stats.outOfStock + stats.riskMovements > 0 ? "amber" : "emerald",
    },
    {
      label: "Sync Reliability",
      value: `${stats.syncHealthScore}%`,
      helper: `${stats.pendingRecords} pending · ${stats.offlineRecords} offline records`,
      icon: UploadCloud,
      to: "/settings",
      tone: stats.pendingRecords > 0 ? "amber" : "blue",
    },
  ];

  const missionActions = [
    {
      title: stats.outOfStock > 0 ? "Restore sales continuity" : "Increase today's revenue",
      description: stats.outOfStock > 0
        ? `Restock ${stats.outOfStock} out-of-stock products before the next cashier shift.`
        : `Push fast checkout and review products with strong stock value today.`,
      to: stats.outOfStock > 0 ? "/inventory" : "/pos",
      icon: stats.outOfStock > 0 ? PackageX : Activity,
      badge: stats.outOfStock > 0 ? "Priority" : "Growth",
    },
    {
      title: stats.pendingRecords > 0 ? "Clear pending sync" : "Audit data quality",
      description: stats.pendingRecords > 0
        ? `${stats.pendingRecords} offline records should be synced before closing operations.`
        : `${stats.productSearchQuality}% catalog search quality. Review missing barcodes or prices if needed.`,
      to: stats.pendingRecords > 0 ? "/settings" : "/products",
      icon: stats.pendingRecords > 0 ? UploadCloud : ScanLine,
      badge: stats.pendingRecords > 0 ? "Sync" : "Catalog",
    },
    {
      title: stats.riskMovements > 0 ? "Review stock audit risks" : "Executive report ready",
      description: stats.riskMovements > 0
        ? `${stats.riskMovements} stock movements need management review for accuracy.`
        : `Generate the daily executive PDF/CSV report for sales, profit, stock, and risk.`,
      to: stats.riskMovements > 0 ? "/stock-movements" : "/reports",
      icon: stats.riskMovements > 0 ? FileWarning : FileText,
      badge: stats.riskMovements > 0 ? "Risk" : "Report",
    },
  ];

  const businessPulse = [
    { label: "Orders Today", value: compactNumber(stats.today.orders), icon: Timer, helper: "Cashier activity" },
    { label: "Stock In", value: compactNumber(stats.stockIn), icon: ArrowDownRight, helper: "Movement quantity" },
    { label: "Stock Out", value: compactNumber(stats.stockOut), icon: ArrowUpRight, helper: "Movement quantity" },
    { label: "Customer Credit", value: compactCurrency(stats.overdueBalances), icon: CreditCard, helper: "Outstanding balances" },
    { label: "Purchases Month", value: compactCurrency(stats.monthPurchaseValue), icon: Truck, helper: "Procurement value" },
    { label: "Refunded Sales", value: compactNumber(stats.fullyRefunded + stats.partialRefunded), icon: RotateCcw, helper: "Returns & refunds" },
  ];


  const attentionRequired = [
    {
      title: "Products below reorder point",
      value: String(stats.lowStock),
      helper: `${stats.outOfStock} products are already out of stock`,
      to: "/inventory",
      icon: PackageX,
      level: stats.outOfStock > 0 ? "Critical" : stats.lowStock > 0 ? "High" : "Clear",
      surface: stats.lowStock + stats.outOfStock > 0 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      button: stats.lowStock + stats.outOfStock > 0 ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      title: "Purchases awaiting follow-up",
      value: String(stats.pendingPurchases),
      helper: "Purchase orders requiring receiving or review",
      to: "/purchases",
      icon: Truck,
      level: stats.pendingPurchases > 0 ? "Medium" : "Clear",
      surface: stats.pendingPurchases > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      button: stats.pendingPurchases > 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      title: "Stock movements needing audit",
      value: String(stats.riskMovements),
      helper: `${stats.criticalMovements} critical records and ${stats.negativeAfterMovements} negative stock events`,
      to: "/stock-movements",
      icon: ShieldCheck,
      level: stats.criticalMovements > 0 ? "Critical" : stats.riskMovements > 0 ? "High" : "Clear",
      surface: stats.riskMovements > 0 ? "border-violet-200 bg-violet-50 text-violet-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      button: stats.riskMovements > 0 ? "bg-violet-600 hover:bg-violet-700" : "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      title: "Offline records waiting to sync",
      value: String(stats.pendingRecords),
      helper: `${stats.offlineRecords} records were created or edited locally`,
      to: "/settings",
      icon: UploadCloud,
      level: stats.pendingRecords > 0 ? "Sync" : "Clear",
      surface: stats.pendingRecords > 0 ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      button: stats.pendingRecords > 0 ? "bg-cyan-600 hover:bg-cyan-700" : "bg-emerald-600 hover:bg-emerald-700",
    },
  ];

  const replenishmentQueue = stats.lowStockItems.slice(0, 5).map((product: any) => ({
    name: product.name || "Unnamed product",
    stock: productStock(product),
    minimum: productMinStock(product),
    sku: product.sku || product.barcode || "No SKU",
  }));

  const executiveAlerts = [
    {
      title: "Negative margin products",
      value: stats.negativeMarginProducts,
      helper: "Selling price is below or missing cost control",
      to: "/products",
      icon: DollarSign,
      color: "bg-rose-600",
    },
    {
      title: "Missing barcodes or prices",
      value: stats.noBarcodeProducts + stats.missingPriceProducts,
      helper: "Catalog quality issues affecting cashier speed and reporting",
      to: "/products",
      icon: ScanLine,
      color: "bg-orange-600",
    },
    {
      title: "Customer credit exposure",
      value: compactCurrency(stats.overdueBalances),
      helper: "Outstanding customer balances requiring follow-up",
      to: "/customers",
      icon: CreditCard,
      color: "bg-blue-600",
    },
  ];

  const operationsBoard = [
    {
      title: "Replenishment Queue",
      value: String(stats.lowStock + stats.outOfStock),
      helper: `${stats.lowStock} below reorder · ${stats.outOfStock} out of stock`,
      to: "/inventory",
      icon: PackageCheck,
      color: "bg-blue-600 hover:bg-blue-700",
      surface: "border-blue-200 bg-blue-50/70 text-blue-800",
    },
    {
      title: "Approval & Follow-up",
      value: String(stats.pendingPurchases + stats.riskMovements),
      helper: `${stats.pendingPurchases} purchase follow-ups · ${stats.riskMovements} stock reviews`,
      to: "/purchases",
      icon: ClipboardList,
      color: "bg-amber-600 hover:bg-amber-700",
      surface: "border-amber-200 bg-amber-50/80 text-amber-800",
    },
    {
      title: "Audit Control",
      value: `${stats.riskHealthScore}%`,
      helper: `${stats.criticalMovements} critical movements · ${stats.negativeAfterMovements} negative stock events`,
      to: "/stock-movements",
      icon: ShieldCheck,
      color: "bg-violet-600 hover:bg-violet-700",
      surface: "border-violet-200 bg-violet-50/80 text-violet-800",
    },
    {
      title: "Offline Reliability",
      value: `${stats.syncHealthScore}%`,
      helper: `${stats.pendingRecords} waiting to sync · ${stats.offlineRecords} local records`,
      to: "/settings",
      icon: UploadCloud,
      color: "bg-cyan-600 hover:bg-cyan-700",
      surface: "border-cyan-200 bg-cyan-50/80 text-cyan-800",
    },
  ];

  const processLanes = [
    { label: "Sell", value: compactCurrency(stats.today.sales), helper: "POS and cashier flow", icon: Receipt, to: "/pos", color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "Replenish", value: String(stats.lowStock + stats.outOfStock), helper: "Reorder planning", icon: Truck, to: "/purchases", color: "bg-amber-600 hover:bg-amber-700" },
    { label: "Control", value: String(stats.riskMovements), helper: "Audit exceptions", icon: ShieldCheck, to: "/stock-movements", color: "bg-rose-600 hover:bg-rose-700" },
    { label: "Report", value: `${stats.systemHealthScore}%`, helper: "Executive readiness", icon: BarChart3, to: "/reports", color: "bg-blue-600 hover:bg-blue-700" },
  ];

  if (loading) {
    return (
      <PageBackground image={bgWarehouse} opacity={0.04}>
        <div className="space-y-5">
          <Skeleton className="h-32 rounded-3xl" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </PageBackground>
    );
  }

  return (
    <PageBackground image={bgWarehouse} opacity={0.04}>
      <div className="space-y-5 animate-fade-in">
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.45fr]">
              <div className="relative overflow-hidden border-b xl:border-b-0 xl:border-r bg-white p-4 lg:p-7">
                <div className="absolute -right-16 -top-16 h-28 w-28 rounded-full bg-blue-600/10 blur-2xl" />
                <div className="absolute -bottom-20 -left-20 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700 mb-3">
                    <Command className="w-3.5 h-3.5" />
                    Executive Operations Center
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white ${offlineModeActive ? "bg-amber-500" : "bg-emerald-500"}`} />
                    </div>

                    <div>
                      <h1 className="text-xl lg:text-xl font-bold tracking-tight text-slate-950">
                        Operations Dashboard
                      </h1>

                      <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        Monitor revenue, profit, loss, stock health, audit risk, customer balances, offline sync,
                        and operational readiness from one executive operations dashboard.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                        Today
                      </div>
                      <p className="text-sm font-semibold mt-1">{format(new Date(), "MMM dd, yyyy")}</p>
                    </div>

                    <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                        System Health
                      </div>
                      <p className={`text-sm font-semibold mt-1 ${getMetricTone(stats.systemHealthScore)}`}>
                        {stats.systemHealthScore}%
                      </p>
                    </div>

                    <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {offlineModeActive ? (
                          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        Data Source
                      </div>
                      <p className={`text-sm font-semibold mt-1 ${offlineModeActive ? "text-amber-600" : "text-emerald-600"}`}>
                        {offlineModeActive ? "Offline Cache" : "Live Online"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 bg-slate-50 p-4 lg:p-7">
                {topSummaryCards.map((item) => (
                  <Link key={item.label} to={item.to} className={`rounded-2xl border ${item.wrapper} p-3 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-2xl ${item.iconBox} flex items-center justify-center`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-current opacity-80" />
                    </div>
                    <p className="text-sm text-white/85 break-words leading-tight">{item.label}</p>
                    <p className={`font-bold font-data mt-1 leading-tight tracking-tight ${item.valueColor} text-lg break-words`}>
                      {item.value}
                    </p>
                    <div className="mt-2 inline-flex rounded-full border border-white/20 bg-white/20 px-2.5 py-0.5 text-[11px] text-white/90 break-words">
                      {item.helper}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {(offlineModeActive || stats.pendingRecords > 0) && (
          <Card className="rounded-xl border bg-amber-500/10 text-amber-900 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "Dashboard is using cached offline data" : "Offline data is waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending records: {stats.pendingRecords}. Offline-created/edited records included: {stats.offlineRecords}.
                    </p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="relative hidden md:block flex-1 max-w-2xl">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border shadow-sm">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={globalSearch}
                onChange={(event) => {
                  setGlobalSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && dashboardSearchResults[0]) {
                    navigate(dashboardSearchResults[0].to);
                    setSearchOpen(false);
                    setGlobalSearch("");
                  }

                  if (event.key === "Escape") {
                    setSearchOpen(false);
                    setGlobalSearch("");
                  }
                }}
                placeholder="Search anything: modules, sales, products, stock risk, customers, amounts, keywords..."
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-blue-500/80"
              />
              {globalSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalSearch("");
                    setSearchOpen(false);
                  }}
                  className="rounded-lg p-1 hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">
                  <Command className="w-3 h-3" /> /
                </span>
              )}
            </div>

            {searchOpen && globalSearch.trim() && (
              <div className="absolute left-0 right-0 top-12 z-[120] overflow-hidden rounded-2xl border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-3">
                  <div>
                    <p className="text-sm font-bold">Global System Search</p>
                    <p className="text-xs text-muted-foreground">
                      {dashboardSearchResults.length} result{dashboardSearchResults.length === 1 ? "" : "s"} found
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    Enter to open first
                  </Badge>
                </div>

                <div className="max-h-[460px] overflow-y-auto p-2">
                  {dashboardSearchResults.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      <Search className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      <p className="text-sm font-medium">No matching system records found</p>
                      <p className="mt-1 text-xs">Try invoice number, customer name, product SKU, stock risk, module name, or keyword.</p>
                    </div>
                  ) : (
                    dashboardSearchResults.map((result) => {
                      const Icon = result.icon;

                      return (
                        <button
                          key={result.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            navigate(result.to);
                            setSearchOpen(false);
                            setGlobalSearch("");
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-muted/70"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-700">
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold">{result.title}</p>
                              <Badge variant="secondary" className="rounded-full text-[10px]">
                                {result.type}
                              </Badge>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{result.subtitle}</p>
                          </div>

                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                className="w-9 h-9 rounded-2xl bg-card border shadow-sm flex items-center justify-center relative transition hover:bg-muted/50"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-rose-500 px-1 text-white text-[10px] flex items-center justify-center">
                    {alertCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-[100] w-[360px] overflow-hidden rounded-2xl border bg-card shadow-2xl">
                  <div className="flex items-center justify-between border-b p-4">
                    <div>
                      <h3 className="font-black">Notifications</h3>
                      <p className="text-xs text-muted-foreground">
                        {alertCount > 0 ? `${alertCount} active alert${alertCount === 1 ? "" : "s"}` : "No urgent alerts"}
                      </p>
                    </div>

                    <button type="button" onClick={() => setNotificationsOpen(false)} className="rounded-xl p-2 hover:bg-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="max-h-[390px] space-y-2 overflow-y-auto p-3">
                    {notificationItems.map((item) => (
                      <Link
                        key={item.id}
                        to={item.to}
                        onClick={() => setNotificationsOpen(false)}
                        className="flex gap-3 rounded-2xl border bg-muted/20 p-3 transition hover:bg-muted/50"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                            item.type === "warning"
                              ? "bg-amber-500/10 text-amber-600"
                              : item.type === "danger"
                              ? "bg-rose-500/10 text-rose-600"
                              : item.type === "success"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-blue-500/10 text-blue-600"
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.message}</p>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="border-t p-3">
                    <Link to="/notifications" onClick={() => setNotificationsOpen(false)}>
                      <Button variant="outline" className="w-full rounded-2xl">
                        View Notification Center
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link to="/reports">
              <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                <BarChart3 className="w-4 h-4 mr-2" />
                Reports
              </Button>
            </Link>
          </div>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.30)]">
          <CardContent className="p-0">
            <div className="grid gap-0 xl:grid-cols-[0.95fr_1.55fr]">
              <div className="border-b bg-blue-50/80 p-4 xl:border-b-0 xl:border-r lg:p-7">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  <Building2 className="h-3.5 w-3.5" />
                  Executive Operations Center
                </div>

                <h2 className="max-w-xl text-xl font-black tracking-tight text-slate-950 lg:text-xl">
                  Business Control Tower
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Live business control for sales, profit, inventory capital, purchasing pressure, credit exposure, sync reliability, and audit exceptions.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {executiveControlCards.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        item.tone === "emerald"
                          ? "border-emerald-200"
                          : item.tone === "rose"
                          ? "border-rose-200"
                          : item.tone === "amber"
                          ? "border-amber-200"
                          : item.tone === "violet"
                          ? "border-violet-200"
                          : "border-blue-200"
                      }`}
                    >
                      <div
                        className={`h-2 ${
                          item.tone === "emerald"
                            ? "bg-emerald-600"
                            : item.tone === "rose"
                            ? "bg-rose-600"
                            : item.tone === "amber"
                            ? "bg-amber-600"
                            : item.tone === "violet"
                            ? "bg-violet-600"
                            : "bg-blue-600"
                        }`}
                      />
                      <div className="p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white ${
                              item.tone === "emerald"
                                ? "bg-emerald-600"
                                : item.tone === "rose"
                                ? "bg-rose-600"
                                : item.tone === "amber"
                                ? "bg-amber-600"
                                : item.tone === "violet"
                                ? "bg-violet-600"
                                : "bg-blue-600"
                            }`}
                          >
                            <item.icon className="h-5 w-5" />
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5" />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                        <p className="mt-1 text-xl font-black font-data text-slate-950">{item.value}</p>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{item.helper}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 bg-slate-50/80 p-4 lg:p-7">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-950">Attention Required</h3>
                    <p className="text-sm text-slate-600">Actionable management signals from sales, purchasing, inventory, audit, and offline sync.</p>
                  </div>
                  <Badge className="w-fit rounded-full bg-indigo-600 text-white hover:bg-indigo-600">Live Review</Badge>
                </div>

                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                  {attentionRequired.map((item) => (
                    <Link key={item.title} to={item.to} className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.surface}`}>
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-white ${item.button}`}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        <Badge className={`rounded-full text-white ${item.button}`}>{item.level}</Badge>
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-75 break-words">{item.title}</p>
                      <p className="mt-1 text-xl font-black font-data break-words">{item.value}</p>
                      <p className="mt-2 min-h-[40px] text-xs leading-5 opacity-80 break-words">{item.helper}</p>
                      <Button className={`mt-4 h-9 rounded-xl px-3 text-xs text-white ${item.button}`}>Open</Button>
                    </Link>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-black text-amber-950">Replenishment Queue</h3>
                        <p className="text-xs text-amber-800/80">Products that need reorder planning.</p>
                      </div>
                      <Link to="/inventory">
                        <Button className="h-9 rounded-xl bg-amber-600 text-xs text-white hover:bg-amber-700">Open Inventory</Button>
                      </Link>
                    </div>
                    {replenishmentQueue.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                        <CheckCircle2 className="mb-2 h-5 w-5" />
                        Stock coverage is currently controlled.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {replenishmentQueue.map((product) => (
                          <div key={product.name + product.sku} className="rounded-2xl border border-white/70 bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-950">{product.name}</p>
                                <p className="text-xs text-slate-500">{product.sku}</p>
                              </div>
                              <Badge className="rounded-full bg-rose-600 text-white hover:bg-rose-600">{product.stock}/{product.minimum}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-black text-rose-950">Executive Alerts</h3>
                        <p className="text-xs text-rose-800/80">SAP-style controls for margin, catalog, and credit exposure.</p>
                      </div>
                      <Badge className="rounded-full bg-rose-600 text-white hover:bg-rose-600">Control</Badge>
                    </div>
                    <div className="grid gap-2">
                      {executiveAlerts.map((alert) => (
                        <Link key={alert.title} to={alert.to} className="rounded-2xl border border-white/80 bg-white p-3 transition hover:shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${alert.color}`}>
                              <alert.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-950">{alert.title}</p>
                              <p className="line-clamp-1 text-xs text-slate-500">{alert.helper}</p>
                            </div>
                            <p className="font-black font-data text-slate-950">{alert.value}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border bg-card shadow-sm overflow-hidden">
          <CardContent className="p-4 lg:p-4">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  <Route className="h-3.5 w-3.5" />
                  Operations Board
                </div>
                <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">ERP workflow controls</h2>
                <p className="mt-1 text-sm text-muted-foreground">Replenishment, approvals, audit control, and offline reliability in one management lane.</p>
              </div>
              <Link to="/reports">
                <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Open Executive Reports
                </Button>
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {operationsBoard.map((item) => (
                <Link key={item.title} to={item.to} className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.surface}`}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-70" />
                  </div>
                  <p className="text-xs font-semibold opacity-80 break-words">{item.title}</p>
                  <p className="mt-1 text-xl font-black font-data break-words">{item.value}</p>
                  <p className="mt-2 min-h-[38px] text-xs leading-5 opacity-80 break-words">{item.helper}</p>
                  <Button className={`mt-4 h-9 rounded-xl px-3 text-xs text-white ${item.color}`}>
                    Review
                  </Button>
                </Link>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {processLanes.map((lane) => (
                <Link key={lane.label} to={lane.to} className="rounded-xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground break-words">{lane.label}</p>
                      <p className="font-black font-data break-words">{lane.value}</p>
                      <p className="text-[11px] text-muted-foreground break-words">{lane.helper}</p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${lane.color}`}>
                      <lane.icon className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {kpis.map((kpi) => (
            <Link key={kpi.label} to={kpi.to}>
              <Card className={`rounded-2xl border ${kpi.bg} text-white shadow-sm overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center shadow-sm">
                      <kpi.icon className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-white/85 font-medium break-words">{kpi.label}</p>
                      <p className="text-xl font-bold font-data truncate break-words">{kpi.value}</p>
                      <p className="text-xs mt-1 text-white/80 break-words">{kpi.change}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className="xl:col-span-5 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold">System Health Score</h3>
                  <p className="text-xs text-muted-foreground">Operational readiness across all modules</p>
                </div>
                <Badge variant="outline" className={`rounded-full ${getMetricTone(stats.systemHealthScore)}`}>
                  {stats.systemHealthScore}%
                </Badge>
              </div>

              <div className="space-y-4">
                {healthCards.map((item) => (
                  <Link key={item.label} to={item.to} className="block rounded-2xl border bg-muted/20 p-3 hover:bg-muted/40 transition">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </span>
                      <span className={`font-data font-bold ${getMetricTone(item.value)}`}>{item.value}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${healthGradient(item.label, item.value)} shadow-sm`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-7 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div>
                  <h3 className="font-semibold">Executive Insights</h3>
                  <p className="text-xs text-muted-foreground">Business lens drilldown</p>
                </div>

                <div className="flex rounded-2xl border bg-muted/40 p-1">
                  {insightTabs.map((tab) => (
                    <Button
                      key={tab.key}
                      size="sm"
                      variant={activeInsight === tab.key ? "default" : "ghost"}
                      className={activeInsight === tab.key ? "rounded-xl h-8 bg-blue-600 text-white hover:bg-blue-700" : "rounded-xl h-8"}
                      onClick={() => setActiveInsight(tab.key)}
                    >
                      <tab.icon className="w-4 h-4 mr-1.5" />
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {insightCards[activeInsight].map((item) => (
                  <div key={item.label} className="rounded-xl border bg-muted/20 p-4">
                    <div className="w-9 h-9 rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center mb-4">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xl font-black font-data break-words">{item.value}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{item.helper}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border bg-gradient-to-br from-blue-600/10 to-transparent p-4">
                <p className="text-sm font-semibold text-blue-700">Management Recommendation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stats.outOfStock > 0
                    ? `Restock ${stats.outOfStock} out-of-stock products first to protect sales continuity.`
                    : stats.riskMovements > 0
                    ? `Review ${stats.riskMovements} risky stock movement records to keep inventory accurate.`
                    : stats.pendingRecords > 0
                    ? `Sync ${stats.pendingRecords} pending offline records before closing today.`
                    : stats.today.orders === 0
                    ? "Start with a new POS sale or verify that today's sales are syncing correctly."
                    : "System looks stable. Review top products and profit trends for growth opportunities."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {periodCards.map((item) => {
            const cardTone =
              item.color === "emerald"
                ? "border-emerald-500 bg-emerald-600 text-white shadow-emerald-600/20"
                : item.color === "rose"
                ? "border-rose-500 bg-rose-600 text-white shadow-rose-600/20"
                : item.color === "blue"
                ? "border-blue-500 bg-blue-600 text-white shadow-blue-600/20"
                : item.color === "orange"
                ? "border-orange-500 bg-orange-600 text-white shadow-orange-600/20"
                : "border-violet-500 bg-violet-600 text-white shadow-violet-600/20";

            return (
              <Link key={item.label} to={item.to}>
                <Card className={`overflow-hidden rounded-2xl border shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl ${cardTone}`}>
                  <CardContent className="relative p-4">
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15" />
                    <div className="relative flex items-center gap-4">
                      <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-white/20 text-white">
                        <item.icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/80">{item.label}</p>
                        <p className="mt-1 truncate font-data text-xl font-black text-white">{item.value}</p>
                        <p className="mt-1 text-xs leading-5 text-orange-700">{item.helper}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className="xl:col-span-8 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">Sales, Profit, Expenses & Loss Overview</h3>
                  <p className="text-xs text-muted-foreground">Last 7 days business performance</p>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {offlineModeActive ? "Offline cache" : "Live"}
                </Badge>
              </div>

              <ResponsiveContainer width="100%" height={310}>
                <ComposedChart data={stats.chartData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NAVY} stopOpacity={0.26} />
                      <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" opacity={0.25} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                  <Legend />
                  <Area type="monotone" dataKey="sales" stroke={ANALYTICS_COLORS.revenue} strokeWidth={3} fill="url(#salesGradient)" />
                  <Bar dataKey="expenses" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="profit" stroke={ANALYTICS_COLORS.profit} strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <h3 className="font-semibold">Inventory by Category</h3>
              <p className="text-xs text-muted-foreground mb-4">Retail stock value distribution</p>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={stats.categoryData.length ? stats.categoryData : [{ name: "No Data", value: 1 }]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {(stats.categoryData.length ? stats.categoryData : [{ name: "No Data", value: 1 }]).map((_, index) => (
                      <Cell key={index} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2">
                {stats.categoryData.slice(0, 4).map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} />
                      {item.name}
                    </span>
                    <span className="font-data">{compactCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className="xl:col-span-4 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {QUICK_ACTIONS.map((action) => (
                  <Link key={action.label} to={action.to} className="group text-center">
                    <div className={`mx-auto w-12 h-12 rounded-2xl ${action.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                      <action.icon className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] mt-2 leading-tight">{action.label}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">Business Control Panel</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Customers", value: stats.activeCustomers, icon: Users, to: "/customers" },
                  { label: "Products", value: stats.activeProducts, icon: Package, to: "/products" },
                  { label: "Purchases", value: stats.pendingPurchases, icon: Truck, to: "/purchases" },
                  { label: "Refunded", value: stats.fullyRefunded, icon: Receipt, to: "/sales" },
                ].map((item) => (
                  <Link key={item.label} to={item.to} className="rounded-xl border bg-muted/30 p-3 hover:bg-muted/50 transition">
                    <item.icon className="w-4 h-4 text-blue-700 mb-2" />
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-data font-bold">{item.value}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 rounded-3xl shadow-sm border overflow-hidden">
            <CardContent className="p-4 relative">
              <p className="text-sm text-muted-foreground">Inventory Cost Value</p>
              <p className="text-xl font-bold font-data mt-1 break-words">{formatCurrency(stats.totalInventoryValue)}</p>
              <p className="text-xs text-muted-foreground mt-2">Retail value: {formatCurrency(stats.retailInventoryValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">Potential profit: {formatCurrency(stats.inventoryPotentialProfit)}</p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-amber-500/10 p-3 text-center">
                  <p className="text-xs text-amber-700">Low</p>
                  <p className="font-data font-bold">{stats.lowStock}</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3 text-center">
                  <p className="text-xs text-rose-700">Out</p>
                  <p className="font-data font-bold">{stats.outOfStock}</p>
                </div>
                <div className="rounded-xl bg-blue-500/10 p-3 text-center">
                  <p className="text-xs text-blue-700">No Barcode</p>
                  <p className="font-data font-bold">{stats.noBarcodeProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className="xl:col-span-8 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Recent Sales</h3>
                <Link to="/sales" className="text-xs text-primary hover:underline">View All</Link>
              </div>

              {stats.recentSales.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No sales yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="pb-3 font-medium">Invoice</th>
                        <th className="pb-3 font-medium">Customer</th>
                        <th className="pb-3 font-medium text-center">Items</th>
                        <th className="pb-3 font-medium text-right">Amount</th>
                        <th className="pb-3 font-medium text-right">Profit</th>
                        <th className="pb-3 font-medium text-right">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentSales.map((sale) => (
                        <tr key={sale.id} className="border-b last:border-0">
                          <td className="py-3 font-data text-xs">{sale.invoice_no || sale.receipt_no || "-"}</td>
                          <td className="py-3">
                            <div className="flex flex-col">
                              <span>{sale.customer_name || "Walk-in Customer"}</span>
                              {(isFullyRefundedSale(sale) || getSaleStatus(sale).includes("partial") || isCancelledSale(sale)) && (
                                <span className="mt-1 text-[10px] text-muted-foreground capitalize">
                                  {getSaleStatus(sale).replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-center font-data text-xs">
                            {getSaleItemSummary(sale).net}
                            {getSaleItemSummary(sale).refunded > 0 ? (
                              <span className="ml-1 text-orange-600">(-{getSaleItemSummary(sale).refunded})</span>
                            ) : null}
                          </td>
                          <td className="py-3 text-right font-data font-semibold">{formatCurrency(getSaleTotal(sale))}</td>
                          <td className="py-3 text-right font-data font-semibold text-emerald-600">{formatCurrency(getSaleGrossProfit(sale))}</td>
                          <td className="py-3 text-right text-xs text-muted-foreground">
                            {safeDateText(sale.created_at || sale.created_offline_at || sale.date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Recent Stock Activity</h3>
              <div className="space-y-4">
                {!stats.recentMovements || stats.recentMovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  stats.recentMovements.map((movement: any) => (
                    <Link key={movement.id} to="/stock-movements" className="flex items-start gap-3 rounded-2xl p-2 hover:bg-muted/40 transition">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${safeNumber(movement.quantity_change) > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                        {safeNumber(movement.quantity_change) > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{movement.product_name || "-"}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {movement.movement_type || "movement"} · {movement.reference || "No reference"}
                        </p>
                      </div>

                      <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {safeDateText((movement as any).created_at || (movement as any).created_offline_at)}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className="xl:col-span-7 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Top Inventory Value Products</h3>
              <div className="space-y-3">
                {stats.topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No product stock value yet.</p>
                ) : (
                  stats.topProducts.map((product: any) => {
                    const value = productStock(product) * productPrice(product);
                    const percent = stats.retailInventoryValue > 0 ? Math.min(100, (value / stats.retailInventoryValue) * 100) : 0;

                    return (
                      <Link key={product.id || product.sku || product.name} to="/products" className="block rounded-2xl border bg-muted/20 p-3 hover:bg-muted/40 transition">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{product.name}</span>
                          <span className="font-data font-semibold">{compactCurrency(value)}</span>
                        </div>
                        <Progress value={percent} />
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Stock: {productStock(product)} · Margin: {productMargin(product).toFixed(1)}%</span>
                          <span>{product.category || "Uncategorized"}</span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-5 rounded-3xl shadow-sm border">
            <CardContent className="p-4">
              <h3 className="font-semibold">Sales by Payment Method</h3>
              <p className="text-xs text-muted-foreground mb-4">Revenue distribution by tender type</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.salesByPayment.length ? stats.salesByPayment : [{ name: "No Data", value: 0 }]}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill={ANALYTICS_COLORS.revenue} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className="xl:col-span-8 overflow-hidden rounded-[2rem] border bg-white shadow-sm">
            <CardContent className="relative p-0">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />
                <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />
                <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl" />
              </div>

              <div className="relative border-b bg-white/70 p-4 backdrop-blur-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <Badge variant="outline" className="mb-3 rounded-full border-cyan-500/30 bg-cyan-500/10 text-cyan-700">
                      <Activity className="mr-1 h-3.5 w-3.5" />
                      Operations Analytics Canvas
                    </Badge>
                    <h3 className="text-xl font-black tracking-tight">Business Movement Map</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Revenue momentum, profit control, payment behavior, and operational risk in one control view.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margin</p>
                      <p className={`font-black ${stats.netMarginRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {stats.netMarginRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-xl border bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk</p>
                      <p className={stats.riskMovements > 0 ? "font-black text-rose-600" : "font-black text-emerald-600"}>
                        {stats.riskMovements}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sync</p>
                      <p className={stats.pendingRecords > 0 ? "font-black text-amber-600" : "font-black text-emerald-600"}>
                        {stats.pendingRecords}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative grid gap-4 p-4 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border bg-white/85 p-3 shadow-sm backdrop-blur">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">Revenue pulse</h4>
                      <p className="text-xs text-muted-foreground">Sales, profit, expenses, and purchases across 7 days.</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={stats.chartData}>
                        <CartesianGrid vertical={false} strokeDasharray="4 4" opacity={0.25} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                        <Legend />
                        <Area type="monotone" dataKey="sales" name="Sales" fill={ANALYTICS_COLORS.revenue} stroke={ANALYTICS_COLORS.revenue} fillOpacity={0.08} />
                        <Bar dataKey="expenses" name="Expenses" fill={ANALYTICS_COLORS.danger} radius={[8, 8, 0, 0]} />
                        <Line type="monotone" dataKey="profit" name="Profit" stroke={ANALYTICS_COLORS.profit} strokeWidth={3} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border bg-white/85 p-3 shadow-sm backdrop-blur">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">Payment intelligence</h4>
                      <p className="text-xs text-muted-foreground">Share of revenue by payment method.</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                      <CreditCard className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.salesByPayment.length ? stats.salesByPayment : [{ name: "No sales", value: 1 }]}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={4}
                          >
                            {(stats.salesByPayment.length ? stats.salesByPayment : [{ name: "No sales", value: 1 }]).map((entry: any, index: number) => (
                              <Cell key={`payment-${entry.name}-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => stats.salesByPayment.length ? formatCurrency(Number(value)) : "No sales"} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      {(stats.salesByPayment.length ? stats.salesByPayment : [{ name: "No sales", value: 0 }]).slice(0, 5).map((item: any, index: number) => (
                        <div key={item.name} className="flex items-center justify-between gap-2 rounded-2xl border bg-muted/20 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} />
                            <span className="truncate text-xs font-medium">{item.name}</span>
                          </div>
                          <span className="text-xs font-bold font-data">{formatCurrency(Number(item.value || 0))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border bg-white/85 p-3 shadow-sm backdrop-blur">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">Risk radar</h4>
                      <p className="text-xs text-muted-foreground">Where the dashboard is asking for attention.</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={[
                          { name: "Low stock", value: stats.lowStock },
                          { name: "Out of stock", value: stats.outOfStock },
                          { name: "Price gaps", value: stats.missingPriceProducts },
                          { name: "Margin risk", value: stats.negativeMarginProducts },
                          { name: "Stock audit", value: stats.riskMovements },
                          { name: "Sync queue", value: stats.pendingRecords },
                        ]}
                        margin={{ left: 18, right: 10 }}
                      >
                        <CartesianGrid horizontal={false} strokeDasharray="4 4" opacity={0.25} />
                        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[0, 10, 10, 0]} fill={ANALYTICS_COLORS.danger} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border bg-white/85 p-3 shadow-sm backdrop-blur">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">Inventory value architecture</h4>
                      <p className="text-xs text-muted-foreground">Cost value, retail value, and potential profit.</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                      <Layers3 className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: "Cost value", value: Math.round(stats.totalInventoryValue) },
                          { name: "Retail value", value: Math.round(stats.retailInventoryValue) },
                          { name: "Potential profit", value: Math.round(stats.inventoryPotentialProfit) },
                          { name: "Monthly sales", value: Math.round(stats.month.sales) },
                          { name: "Monthly profit", value: Math.round(stats.month.profit) },
                        ]}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="4 4" opacity={0.25} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                        <Bar dataKey="value" fill={ANALYTICS_COLORS.violet} radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 overflow-hidden rounded-[2rem] border border-orange-200 bg-orange-50 text-slate-950 shadow-sm">
            <CardContent className="relative p-4">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-rose-500/15 blur-3xl" />

              <div className="relative">
                <Badge className="mb-4 rounded-full bg-orange-600 text-white hover:bg-orange-600">
                  <Crown className="mr-1 h-3.5 w-3.5" />
                  Operations Priority Board
                </Badge>

                <h3 className="text-xl font-black">Today’s operations priorities</h3>
                <p className="mt-2 text-sm leading-6 text-orange-700">
                  Clear action signals for sales activity, catalog correction, audit review, and offline synchronization.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "Sell", value: stats.today.orders, icon: ScanLine, helper: "orders today" },
                    { label: "Fix", value: stats.outOfStock + stats.missingPriceProducts, icon: Wrench, helper: "catalog issues" },
                    { label: "Review", value: stats.riskMovements, icon: Eye, helper: "audit signals" },
                    { label: "Sync", value: stats.pendingRecords, icon: RefreshCcw, helper: "pending records" },
                  ].map((item) => {
                    const priorityStyle =
                      item.label === "Sell"
                        ? "border-emerald-500 bg-emerald-600"
                        : item.label === "Fix"
                        ? "border-amber-500 bg-amber-600"
                        : item.label === "Review"
                        ? "border-violet-500 bg-violet-600"
                        : "border-cyan-500 bg-cyan-600";

                    return (
                      <div key={item.label} className={`rounded-2xl border p-4 text-white shadow-lg ${priorityStyle}`}>
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-semibold text-white/75">{item.label}</p>
                        <p className="mt-1 font-data text-xl font-black text-white">{item.value}</p>
                        <p className="mt-2 text-[11px] text-white/75">{item.helper}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold">Operations readiness</p>
                    <p className="text-sm font-black">{stats.systemHealthScore}%</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-orange-100">
                    <div className="h-full rounded-full bg-orange-600" style={{ width: `${stats.systemHealthScore}%` }} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">
                    {stats.systemHealthScore >= 80
                      ? "The business is operating with strong readiness. Focus on growth, replenishment, and customer retention."
                      : stats.systemHealthScore >= 55
                      ? "Operations are stable, with a few records requiring follow-up before closing today."
                      : "Critical readiness signals are low. Review risk, inventory, pricing, and synchronization immediately."}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/qa">
                    <Button className="rounded-xl bg-cyan-600 text-white hover:bg-cyan-700">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Run QA
                    </Button>
                  </Link>
                  <Link to="/reports">
                    <Button className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Reports
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl shadow-sm border">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x">
              {[
                { label: "Today Sales", value: formatCurrency(stats.today.sales), icon: Receipt, color: "text-blue-600" },
                { label: "Week Sales", value: formatCurrency(stats.week.sales), icon: TrendingUp, color: "text-emerald-600" },
                { label: "Month Sales", value: formatCurrency(stats.month.sales), icon: BarChart3, color: "text-violet-600" },
                { label: "Month Profit", value: formatCurrency(stats.month.profit), icon: DollarSign, color: "text-emerald-600" },
                { label: "Month Loss", value: formatCurrency(stats.month.loss), icon: TrendingDown, color: "text-rose-600" },
              ].map((item) => (
                <div key={item.label} className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-lg font-bold font-data break-words">{item.value}</p>
                  </div>
                  <item.icon className={`w-7 h-7 ${item.color} shrink-0`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageBackground>
  );
}