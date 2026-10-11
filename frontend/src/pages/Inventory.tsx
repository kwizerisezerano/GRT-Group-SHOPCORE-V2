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
import { PageSkeleton } from "@/components/skeletons";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { useProducts } from "@/hooks/useSupabaseData";
import { formatCurrency } from "@/utils/currency";
import { isOnline } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {
  FilterChips,
  PageContainer,
  PageToolbar,
  StatGrid,
  SectionCard,
  TablePagination,  EmptyState,
  type StatItem,
} from "@/components/patterns";
import {
  Package,
  Search,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Boxes,
  TrendingUp,
  Plus,
  Activity,
  Layers3,
  Pencil,
  UploadCloud,
  DollarSign,
  PackageX,
  PackageCheck,
  Grid3X3,
  List,
  RotateCcw,
  ScanLine,
  FileWarning,
  Archive,
} from "lucide-react";

const CONTROL_COLOR = "hsl(var(--primary))";
const PAGE_BLUE = "hsl(var(--primary))";
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
  if (max > 0 && stock >= max) return "bg-primary/10 text-muted-foreground border-primary/30";
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

  const statCards: StatItem[] = [
    { label: "Total SKUs", value: stats.totalProducts, icon: Package, tone: "indigo", helper: "products in catalog" },
    {
      label: "Total Quantity",
      value: compactNumber(stats.totalQty),
      icon: Boxes,
      tone: "sky",
      helper: "units available",
    },
    {
      label: "Cost Value",
      value: formatCurrency(stats.inventoryValue),
      icon: TrendingUp,
      tone: "violet",
      helper: "inventory cost",
    },
    {
      label: "Risk Items",
      value: stats.riskProducts.length,
      icon: FileWarning,
      tone: stats.riskProducts.length > 0 ? "amber" : "teal",
      helper: `${stats.criticalProducts.length} critical`,
    },
    {
      label: "Pending Sync",
      value: stats.pendingSync.length,
      icon: UploadCloud,
      tone: stats.pendingSync.length > 0 ? "amber" : "cyan",
      helper: "offline changes",
    },
  ];

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: stats.totalProducts, icon: Package },
    { key: "healthy" as SmartFilter, label: "Healthy", value: stats.healthy.length, icon: PackageCheck },
    { key: "low" as SmartFilter, label: "Low Stock", value: stats.lowStock.length, icon: AlertTriangle },
    { key: "out" as SmartFilter, label: "Out", value: stats.outOfStock.length, icon: PackageX },
    { key: "overstock" as SmartFilter, label: "Overstock", value: stats.overstock.length, icon: Archive },
    { key: "negative_margin" as SmartFilter, label: "Loss Risk", value: stats.negativeMargin.length, icon: FileWarning },
    { key: "missing_price" as SmartFilter, label: "No Price", value: stats.missingPrice.length, icon: DollarSign },
    { key: "no_barcode" as SmartFilter, label: "No Barcode", value: stats.noBarcode.length, icon: ScanLine },
    { key: "expired" as SmartFilter, label: "Expired", value: stats.expiredProducts.length, icon: XCircle },
    { key: "expiring" as SmartFilter, label: "Expiring", value: stats.expiringSoonProducts.length, icon: Activity },
    { key: "reserved" as SmartFilter, label: "Reserved", value: stats.reservedQty, icon: Archive },
    { key: "pending" as SmartFilter, label: "Pending", value: stats.pendingSync.length, icon: UploadCloud },
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
              <Badge className="rounded-full bg-primary/10 text-muted-foreground hover:bg-primary/10">
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
            <div className="rounded-2xl border border-border bg-muted/40 p-3">
              <p className="text-[11px] text-foreground">Available</p>
              <p className="font-data font-semibold text-sm mt-1 text-foreground">
                {getAvailableStock(p).toLocaleString()} {p.unit || "pcs"}
              </p>
            </div>

            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-3">
              <p className="text-[11px] text-orange-700">Reorder Qty</p>
              <p className="font-data font-semibold text-sm mt-1 text-orange-800 dark:text-orange-200">{reorderQty || "—"}</p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-3">
              <p className="text-[11px] text-foreground">FIFO Value</p>
              <p className="font-data font-semibold text-sm mt-1 text-foreground">{formatCurrency(value)}</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
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
              <Button size="sm" className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary">
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
        <PageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageBackground image={warehouseBg} opacity={0}>
      <PageShell
        title="Stock Overview"
        description="Track stock levels, replenishment risk and inventory value across the catalog."
      >
        <PageContainer>
          <PageToolbar>
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
          </PageToolbar>


          <StatGrid items={statCards} columns={5} />

          <SectionCard
            icon={Package}
            title="Stock Directory"
            description="Search, filter and review stock levels for every product in this workspace."
          >
            <FilterChips
              chips={smartCards.map((card) => ({
                key: card.key,
                label: card.label,
                count: card.value,
                icon: card.icon,
              }))}
              value={smartFilter}
              onChange={(key) => {
                setSmartFilter(key as SmartFilter);
                setPage(1);
              }}
            />


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
                  className="h-12 w-full rounded-2xl border bg-background pl-10 pr-4 text-sm outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-12 w-[150px] rounded-2xl">
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
                  <SelectTrigger className="h-12 w-[140px] rounded-2xl">
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
                  <SelectTrigger className="h-12 w-[125px] rounded-2xl">
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
                  <SelectTrigger className="h-12 w-[160px] rounded-2xl">
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

                <Button variant="ghost" className="h-12 rounded-2xl text-foreground" onClick={resetFilters}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No stock records match this view"
              description="Adjust the search or filters above to widen the results."
            />
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {pagedProducts.map((p) => (
                  <ProductCard key={p.id || p.sku || p.name} p={p} />
                ))}
              </div>
            ) : viewMode === "list" ? (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="data-table" style={{ minWidth: 1200 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Min / Max</th>
                      <th>Cost Value</th>
                      <th>Retail Value</th>
                      <th>Margin</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedProducts.map((p) => {
                      const stock = getStock(p);
                      const min = getMinStock(p);
                      const max = getMaxStock(p);
                      return (
                        <tr key={p.id || p.sku || p.name}>
                          <td>
                            <div className="flex items-center gap-3">
                              <ProductImage p={p} size="small" />
                              <div className="min-w-0">
                                <p className="font-semibold truncate max-w-[240px]">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.sku || "No SKU"} · {p.brand || "No brand"}</p>
                              </div>
                            </div>
                          </td>
                          <td>{p.category || "Uncategorized"}</td>
                          <td className="font-data">{stock} {p.unit || "pcs"}</td>
                          <td className="font-data">{min || "—"} / {max || "—"}</td>
                          <td className="font-data">{formatCurrency(getStockValue(p))}</td>
                          <td className="font-data">{formatCurrency(getRetailValue(p))}</td>
                          <td className={`px-4 py-3 font-data ${margin(p) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{margin(p).toFixed(1)}%</td>
                          <td>
                            <Badge variant="outline" className={stockBadge(stock, min, max)}>
                              {stockStatus(stock, min, max)}
                            </Badge>
                          </td>
                          <td className="text-right">
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

            <TablePagination
              page={currentPage}
              perPage={PAGE_SIZE}
              total={filteredProducts.length}
              onPageChange={setPage}
              noun="products"
            />
          </SectionCard>
        </PageContainer>
      </PageShell>
    </PageBackground>
  );
}