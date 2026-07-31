import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageBackground } from "@/components/PageBackground";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { useProducts } from "@/hooks/useSupabaseData";
import { formatCurrency } from "@/utils/currency";
import { isOnline } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {
  Warehouse,
  Package,
  Search,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Boxes,
  TrendingUp,
  ArrowLeftRight,
  ClipboardList,
  BarChart3,
  Plus,
  RefreshCcw,
  Activity,
  ShieldCheck,
  Layers3,
  Pencil,
  WifiOff,
  Wifi,
  UploadCloud,
  Database,
  DollarSign,
  PackageX,
  PackageCheck,
  Gauge,
  Eye,
  Grid3X3,
  List,
  SlidersHorizontal,
  RotateCcw,
  Download,
  ScanLine,
  Tags,
  Factory,
  Ruler,
  ShoppingCart,
  FileWarning,
  ArrowUpRight,
  ArrowDownRight,
  Box,
  Archive,
  Zap,
} from "lucide-react";

const CONTROL_COLOR = "#2563EB";
const PAGE_BLUE = "#2563EB";
const PAGE_SIZE = 24;

type ViewMode = "grid" | "list" | "compact";
type SmartFilter =
  | "all"
  | "healthy"
  | "low"
  | "out"
  | "overstock"
  | "negative_margin"
  | "missing_price"
  | "no_barcode"
  | "expired"
  | "expiring"
  | "reserved"
  | "pending";
type SortKey =
  | "status"
  | "name"
  | "stock"
  | "value"
  | "margin"
  | "category"
  | "updated";

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getStock(product: any) {
  return Math.max(0, safeNumber(product?.stock ?? product?.stock_quantity));
}

function getMinStock(product: any) {
  return Math.max(0, safeNumber(product?.min_stock ?? product?.min_stock_level ?? product?.reorder_level));
}

function getMaxStock(product: any) {
  return Math.max(0, safeNumber(product?.max_stock ?? product?.max_stock_level));
}

function getCost(product: any) {
  return safeNumber(product?.cost_price ?? product?.purchase_price ?? product?.unit_cost);
}

function getPrice(product: any) {
  return safeNumber(product?.selling_price ?? product?.price ?? product?.sale_price);
}

function getProductDate(product: any) {
  return (
    product?.updated_offline_at ||
    product?.updated_at ||
    product?.created_offline_at ||
    product?.created_at ||
    new Date().toISOString()
  );
}

function getExpiryDate(product: any) {
  return (
    product?.expiry_date ||
    product?.expires_at ||
    product?.expiration_date ||
    product?.batch_expiry_date ||
    null
  );
}

function daysUntilExpiry(product: any) {
  const value = getExpiryDate(product);
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isExpired(product: any) {
  const days = daysUntilExpiry(product);
  return days !== null && days < 0;
}

function isExpiringSoon(product: any) {
  const days = daysUntilExpiry(product);
  return days !== null && days >= 0 && days <= 30;
}

function getReservedStock(product: any) {
  return Math.max(
    0,
    safeNumber(
      product?.reserved_stock ??
        product?.reserved_quantity ??
        product?.reserved_qty ??
        product?.allocated_stock ??
        0
    )
  );
}

function getAvailableStock(product: any) {
  return Math.max(0, getStock(product) - getReservedStock(product));
}

function getValuationMethod(product: any) {
  return String(product?.valuation_method || product?.costing_method || "FIFO").toUpperCase();
}

function getReorderRuleQuality(product: any) {
  const min = getMinStock(product);
  const max = getMaxStock(product);

  if (min > 0 && max > min) return "Complete";
  if (min > 0) return "Minimum Only";
  return "Missing";
}

function isPendingSync(product: any) {
  return (
    String(product?.id || "").startsWith("offline-") ||
    !!product?.offline_id ||
    !!product?.created_offline_at ||
    !!product?.updated_offline_at ||
    String(product?.sync_status || "").toLowerCase().includes("pending")
  );
}

function isPendingDelete(product: any) {
  return (
    String(product?.operation || "").toLowerCase() === "delete" ||
    String(product?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(product?.status || "").toLowerCase() === "deleted"
  );
}

function stockStatus(stock: number, min: number, max = 0) {
  if (stock <= 0) return "Out of Stock";
  if (min > 0 && stock <= min) return "Low Stock";
  if (max > 0 && stock >= max) return "Overstock";
  return "Healthy";
}

function stockBadge(stock: number, min: number, max = 0) {
  if (stock <= 0) return "bg-rose-500/10 text-rose-600 border-rose-500/30";
  if (min > 0 && stock <= min) return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  if (max > 0 && stock >= max) return "bg-violet-500/10 text-violet-600 border-violet-500/30";
  return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
}

function margin(product: any) {
  const price = getPrice(product);
  const cost = getCost(product);
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

function getStockValue(product: any) {
  return getStock(product) * getCost(product);
}

function getRetailValue(product: any) {
  return getStock(product) * getPrice(product);
}

function getReorderQty(product: any) {
  const stock = getStock(product);
  const min = getMinStock(product);
  const max = getMaxStock(product);

  if (max > min && stock < min) return Math.max(0, max - stock);
  if (min > 0 && stock < min) return Math.max(0, min - stock);
  if (stock <= 0 && min > 0) return min;

  return 0;
}

function inventoryRiskScore(product: any) {
  const stock = getStock(product);
  const min = getMinStock(product);
  const max = getMaxStock(product);
  let score = 0;

  if (stock <= 0) score += 40;
  if (stock > 0 && min > 0 && stock <= min) score += 25;
  if (max > 0 && stock >= max) score += 10;
  if (margin(product) < 0) score += 25;
  if (getCost(product) <= 0 || getPrice(product) <= 0) score += 20;
  if (!product?.sku) score += 8;
  if (!product?.barcode) score += 8;
  if (isPendingSync(product)) score += 7;

  return Math.min(100, score);
}

function riskLabel(score: number) {
  if (score >= 70) return "Critical";
  if (score >= 40) return "High";
  if (score >= 15) return "Review";
  return "Normal";
}

function riskClass(score: number) {
  if (score >= 70) return "bg-rose-500/10 text-rose-600 border-rose-500/30";
  if (score >= 40) return "bg-orange-500/10 text-orange-600 border-orange-500/30";
  if (score >= 15) return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function dedupeProducts(products: any[]) {
  const map = new Map<string, any>();

  for (const product of products || []) {
    const key = String(
      product.id ||
        product.offline_id ||
        product.sku ||
        product.barcode ||
        product.name ||
        Math.random()
    );
    const existing = map.get(key);

    if (!existing) {
      map.set(key, product);
      continue;
    }

    const existingTime = new Date(getProductDate(existing)).getTime();
    const nextTime = new Date(getProductDate(product)).getTime();

    map.set(key, nextTime >= existingTime ? { ...existing, ...product } : { ...product, ...existing });
  }

  return Array.from(map.values()).filter((p) => !isPendingDelete(p));
}

function formatDate(value: any) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Inventory() {
  const { data: products = [], isLoading } = useProducts();

  const [search, setSearch] = useState("");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const offlineModeActive = !isOnline() || isOfflineMode();
  const cleanProducts = useMemo(() => dedupeProducts(products as any[]), [products]);

  const categories = useMemo(() => {
    return Array.from(new Set(cleanProducts.map((p) => p.category || "Uncategorized")))
      .filter(Boolean)
      .sort();
  }, [cleanProducts]);

  const brands = useMemo(() => {
    return Array.from(new Set(cleanProducts.map((p) => p.brand || "No brand")))
      .filter(Boolean)
      .sort();
  }, [cleanProducts]);

  const stats = useMemo(() => {
    const totalProducts = cleanProducts.length;
    const totalQty = cleanProducts.reduce((sum, p) => sum + getStock(p), 0);

    const inventoryValue = cleanProducts.reduce((sum, p) => sum + getStockValue(p), 0);
    const retailValue = cleanProducts.reduce((sum, p) => sum + getRetailValue(p), 0);

    const lowStock = cleanProducts.filter((p) => {
      const stock = getStock(p);
      const min = getMinStock(p);
      return stock > 0 && min > 0 && stock <= min;
    });

    const outOfStock = cleanProducts.filter((p) => getStock(p) <= 0);

    const healthy = cleanProducts.filter((p) => {
      const stock = getStock(p);
      const min = getMinStock(p);
      const max = getMaxStock(p);
      return stock > 0 && (min <= 0 || stock > min) && (max <= 0 || stock < max);
    });

    const overstock = cleanProducts.filter((p) => {
      const max = getMaxStock(p);
      return max > 0 && getStock(p) >= max;
    });

    const negativeMargin = cleanProducts.filter((p) => margin(p) < 0);
    const missingPrice = cleanProducts.filter((p) => getPrice(p) <= 0 || getCost(p) <= 0);
    const noBarcode = cleanProducts.filter((p) => !p.barcode);
    const pendingSync = cleanProducts.filter(isPendingSync);
    const expiredProducts = cleanProducts.filter(isExpired);
    const expiringSoonProducts = cleanProducts.filter(isExpiringSoon);
    const reservedQty = cleanProducts.reduce((sum, p) => sum + getReservedStock(p), 0);
    const availableQty = cleanProducts.reduce((sum, p) => sum + getAvailableStock(p), 0);
    const reservationValue = cleanProducts.reduce((sum, p) => sum + getReservedStock(p) * getCost(p), 0);
    const productsWithReorderRules = cleanProducts.filter((p) => getMinStock(p) > 0).length;
    const fifoValuedProducts = cleanProducts.filter((p) => getValuationMethod(p) === "FIFO").length;
    const riskProducts = cleanProducts.filter((p) => inventoryRiskScore(p) >= 15);
    const criticalProducts = cleanProducts.filter((p) => inventoryRiskScore(p) >= 70);

    const healthScore =
      totalProducts > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                100 -
                  outOfStock.length * 5 -
                  lowStock.length * 3 -
                  overstock.length * 2 -
                  negativeMargin.length * 4 -
                  missingPrice.length * 3 -
                  pendingSync.length * 1
              )
            )
          )
        : 0;

    const categoryMap = new Map<string, { count: number; value: number; qty: number }>();
    cleanProducts.forEach((p) => {
      const category = p.category || "Uncategorized";
      const row = categoryMap.get(category) || { count: 0, value: 0, qty: 0 };
      row.count += 1;
      row.value += getStockValue(p);
      row.qty += getStock(p);
      categoryMap.set(category, row);
    });

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);

    const brandMap = new Map<string, { count: number; value: number; qty: number }>();
    cleanProducts.forEach((p) => {
      const brand = p.brand || "No brand";
      const row = brandMap.get(brand) || { count: 0, value: 0, qty: 0 };
      row.count += 1;
      row.value += getStockValue(p);
      row.qty += getStock(p);
      brandMap.set(brand, row);
    });

    const brandBreakdown = Array.from(brandMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);

    const topValueProducts = [...cleanProducts]
      .sort((a, b) => getStockValue(b) - getStockValue(a))
      .slice(0, 8);

    const reorderProducts = [...outOfStock, ...lowStock]
      .sort((a, b) => inventoryRiskScore(b) - inventoryRiskScore(a))
      .slice(0, 10);

    const avgMargin =
      totalProducts > 0
        ? cleanProducts.reduce((sum, p) => sum + margin(p), 0) / totalProducts
        : 0;

    return {
      totalProducts,
      totalQty,
      inventoryValue,
      retailValue,
      potentialProfit: Math.max(0, retailValue - inventoryValue),
      lowStock,
      outOfStock,
      healthy,
      overstock,
      negativeMargin,
      missingPrice,
      noBarcode,
      pendingSync,
      expiredProducts,
      expiringSoonProducts,
      reservedQty,
      availableQty,
      reservationValue,
      productsWithReorderRules,
      fifoValuedProducts,
      riskProducts,
      criticalProducts,
      healthScore,
      categoryBreakdown,
      brandBreakdown,
      topValueProducts,
      reorderProducts,
      avgMargin,
    };
  }, [cleanProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();

    const list = cleanProducts.filter((p) => {
      const stock = getStock(p);
      const min = getMinStock(p);
      const max = getMaxStock(p);
      const risk = inventoryRiskScore(p);

      const matchSearch =
        !q ||
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.sku || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q) ||
        String(p.brand || "").toLowerCase().includes(q) ||
        String(p.barcode || "").toLowerCase().includes(q) ||
        String(p.unit || "").toLowerCase().includes(q) ||
        String(stock).includes(q);

      const matchCategory = categoryFilter === "all" || String(p.category || "Uncategorized") === categoryFilter;
      const matchBrand = brandFilter === "all" || String(p.brand || "No brand") === brandFilter;
      const pending = isPendingSync(p);

      const matchSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      const matchSmart =
        smartFilter === "all" ||
        (smartFilter === "healthy" && stock > 0 && (min <= 0 || stock > min) && (max <= 0 || stock < max)) ||
        (smartFilter === "low" && stock > 0 && min > 0 && stock <= min) ||
        (smartFilter === "out" && stock <= 0) ||
        (smartFilter === "overstock" && max > 0 && stock >= max) ||
        (smartFilter === "negative_margin" && margin(p) < 0) ||
        (smartFilter === "missing_price" && (getPrice(p) <= 0 || getCost(p) <= 0)) ||
        (smartFilter === "no_barcode" && !p.barcode) ||
        (smartFilter === "expired" && isExpired(p)) ||
        (smartFilter === "expiring" && isExpiringSoon(p)) ||
        (smartFilter === "reserved" && getReservedStock(p) > 0) ||
        (smartFilter === "pending" && pending);

      return matchSearch && matchCategory && matchBrand && matchSync && matchSmart;
    });

    list.sort((a, b) => {
      if (sortKey === "status") {
        const av = inventoryRiskScore(a);
        const bv = inventoryRiskScore(b);
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "stock") {
        return sortAsc ? getStock(a) - getStock(b) : getStock(b) - getStock(a);
      }

      if (sortKey === "value") {
        return sortAsc ? getStockValue(a) - getStockValue(b) : getStockValue(b) - getStockValue(a);
      }

      if (sortKey === "margin") {
        return sortAsc ? margin(a) - margin(b) : margin(b) - margin(a);
      }

      if (sortKey === "category") {
        return sortAsc
          ? String(a.category || "").localeCompare(String(b.category || ""))
          : String(b.category || "").localeCompare(String(a.category || ""));
      }

      if (sortKey === "updated") {
        const av = new Date(getProductDate(a)).getTime();
        const bv = new Date(getProductDate(b)).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      return sortAsc
        ? String(a.name || "").localeCompare(String(b.name || ""))
        : String(b.name || "").localeCompare(String(a.name || ""));
    });

    return list;
  }, [cleanProducts, search, categoryFilter, brandFilter, syncFilter, smartFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: stats.totalProducts, icon: Package, color: "bg-slate-700 text-white" },
    { key: "healthy" as SmartFilter, label: "Healthy", value: stats.healthy.length, icon: PackageCheck, color: "bg-emerald-600 text-white" },
    { key: "low" as SmartFilter, label: "Low Stock", value: stats.lowStock.length, icon: AlertTriangle, color: "bg-amber-600 text-white" },
    { key: "out" as SmartFilter, label: "Out", value: stats.outOfStock.length, icon: PackageX, color: "bg-rose-600 text-white" },
    { key: "overstock" as SmartFilter, label: "Overstock", value: stats.overstock.length, icon: Archive, color: "bg-violet-600 text-white" },
    { key: "negative_margin" as SmartFilter, label: "Loss Risk", value: stats.negativeMargin.length, icon: FileWarning, color: "bg-orange-600 text-white" },
    { key: "missing_price" as SmartFilter, label: "No Price", value: stats.missingPrice.length, icon: DollarSign, color: "bg-blue-600 text-white" },
    { key: "no_barcode" as SmartFilter, label: "No Barcode", value: stats.noBarcode.length, icon: ScanLine, color: "bg-cyan-600 text-white" },
    { key: "expired" as SmartFilter, label: "Expired", value: stats.expiredProducts.length, icon: XCircle, color: "bg-rose-600 text-white" },
    { key: "expiring" as SmartFilter, label: "Expiring", value: stats.expiringSoonProducts.length, icon: Activity, color: "bg-orange-600 text-white" },
    { key: "reserved" as SmartFilter, label: "Reserved", value: stats.reservedQty, icon: Archive, color: "bg-violet-600 text-white" },
    { key: "pending" as SmartFilter, label: "Pending", value: stats.pendingSync.length, icon: UploadCloud, color: "bg-violet-600 text-white" },
  ];

  const exportRows = filteredProducts.map((p) => ({
    name: p.name || "",
    sku: p.sku || "",
    barcode: p.barcode || "",
    brand: p.brand || "",
    category: p.category || "",
    unit: p.unit || "",
    stock: getStock(p),
    min_stock: getMinStock(p),
    max_stock: getMaxStock(p),
    status: stockStatus(getStock(p), getMinStock(p), getMaxStock(p)),
    cost: formatCurrency(getCost(p)),
    price: formatCurrency(getPrice(p)),
    stock_value: formatCurrency(getStockValue(p)),
    retail_value: formatCurrency(getRetailValue(p)),
    margin: `${margin(p).toFixed(1)}%`,
    reorder_qty: getReorderQty(p),
    reserved_stock: getReservedStock(p),
    available_stock: getAvailableStock(p),
    expiry_date: getExpiryDate(p) ? formatDate(getExpiryDate(p)) : "",
    valuation_method: getValuationMethod(p),
    reorder_rule: getReorderRuleQuality(p),
    risk: riskLabel(inventoryRiskScore(p)),
    sync: isPendingSync(p) ? "Pending" : "Synced",
  }));

  const exportCols = [
    { key: "name" as const, label: "Product" },
    { key: "sku" as const, label: "SKU" },
    { key: "barcode" as const, label: "Barcode" },
    { key: "brand" as const, label: "Brand" },
    { key: "category" as const, label: "Category" },
    { key: "unit" as const, label: "Unit" },
    { key: "stock" as const, label: "Stock" },
    { key: "min_stock" as const, label: "Min Stock" },
    { key: "max_stock" as const, label: "Max Stock" },
    { key: "status" as const, label: "Status" },
    { key: "cost" as const, label: "Cost" },
    { key: "price" as const, label: "Price" },
    { key: "stock_value" as const, label: "Stock Value" },
    { key: "retail_value" as const, label: "Retail Value" },
    { key: "margin" as const, label: "Margin" },
    { key: "reorder_qty" as const, label: "Reorder Qty" },
    { key: "reserved_stock" as const, label: "Reserved Stock" },
    { key: "available_stock" as const, label: "Available Stock" },
    { key: "expiry_date" as const, label: "Expiry Date" },
    { key: "valuation_method" as const, label: "Valuation" },
    { key: "reorder_rule" as const, label: "Reorder Rule" },
    { key: "risk" as const, label: "Risk" },
    { key: "sync" as const, label: "Sync" },
  ];

  const resetFilters = () => {
    setSearch("");
    setSmartFilter("all");
    setCategoryFilter("all");
    setBrandFilter("all");
    setSyncFilter("all");
    setSortKey("status");
    setSortAsc(false);
    setPage(1);
  };

  const topSummaryCards = [
    {
      label: "Total SKUs",
      value: stats.totalProducts,
      helper: "Products in catalog",
      icon: Package,
      wrapper: "bg-rose-600 text-white border-rose-500",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Total Quantity",
      value: compactNumber(stats.totalQty),
      helper: "Units available",
      icon: Boxes,
      wrapper: "bg-emerald-600 text-white border-emerald-500",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Cost Value",
      value: formatCurrency(stats.inventoryValue),
      helper: "Inventory cost",
      icon: TrendingUp,
      wrapper: "bg-violet-600 text-white border-violet-500",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Risk Items",
      value: stats.riskProducts.length,
      helper: `${stats.criticalProducts.length} critical`,
      icon: FileWarning,
      wrapper: "bg-orange-600 text-white border-orange-500",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
  ];

  const ProductImage = ({ p, size = "large" }: { p: any; size?: "large" | "small" }) => (
    <div
      className={`${
        size === "large" ? "aspect-[4/3] w-full" : "h-12 w-12 rounded-2xl"
      } bg-muted flex items-center justify-center overflow-hidden border`}
    >
      {p.image_url ? (
        <img src={p.image_url} alt={p.name || "Product"} className="h-full w-full object-cover" />
      ) : (
        <Package className={`${size === "large" ? "h-12 w-12" : "h-5 w-5"} text-muted-foreground`} />
      )}
    </div>
  );

  const ProductCard = ({ p }: { p: any }) => {
    const stock = getStock(p);
    const minStock = getMinStock(p);
    const maxStock = getMaxStock(p);
    const value = getStockValue(p);
    const pending = isPendingSync(p);
    const risk = inventoryRiskScore(p);
    const reorderQty = getReorderQty(p);

    return (
      <div className="rounded-3xl border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-lg transition-all overflow-hidden">
        <div className="relative">
          <ProductImage p={p} />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {pending && (
              <Badge className="rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/10">
                Pending
              </Badge>
            )}
            <Badge variant="outline" className={`rounded-full ${riskClass(risk)}`}>
              {riskLabel(risk)}
            </Badge>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.sku || "No SKU"} · {p.brand || "No brand"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {p.category || "Uncategorized"} · {p.unit || "pcs"}
              </p>
            </div>

            <Badge variant="outline" className={stockBadge(stock, minStock, maxStock)}>
              {stock <= 0 && <XCircle className="w-3 h-3 mr-1" />}
              {stock > 0 && minStock > 0 && stock <= minStock && (
                <AlertTriangle className="w-3 h-3 mr-1" />
              )}
              {stock > 0 && (minStock <= 0 || stock > minStock) && (
                <CheckCircle2 className="w-3 h-3 mr-1" />
              )}
              {stockStatus(stock, minStock, maxStock)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-[11px] text-blue-700">Available</p>
              <p className="font-data font-semibold text-sm mt-1 text-blue-950">
                {getAvailableStock(p).toLocaleString()} {p.unit || "pcs"}
              </p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
              <p className="text-[11px] text-orange-700">Reorder Qty</p>
              <p className="font-data font-semibold text-sm mt-1 text-orange-950">{reorderQty || "—"}</p>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
              <p className="text-[11px] text-violet-700">FIFO Value</p>
              <p className="font-data font-semibold text-sm mt-1 text-violet-950">{formatCurrency(value)}</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[11px] text-emerald-700">Margin</p>
              <p className={`font-data font-semibold text-sm mt-1 ${margin(p) < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                {margin(p).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Stock vs Min</span>
              <span>{minStock > 0 ? `${Math.min(100, Math.round((stock / minStock) * 100))}%` : "No min"}</span>
            </div>
            <Progress value={minStock > 0 ? Math.min(100, (stock / minStock) * 100) : 100} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link to="/products">
              <Button variant="outline" size="sm" className="w-full rounded-xl">
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
            </Link>

            <Link to="/stock-adjustments">
              <Button size="sm" className="w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Stock
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <PageShell title="Stock Overview" description="Loading inventory...">
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageBackground image={warehouseBg} opacity={0.04}>
      <PageShell
        title="Stock Overview"
        description="Inventory operations center for stock health, replenishment planning, valuation, risk control, offline readiness, and product-level stock visibility."
      >
        {(offlineModeActive || stats.pendingSync.length > 0) && (
          <div className="mb-6 rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                  {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-bold">
                    {offlineModeActive ? "Stock Overview is using offline cached products" : "Stock changes waiting to sync"}
                  </p>
                  <p className="text-sm opacity-90">
                    Pending products/stock records: {stats.pendingSync.length}. Stock, stock_quantity, refunds, and offline records are included in this view.
                  </p>
                </div>
              </div>
              <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                <UploadCloud className="mr-1 h-3 w-3" />
                {offlineModeActive ? "Offline Mode" : "Sync Pending"}
              </Badge>
            </div>
          </div>
        )}

        <div className="rounded-3xl border bg-card shadow-sm overflow-hidden mb-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.45fr]">
            <div className="relative overflow-hidden border-b xl:border-b-0 xl:border-r bg-gradient-to-br from-white via-slate-50 to-blue-50/40 p-6 lg:p-7">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-600/10 blur-2xl" />
              <div className="absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-emerald-500/10 blur-2xl" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700 mb-5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Inventory Operations Center
                </div>

                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex items-center justify-center shadow-sm">
                      <Layers3 className="w-8 h-8" />
                    </div>
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white ${offlineModeActive ? "bg-amber-500" : "bg-emerald-500"}`} />
                  </div>

                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-950">
                      Inventory Overview
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                      Track stock levels, inventory value, reorder alerts, stock risk, catalog readiness,
                      offline pending records, and stock movement actions.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Health Score
                    </div>
                    <p className="text-sm font-semibold mt-1">{stats.healthScore}% Healthy</p>
                  </div>

                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Critical Items
                    </div>
                    <p className="text-sm font-semibold mt-1">{stats.criticalProducts.length} Items</p>
                  </div>

                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {offlineModeActive ? (
                        <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      Mode
                    </div>
                    <p className={`text-sm font-semibold mt-1 ${offlineModeActive ? "text-amber-600" : "text-emerald-600"}`}>
                      {offlineModeActive ? "Offline Cache" : "Live Online"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/70 p-6 lg:p-7">
              {topSummaryCards.map((item) => (
                <div key={item.label} className={`rounded-3xl border ${item.wrapper} p-5 shadow-sm`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-11 h-11 rounded-2xl ${item.iconBox} flex items-center justify-center`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="h-2 w-2 rounded-full bg-current opacity-30" />
                  </div>

                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p
                    className={`font-bold font-data mt-1 leading-tight tracking-tight ${item.valueColor} ${
                      item.label.includes("Value") ? "text-lg xl:text-xl break-words" : "text-2xl"
                    }`}
                  >
                    {item.value}
                  </p>

                  <div className="mt-4 inline-flex rounded-full bg-white/80 border px-3 py-1 text-[11px] text-muted-foreground">
                    {item.helper}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3 mb-6">
          {smartCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setSmartFilter(card.key);
                setPage(1);
              }}
              className={`rounded-3xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                smartFilter === card.key ? "ring-2 ring-blue-600" : ""
              }`}
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="font-data text-xl font-black">{compactNumber(Number(card.value || 0))}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-6">
          <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold">Inventory Health</h3>
                <p className="text-xs text-muted-foreground">Readiness based on stock, pricing, margin, and sync status.</p>
              </div>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-6">
              <div className="relative w-36 h-36 rounded-full border-[14px] border-muted flex items-center justify-center">
                <div className="text-center relative z-10">
                  <p className="text-3xl font-bold font-data">{stats.healthScore}%</p>
                  <p className="text-xs text-muted-foreground">Health</p>
                </div>
              </div>

              <div className="space-y-3 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Healthy</span>
                  <span className="font-data">{stats.healthy.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Low Stock</span>
                  <span className="font-data text-amber-600">{stats.lowStock.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Out of Stock</span>
                  <span className="font-data text-rose-600">{stats.outOfStock.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Risk Items</span>
                  <span className="font-data text-orange-600">{stats.riskProducts.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold">Inventory Value</h3>
                <p className="text-xs text-muted-foreground">Cost value, retail value, and stock potential.</p>
              </div>
              <DollarSign className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Cost Value</p>
                <p className="font-data font-bold mt-1">{formatCurrency(stats.inventoryValue)}</p>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Retail Value</p>
                <p className="font-data font-bold mt-1">{formatCurrency(stats.retailValue)}</p>
              </div>
              <div className="rounded-2xl border bg-emerald-500/10 p-4 text-emerald-700">
                <p className="text-xs">Potential Profit</p>
                <p className="font-data font-bold mt-1">{formatCurrency(stats.potentialProfit)}</p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold">Stock Actions</h3>
                <p className="text-xs text-muted-foreground">Fast movement and control operations.</p>
              </div>
              <Zap className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Adjust Stock",
                  to: "/stock-adjustments",
                  icon: Plus,
                  card: "border-blue-200 bg-blue-50 text-blue-950 hover:bg-blue-100",
                  iconBg: "bg-blue-600",
                  helper: "Correct stock",
                },
                {
                  label: "Stock Count",
                  to: "/stock-counts",
                  icon: ClipboardList,
                  card: "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
                  iconBg: "bg-emerald-600",
                  helper: "Physical count",
                },
                {
                  label: "Transfers",
                  to: "/transfers",
                  icon: ArrowLeftRight,
                  card: "border-violet-200 bg-violet-50 text-violet-950 hover:bg-violet-100",
                  iconBg: "bg-violet-600",
                  helper: "Move stock",
                },
                {
                  label: "Movements",
                  to: "/stock-movements",
                  icon: BarChart3,
                  card: "border-cyan-200 bg-cyan-50 text-cyan-950 hover:bg-cyan-100",
                  iconBg: "bg-cyan-600",
                  helper: "Audit trail",
                },
                {
                  label: "Purchases",
                  to: "/purchases",
                  icon: ShoppingCart,
                  card: "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100",
                  iconBg: "bg-amber-600",
                  helper: "Replenish",
                },
                {
                  label: "Products",
                  to: "/products",
                  icon: Package,
                  card: "border-rose-200 bg-rose-50 text-rose-950 hover:bg-rose-100",
                  iconBg: "bg-rose-600",
                  helper: "Catalog",
                },
              ].map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className={`rounded-2xl border ${action.card} p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${action.iconBg} text-white shadow-sm`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold">{action.label}</p>
                  <p className="mt-1 text-[10px] opacity-75">{action.helper}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-6">
          <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50/80 p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-950">Replenishment Planning</h3>
                <p className="text-xs text-blue-700/80">Odoo-style reorder queue for purchasing and receiving decisions.</p>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="text-xs text-blue-700/80">Suggested reorder lines</p>
                <p className="mt-1 font-data text-2xl font-black text-blue-900">{stats.reorderProducts.length}</p>
              </div>
              <Link to="/purchases">
                <Button className="w-full rounded-2xl bg-blue-600 text-white hover:bg-blue-700">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Open Purchasing
                </Button>
              </Link>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <PackageCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-950">Warehouse Readiness</h3>
                <p className="text-xs text-emerald-700/80">SAP-style control for availability, stock value, and movement reliability.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="text-xs text-emerald-700/80">Healthy SKUs</p>
                <p className="mt-1 font-data text-xl font-black text-emerald-900">{stats.healthy.length}</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="text-xs text-emerald-700/80">Stock Qty</p>
                <p className="mt-1 font-data text-xl font-black text-emerald-900">{compactNumber(stats.totalQty)}</p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border border-orange-200 bg-orange-50/80 p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-orange-950">Stock Control Exceptions</h3>
                <p className="text-xs text-orange-700/80">Dynamics-style attention list for pricing, barcode, and margin issues.</p>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-white/75 p-3 text-sm">
                <span>Missing prices</span>
                <span className="font-data font-bold text-orange-800">{stats.missingPrice.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/75 p-3 text-sm">
                <span>No barcode</span>
                <span className="font-data font-bold text-orange-800">{stats.noBarcode.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/75 p-3 text-sm">
                <span>Negative margin</span>
                <span className="font-data font-bold text-orange-800">{stats.negativeMargin.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-6">
          <div className="xl:col-span-3 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-950">Reorder Rules</h3>
                <p className="text-xs text-blue-700/80">Minimum and maximum stock control.</p>
              </div>
            </div>
            <p className="font-data text-2xl font-black text-blue-950">{stats.productsWithReorderRules}</p>
            <p className="mt-1 text-xs text-blue-700">Products with configured reorder levels</p>
          </div>

          <div className="xl:col-span-3 rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-violet-950">Reservations</h3>
                <p className="text-xs text-violet-700/80">Allocated stock and available quantity.</p>
              </div>
            </div>
            <p className="font-data text-2xl font-black text-violet-950">{compactNumber(stats.reservedQty)}</p>
            <p className="mt-1 text-xs text-violet-700">Reserved · {compactNumber(stats.availableQty)} available</p>
          </div>

          <div className="xl:col-span-3 rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-600 text-white">
                <FileWarning className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-orange-950">Expiry Monitor</h3>
                <p className="text-xs text-orange-700/80">Batch and product expiry visibility.</p>
              </div>
            </div>
            <p className="font-data text-2xl font-black text-orange-950">{stats.expiringSoonProducts.length}</p>
            <p className="mt-1 text-xs text-orange-700">{stats.expiredProducts.length} expired · 30-day watch</p>
          </div>

          <div className="xl:col-span-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-950">Valuation</h3>
                <p className="text-xs text-emerald-700/80">FIFO/weighted cost readiness.</p>
              </div>
            </div>
            <p className="font-data text-2xl font-black text-emerald-950">{stats.fifoValuedProducts}</p>
            <p className="mt-1 text-xs text-emerald-700">FIFO-valued products · {formatCurrency(stats.reservationValue)} reserved cost</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-6">
          <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-6">
            <h3 className="font-semibold mb-4">Reorder Suggestions</h3>

            {stats.reorderProducts.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No reorder alerts. Inventory looks healthy.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.reorderProducts.slice(0, 6).map((p) => {
                  const stock = getStock(p);
                  const min = getMinStock(p);
                  const max = getMaxStock(p);

                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
                      <ProductImage p={p} size="small" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock {stock} · Min {min || "—"} · Order {getReorderQty(p) || min || "—"}
                        </p>
                      </div>
                      <Badge variant="outline" className={stockBadge(stock, min, max)}>
                        {stockStatus(stock, min, max)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-6">
            <h3 className="font-semibold mb-4">Category Value</h3>
            <div className="space-y-3">
              {stats.categoryBreakdown.slice(0, 6).map((row) => {
                const percent = stats.inventoryValue > 0 ? Math.round((row.value / stats.inventoryValue) * 100) : 0;

                return (
                  <div key={row.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate">{row.name}</span>
                      <span className="font-data text-muted-foreground">{percent}%</span>
                    </div>
                    <Progress value={percent} />
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{row.count} SKUs · {compactNumber(row.qty)} units</span>
                      <span>{formatCurrency(row.value)}</span>
                    </div>
                  </div>
                );
              })}

              {stats.categoryBreakdown.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No category value yet.</p>
              )}
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-6">
            <h3 className="font-semibold mb-4">Highest Stock Value</h3>
            <div className="space-y-3">
              {stats.topValueProducts.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
                  <ProductImage p={p} size="small" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getStock(p)} {p.unit || "pcs"} · Margin {margin(p).toFixed(1)}%
                    </p>
                  </div>
                  <p className="font-data font-semibold text-sm">{formatCurrency(getStockValue(p))}</p>
                </div>
              ))}

              {stats.topValueProducts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No inventory value data yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-card shadow-sm overflow-hidden mb-5">
          <div className="flex flex-col gap-4 border-b p-4 lg:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight">Stock Directory</h2>
                  <Badge variant="outline" className="rounded-full">
                    {offlineModeActive ? (
                      <WifiOff className="mr-1 h-3 w-3 text-amber-600" />
                    ) : (
                      <Wifi className="mr-1 h-3 w-3 text-emerald-600" />
                    )}
                    {offlineModeActive ? "Offline cache" : "Live online"}
                  </Badge>
                  {stats.pendingSync.length > 0 && (
                    <Badge className="rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/10">
                      <UploadCloud className="mr-1 h-3 w-3" />
                      {stats.pendingSync.length} pending
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                  {Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} products
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ExportMenu
                  onCSV={() => exportToCSV(exportRows, "inventory", exportCols)}
                  onPDF={() =>
                    exportToPDF(exportRows, "inventory", "Inventory Enterprise Report", exportCols, {
                      subtitle: `${filteredProducts.length} product stock records`,
                      summary: [
                        { label: "Total SKUs", value: String(stats.totalProducts) },
                        { label: "Total Quantity", value: String(stats.totalQty) },
                        { label: "Cost Value", value: formatCurrency(stats.inventoryValue) },
                        { label: "Retail Value", value: formatCurrency(stats.retailValue) },
                        { label: "Low Stock", value: String(stats.lowStock.length) },
                        { label: "Out of Stock", value: String(stats.outOfStock.length) },
                        { label: "Pending Sync", value: String(stats.pendingSync.length) },
                      ],
                    })
                  }
                />

                <div className="flex rounded-2xl border bg-muted/40 p-1">
                  {[
                    { key: "grid" as ViewMode, label: "Grid", icon: Grid3X3 },
                    { key: "list" as ViewMode, label: "List", icon: List },
                    { key: "compact" as ViewMode, label: "Compact", icon: Layers3 },
                  ].map((mode) => (
                    <Button
                      key={mode.key}
                      type="button"
                      size="sm"
                      variant={viewMode === mode.key ? "default" : "ghost"}
                      className="rounded-xl h-8 px-3"
                      style={viewMode === mode.key ? { background: CONTROL_COLOR } : undefined}
                      onClick={() => setViewMode(mode.key)}
                    >
                      <mode.icon className="w-4 h-4 mr-1.5" />
                      {mode.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  placeholder="Search stock by product, SKU, brand, category, barcode, unit, or quantity..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-2xl border bg-background pl-10 pr-4 text-sm outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-11 w-[150px] rounded-2xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={brandFilter} onValueChange={(value) => { setBrandFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-11 w-[140px] rounded-2xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={syncFilter} onValueChange={(value) => { setSyncFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-11 w-[125px] rounded-2xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sync</SelectItem>
                    <SelectItem value="synced">Synced</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={`${sortKey}:${sortAsc ? "asc" : "desc"}`}
                  onValueChange={(value) => {
                    const [key, direction] = value.split(":") as [SortKey, "asc" | "desc"];
                    setSortKey(key);
                    setSortAsc(direction === "asc");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-11 w-[160px] rounded-2xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status:desc">Highest Risk</SelectItem>
                    <SelectItem value="name:asc">Name A-Z</SelectItem>
                    <SelectItem value="stock:asc">Lowest Stock</SelectItem>
                    <SelectItem value="stock:desc">Highest Stock</SelectItem>
                    <SelectItem value="value:desc">Highest Value</SelectItem>
                    <SelectItem value="margin:asc">Lowest Margin</SelectItem>
                    <SelectItem value="updated:desc">Recently Updated</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="ghost" className="h-11 rounded-2xl text-blue-700" onClick={resetFilters}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-5">
            {filteredProducts.length === 0 ? (
              <div className="rounded-3xl border border-blue-200 bg-blue-50/80 px-6 py-16 text-center text-blue-900">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white">
                  <Package className="h-8 w-8" />
                </div>
                <p className="text-lg font-bold">No stock records found</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-blue-700/80">
                  Adjust filters or add products to start tracking stock quantity, valuation, reorder points, and stock control exceptions.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <Link to="/products">
                    <Button className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700">Open Products</Button>
                  </Link>
                  <Button variant="outline" className="rounded-2xl border-blue-300 text-blue-700" onClick={resetFilters}>Reset Filters</Button>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {pagedProducts.map((p) => (
                  <ProductCard key={p.id || p.sku || p.name} p={p} />
                ))}
              </div>
            ) : viewMode === "list" ? (
              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Product</th>
                      <th className="px-4 py-3 text-left font-medium">Category</th>
                      <th className="px-4 py-3 text-left font-medium">Stock</th>
                      <th className="px-4 py-3 text-left font-medium">Min / Max</th>
                      <th className="px-4 py-3 text-left font-medium">Cost Value</th>
                      <th className="px-4 py-3 text-left font-medium">Retail Value</th>
                      <th className="px-4 py-3 text-left font-medium">Margin</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {pagedProducts.map((p) => {
                      const stock = getStock(p);
                      const min = getMinStock(p);
                      const max = getMaxStock(p);
                      return (
                        <tr key={p.id || p.sku || p.name} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <ProductImage p={p} size="small" />
                              <div className="min-w-0">
                                <p className="font-semibold truncate max-w-[240px]">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.sku || "No SKU"} · {p.brand || "No brand"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{p.category || "Uncategorized"}</td>
                          <td className="px-4 py-3 font-data">{stock} {p.unit || "pcs"}</td>
                          <td className="px-4 py-3 font-data">{min || "—"} / {max || "—"}</td>
                          <td className="px-4 py-3 font-data">{formatCurrency(getStockValue(p))}</td>
                          <td className="px-4 py-3 font-data">{formatCurrency(getRetailValue(p))}</td>
                          <td className={`px-4 py-3 font-data ${margin(p) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{margin(p).toFixed(1)}%</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={stockBadge(stock, min, max)}>
                              {stockStatus(stock, min, max)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Link to="/products">
                                <Button variant="outline" size="sm" className="rounded-xl">
                                  <Pencil className="w-3.5 h-3.5 mr-1" />
                                  Edit
                                </Button>
                              </Link>
                              <Link to="/stock-adjustments">
                                <Button size="sm" className="rounded-xl" >
                                  <Plus className="w-3.5 h-3.5 mr-1" />
                                  Stock
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {pagedProducts.map((p) => {
                  const stock = getStock(p);
                  const min = getMinStock(p);
                  const max = getMaxStock(p);

                  return (
                    <div key={p.id || p.sku || p.name} className="rounded-2xl border bg-card p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <ProductImage p={p} size="small" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {stock} {p.unit || "pcs"} · {formatCurrency(getStockValue(p))}
                          </p>
                        </div>
                        <Badge variant="outline" className={stockBadge(stock, min, max)}>
                          {stockStatus(stock, min, max)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t px-4 lg:px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages} · {filteredProducts.length} products
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ‹
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    variant={n === currentPage ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9 rounded-xl text-xs"
                    style={n === currentPage ? { background: CONTROL_COLOR } : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  ›
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageShell>
    </PageBackground>
  );
}