import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { useStockMovements } from "@/hooks/useStockMovements";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import {
  ArrowDown,
  ArrowUp,
  History,
  Package,
  Search,
  ClipboardList,
  ArrowLeftRight,
  ShoppingCart,
  Receipt,
  Eye,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CalendarDays,
  FileText,
  Layers3,
  Wifi,
  WifiOff,
  Database,
  UploadCloud,
  RotateCcw,
  RefreshCcw,
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Gauge,
  Zap,
  PackageCheck,
  PackageX,
  ScanLine,
  Archive,
  ArrowUpRight,
  ArrowDownRight,
  Settings2,
  Grid3X3,
  List,
  SlidersHorizontal,
  Timer,
  Box,
  Copy,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Lock,
  UserRound,
  Hash,
  Route,
  ServerCog,
  ClipboardCheck,
  FileWarning,
} from "lucide-react";
import {
  format,
  formatDistanceToNow,
  isAfter,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { isOnline, getCachedTable, saveCachedTable } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { toast } from "sonner";

const CONTROL_BLUE = "#2563eb";
const CONTROL_CYAN = "#0891b2";
const PAGE_SIZE = 24;

const TYPE_COLORS: Record<string, string> = {
  purchase: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  sale: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  refund: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  partial_refund: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  sale_cancel: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  adjustment: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  damage: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  wastage: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  correction: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  transfer: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  count: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  stock_count: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  opening_stock: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  manual: "bg-muted text-muted-foreground border-border",
};

const TYPE_ICONS: Record<string, any> = {
  purchase: ShoppingCart,
  sale: Receipt,
  refund: ArrowUp,
  partial_refund: ArrowUp,
  sale_cancel: ArrowUp,
  adjustment: ClipboardList,
  damage: AlertTriangle,
  wastage: AlertTriangle,
  correction: ShieldCheck,
  transfer: ArrowLeftRight,
  count: ClipboardList,
  stock_count: ClipboardList,
  opening_stock: PackageCheck,
  manual: FileText,
};

const TYPE_ICON_BG: Record<string, string> = {
  purchase: "#10b981",
  sale: "#3b82f6",
  refund: "#06b6d4",
  partial_refund: "#06b6d4",
  sale_cancel: "#f97316",
  adjustment: "#f59e0b",
  damage: "#ef4444",
  wastage: "#ef4444",
  correction: "#f59e0b",
  transfer: "#8b5cf6",
  count: "#14b8a6",
  stock_count: "#14b8a6",
  opening_stock: "#10b981",
  manual: CONTROL_BLUE,
};

type ViewMode = "timeline" | "grid" | "list" | "compact";
type SortKey = "created_at" | "product_name" | "movement_type" | "quantity_change" | "stock_after" | "risk_score";
type SmartFilter =
  | "all"
  | "stock_in"
  | "stock_out"
  | "risk"
  | "negative_after"
  | "large_change"
  | "no_reference"
  | "pending"
  | "today";

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function movementDate(m: any) {
  return m?.created_at || m?.created_offline_at || m?.updated_offline_at || new Date().toISOString();
}

function normalizeMovementType(type?: string | null) {
  return String(type || "manual").toLowerCase().replace(/\s+/g, "_");
}

function formatMovementType(type?: string | null) {
  return normalizeMovementType(type).replace(/_/g, " ");
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

function getMovementRiskScore(m: any) {
  const type = normalizeMovementType(m.movement_type);
  const qty = safeNumber(m.quantity_change);
  const before = safeNumber(m.stock_before);
  const after = safeNumber(m.stock_after);
  let score = 0;

  if (["damage", "wastage", "correction"].includes(type)) score += 35;
  if (after < 0) score += 40;
  if (!m.reference && !m.reference_id) score += 15;
  if (Math.abs(qty) >= 100) score += 15;
  if (before >= 0 && after >= 0 && Math.abs(after - before) !== Math.abs(qty)) score += 20;
  if (isPendingSync(m)) score += 8;
  if (!m.product_id && !m.product_name) score += 15;

  return Math.min(100, score);
}

function getRiskLabel(score: number) {
  if (score >= 70) return "Critical";
  if (score >= 40) return "High";
  if (score >= 15) return "Review";
  return "Normal";
}

function getRiskClass(score: number) {
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

function movementMatchesSearch(m: any, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();

  return [
    m.product_name,
    m.product_id,
    m.movement_type,
    m.reference,
    m.reference_id,
    m.notes,
    m.quantity_change,
    m.stock_before,
    m.stock_after,
    m.user_id,
    m.created_by,
    m.batch_id,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ")
    .includes(q);
}

function safeFormat(value: any, pattern: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, pattern);
}

function safeDistance(value: any) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

function dedupeMovements(rows: any[]) {
  const map = new Map<string, any>();

  for (const row of rows || []) {
    if (!row) continue;

    const key = String(
      row.id ||
        row.offline_id ||
        `${row.product_id || row.product_name || "movement"}-${row.reference || row.reference_id || "no-ref"}-${movementDate(row)}-${row.quantity_change}`
    );

    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }

    const existingTime = new Date(movementDate(existing)).getTime();
    const incomingTime = new Date(movementDate(row)).getTime();
    map.set(key, incomingTime >= existingTime ? { ...existing, ...row } : { ...row, ...existing });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(movementDate(b)).getTime() - new Date(movementDate(a)).getTime()
  );
}

export default function StockMovements() {
  const { user, tenantId, session } = useAuth();
  const { data: movements = [], isLoading } = useStockMovements(5000);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [page, setPage] = useState(1);
  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
  const [offlineMovements, setOfflineMovements] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const offlineModeActive = !isOnline() || isOfflineMode() || !session?.access_token;

  useEffect(() => {
    if (Array.isArray(movements) && movements.length > 0) {
      void saveCachedTable("stock_movements", movements as any[]);
    }
  }, [movements]);

  useEffect(() => {
    let mounted = true;

    getCachedTable("stock_movements")
      .then((records) => {
        if (mounted) setOfflineMovements(Array.isArray(records) ? records : []);
      })
      .catch(() => {
        if (mounted) setOfflineMovements([]);
      });

    return () => {
      mounted = false;
    };
  }, [offlineModeActive, movements]);

  const sourceMovements = useMemo(() => {
    const liveRows = Array.isArray(movements) ? movements : [];
    const cachedRows = Array.isArray(offlineMovements) ? offlineMovements : [];

    if (offlineModeActive) return dedupeMovements(cachedRows.length > 0 ? cachedRows : liveRows);

    const pendingCachedRows = cachedRows.filter(isPendingSync);
    return dedupeMovements([...pendingCachedRows, ...liveRows]);
  }, [offlineModeActive, offlineMovements, movements]);

  const normalizedMovements = useMemo(() => {
    const rows = Array.isArray(sourceMovements) ? sourceMovements : [];
    return rows
      .filter(Boolean)
      .map((m: any) => ({
        ...m,
        movement_type: normalizeMovementType(m.movement_type),
        created_at: movementDate(m),
      }));
  }, [sourceMovements]);

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>([
      "purchase",
      "sale",
      "refund",
      "partial_refund",
      "sale_cancel",
      "adjustment",
      "damage",
      "wastage",
      "correction",
      "transfer",
      "stock_count",
      "opening_stock",
      "manual",
    ]);
    normalizedMovements.forEach((m: any) => set.add(normalizeMovementType(m.movement_type)));
    return [...set].filter(Boolean).sort();
  }, [normalizedMovements]);

  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedMovements.forEach((m: any) => {
      const branch = String(m.branch_name || m.branch || m.branch_id || "").trim();
      if (branch) set.add(branch);
    });
    return Array.from(set).sort();
  }, [normalizedMovements]);

  const warehouseOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedMovements.forEach((m: any) => {
      const warehouse = String(m.warehouse_name || m.warehouse || m.warehouse_id || "").trim();
      if (warehouse) set.add(warehouse);
    });
    return Array.from(set).sort();
  }, [normalizedMovements]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const now = new Date();

    const list = normalizedMovements.filter((m: any) => {
      const qty = safeNumber(m.quantity_change);
      const after = safeNumber(m.stock_after);
      const risk = getMovementRiskScore(m);
      const movementDt = new Date(m.created_at);
      const pending = isPendingSync(m);

      if (typeFilter !== "all" && normalizeMovementType(m.movement_type) !== typeFilter) return false;

      const branchValue = String(m.branch_name || m.branch || m.branch_id || "").trim();
      const warehouseValue = String(m.warehouse_name || m.warehouse || m.warehouse_id || "").trim();

      if (branchFilter !== "all" && branchValue !== branchFilter) return false;
      if (warehouseFilter !== "all" && warehouseValue !== warehouseFilter) return false;

      if (directionFilter === "in" && qty <= 0) return false;
      if (directionFilter === "out" && qty >= 0) return false;
      if (directionFilter === "neutral" && qty !== 0) return false;

      if (syncFilter === "pending" && !pending) return false;
      if (syncFilter === "synced" && pending) return false;

      if (dateFilter === "today" && !isSameDay(movementDt, now)) return false;
      if (dateFilter === "week" && !isAfter(movementDt, startOfWeek(now, { weekStartsOn: 1 }))) return false;
      if (dateFilter === "month" && !isAfter(movementDt, startOfMonth(now))) return false;
      if (dateFilter === "7days" && !isAfter(movementDt, subDays(now, 7))) return false;
      if (dateFilter === "30days" && !isAfter(movementDt, subDays(now, 30))) return false;
      if (dateFilter === "90days" && !isAfter(movementDt, subMonths(now, 3))) return false;

      const matchesSmart =
        smartFilter === "all" ||
        (smartFilter === "stock_in" && qty > 0) ||
        (smartFilter === "stock_out" && qty < 0) ||
        (smartFilter === "risk" && risk >= 15) ||
        (smartFilter === "negative_after" && after < 0) ||
        (smartFilter === "large_change" && Math.abs(qty) >= 100) ||
        (smartFilter === "no_reference" && !m.reference && !m.reference_id) ||
        (smartFilter === "pending" && pending) ||
        (smartFilter === "today" && isSameDay(movementDt, now));

      return matchesSmart && movementMatchesSearch(m, q);
    });

    list.sort((a: any, b: any) => {
      if (sortKey === "created_at") {
        const av = new Date(a.created_at).getTime();
        const bv = new Date(b.created_at).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "risk_score") {
        return sortAsc
          ? getMovementRiskScore(a) - getMovementRiskScore(b)
          : getMovementRiskScore(b) - getMovementRiskScore(a);
      }

      const av = sortKey === "quantity_change" || sortKey === "stock_after" ? safeNumber(a[sortKey]) : a[sortKey];
      const bv = sortKey === "quantity_change" || sortKey === "stock_after" ? safeNumber(b[sortKey]) : b[sortKey];

      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      return sortAsc ? safeNumber(av) - safeNumber(bv) : safeNumber(bv) - safeNumber(av);
    });

    return list;
  }, [
    normalizedMovements,
    search,
    typeFilter,
    dateFilter,
    smartFilter,
    syncFilter,
    directionFilter,
    branchFilter,
    warehouseFilter,
    sortKey,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const summary = useMemo(() => {
    const totalIn = filtered
      .filter((m: any) => safeNumber(m.quantity_change) > 0)
      .reduce((s: number, m: any) => s + safeNumber(m.quantity_change), 0);

    const totalOut = filtered
      .filter((m: any) => safeNumber(m.quantity_change) < 0)
      .reduce((s: number, m: any) => s + Math.abs(safeNumber(m.quantity_change)), 0);

    const adjustments = filtered.filter((m: any) =>
      ["adjustment", "damage", "wastage", "correction"].includes(m.movement_type)
    ).length;

    const transfers = filtered.filter((m: any) => m.movement_type === "transfer").length;
    const purchases = filtered.filter((m: any) => m.movement_type === "purchase").length;
    const sales = filtered.filter((m: any) => m.movement_type === "sale").length;
    const refunds = filtered.filter((m: any) =>
      ["refund", "partial_refund", "sale_cancel"].includes(m.movement_type)
    ).length;

    const riskEvents = filtered.filter((m: any) => getMovementRiskScore(m) >= 15).length;
    const criticalEvents = filtered.filter((m: any) => getMovementRiskScore(m) >= 70).length;
    const negativeAfter = filtered.filter((m: any) => safeNumber(m.stock_after) < 0).length;
    const noReference = filtered.filter((m: any) => !m.reference && !m.reference_id).length;
    const pendingSync = filtered.filter(isPendingSync).length;
    const largeChanges = filtered.filter((m: any) => Math.abs(safeNumber(m.quantity_change)) >= 100).length;
    const uniqueProducts = new Set(filtered.map((m: any) => m.product_id || m.product_name).filter(Boolean)).size;

    const last24h = filtered.filter((m: any) => isAfter(new Date(m.created_at), subDays(new Date(), 1))).length;
    const last7d = filtered.filter((m: any) => isAfter(new Date(m.created_at), subDays(new Date(), 7))).length;

    const netMovement = totalIn - totalOut;
    const avgRisk = filtered.length
      ? Math.round(filtered.reduce((sum: number, m: any) => sum + getMovementRiskScore(m), 0) / filtered.length)
      : 0;

    const potentialReversals = filtered.filter((m: any, index: number) => {
      const quantity = safeNumber(m.quantity_change);
      if (quantity === 0) return false;
      const productKey = String(m.product_id || m.product_name || "");
      const referenceKey = String(m.reference || m.reference_id || "");
      const dateKey = safeFormat(m.created_at, "yyyy-MM-dd");

      return filtered.some((other: any, otherIndex: number) => {
        if (index === otherIndex) return false;
        const otherProductKey = String(other.product_id || other.product_name || "");
        const otherReferenceKey = String(other.reference || other.reference_id || "");
        const otherDateKey = safeFormat(other.created_at, "yyyy-MM-dd");
        return (
          productKey &&
          productKey === otherProductKey &&
          dateKey === otherDateKey &&
          quantity + safeNumber(other.quantity_change) === 0 &&
          (!referenceKey || !otherReferenceKey || referenceKey === otherReferenceKey)
        );
      });
    }).length;

    return {
      totalIn,
      totalOut,
      count: filtered.length,
      adjustments,
      transfers,
      purchases,
      sales,
      refunds,
      riskEvents,
      criticalEvents,
      negativeAfter,
      noReference,
      pendingSync,
      largeChanges,
      uniqueProducts,
      last24h,
      last7d,
      netMovement,
      avgRisk,
      potentialReversals,
      latest: filtered[0],
    };
  }, [filtered]);

  const typeBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; qtyIn: number; qtyOut: number; risk: number }>();

    filtered.forEach((m: any) => {
      const type = normalizeMovementType(m.movement_type);
      const current = map.get(type) || { count: 0, qtyIn: 0, qtyOut: 0, risk: 0 };
      const qty = safeNumber(m.quantity_change);

      current.count += 1;
      if (qty > 0) current.qtyIn += qty;
      if (qty < 0) current.qtyOut += Math.abs(qty);
      current.risk += getMovementRiskScore(m);

      map.set(type, current);
    });

    return Array.from(map.entries())
      .map(([type, data]) => ({
        type,
        ...data,
        avgRisk: data.count ? Math.round(data.risk / data.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filtered]);

  const productBreakdown = useMemo(() => {
    const map = new Map<string, { product: string; count: number; qtyIn: number; qtyOut: number; risk: number }>();

    filtered.forEach((m: any) => {
      const key = String(m.product_id || m.product_name || "Unknown Product");
      const current = map.get(key) || {
        product: m.product_name || "Unknown Product",
        count: 0,
        qtyIn: 0,
        qtyOut: 0,
        risk: 0,
      };

      const qty = safeNumber(m.quantity_change);
      current.count += 1;
      if (qty > 0) current.qtyIn += qty;
      if (qty < 0) current.qtyOut += Math.abs(qty);
      current.risk += getMovementRiskScore(m);

      map.set(key, current);
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        net: row.qtyIn - row.qtyOut,
        avgRisk: row.count ? Math.round(row.risk / row.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filtered]);

  const velocityRows = useMemo(() => {
    return productBreakdown
      .map((row) => ({
        ...row,
        movementRate: row.count,
        level: row.count >= 12 ? "Fast moving" : row.count <= 2 ? "Slow moving" : "Normal",
      }))
      .slice(0, 6);
  }, [productBreakdown]);

  const auditFlags = useMemo(() => {
    const adjustmentMap = new Map<string, number>();
    const damageMap = new Map<string, number>();
    const correctionMap = new Map<string, number>();
    const negativeMap = new Map<string, number>();

    filtered.forEach((m: any) => {
      const key = String(m.product_id || m.product_name || "Unknown Product");
      const type = normalizeMovementType(m.movement_type);

      if (["adjustment", "damage", "wastage", "correction"].includes(type)) {
        adjustmentMap.set(key, (adjustmentMap.get(key) || 0) + 1);
      }
      if (["damage", "wastage"].includes(type)) {
        damageMap.set(key, (damageMap.get(key) || 0) + 1);
      }
      if (type === "correction") {
        correctionMap.set(key, (correctionMap.get(key) || 0) + 1);
      }
      if (safeNumber(m.stock_after) < 0) {
        negativeMap.set(key, (negativeMap.get(key) || 0) + 1);
      }
    });

    const topRepeated = (map: Map<string, number>, minimum: number) =>
      Array.from(map.entries())
        .filter(([, count]) => count >= minimum)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    return [
      { label: "Repeated adjustments", rows: topRepeated(adjustmentMap, 3), detail: "Products with frequent manual stock changes" },
      { label: "Damage and wastage frequency", rows: topRepeated(damageMap, 2), detail: "Products with repeated loss records" },
      { label: "Frequent corrections", rows: topRepeated(correctionMap, 2), detail: "Products requiring repeated inventory correction" },
      { label: "Negative stock recurrence", rows: topRepeated(negativeMap, 1), detail: "Products that reached negative stock after movement" },
    ];
  }, [filtered]);

  const exportRows = filtered.map((m: any) => ({
    date: safeFormat(m.created_at, "yyyy-MM-dd HH:mm:ss"),
    product: m.product_name || "",
    product_id: m.product_id || "",
    type: formatMovementType(m.movement_type),
    direction: safeNumber(m.quantity_change) > 0 ? "Stock In" : safeNumber(m.quantity_change) < 0 ? "Stock Out" : "Neutral",
    change: safeNumber(m.quantity_change) > 0 ? `+${m.quantity_change}` : String(m.quantity_change),
    stock_before: m.stock_before,
    stock_after: m.stock_after,
    reference: m.reference || "",
    reference_id: m.reference_id || "",
    risk_score: getMovementRiskScore(m),
    risk_level: getRiskLabel(getMovementRiskScore(m)),
    sync_status: isPendingSync(m) ? "Pending" : "Synced",
    notes: m.notes ?? "",
  }));

  const cols = [
    { key: "date" as const, label: "Date" },
    { key: "product" as const, label: "Product" },
    { key: "product_id" as const, label: "Product ID" },
    { key: "type" as const, label: "Type" },
    { key: "direction" as const, label: "Direction" },
    { key: "change" as const, label: "Change" },
    { key: "stock_before" as const, label: "Before" },
    { key: "stock_after" as const, label: "After" },
    { key: "reference" as const, label: "Reference" },
    { key: "reference_id" as const, label: "Reference ID" },
    { key: "risk_score" as const, label: "Risk Score" },
    { key: "risk_level" as const, label: "Risk Level" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "notes" as const, label: "Notes" },
  ];

  const kpis = [
    {
      label: "Movements",
      value: compactNumber(summary.count),
      icon: Activity,
      color: "bg-violet-600 text-white border-violet-500",
      helper: `${summary.uniqueProducts} products`,
    },
    {
      label: "Stock In",
      value: `+${compactNumber(summary.totalIn)}`,
      icon: ArrowUp,
      color: "bg-emerald-600 text-white border-emerald-500",
      helper: "incoming units",
    },
    {
      label: "Stock Out",
      value: `-${compactNumber(summary.totalOut)}`,
      icon: ArrowDown,
      color: "bg-rose-600 text-white border-rose-500",
      helper: "outgoing units",
    },
    {
      label: "Risk Score",
      value: `${summary.avgRisk}%`,
      icon: Gauge,
      color: "bg-orange-600 text-white border-orange-500",
      helper: getRiskLabel(summary.avgRisk),
    },
  ];

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: summary.count, icon: History, color: "bg-slate-700 text-white" },
    { key: "stock_in" as SmartFilter, label: "Stock In", value: summary.totalIn, icon: ArrowUp, color: "bg-emerald-600 text-white" },
    { key: "stock_out" as SmartFilter, label: "Stock Out", value: summary.totalOut, icon: ArrowDown, color: "bg-rose-600 text-white" },
    { key: "risk" as SmartFilter, label: "Risk Events", value: summary.riskEvents, icon: AlertTriangle, color: "bg-orange-600 text-white" },
    { key: "negative_after" as SmartFilter, label: "Negative Stock", value: summary.negativeAfter, icon: PackageX, color: "bg-red-600 text-white" },
    { key: "large_change" as SmartFilter, label: "Large Changes", value: summary.largeChanges, icon: Activity, color: "bg-violet-600 text-white" },
    { key: "no_reference" as SmartFilter, label: "No Reference", value: summary.noReference, icon: FileWarning, color: "bg-amber-600 text-white" },
    { key: "pending" as SmartFilter, label: "Pending", value: summary.pendingSync, icon: UploadCloud, color: "bg-blue-600 text-white" },
    { key: "today" as SmartFilter, label: "Today", value: summary.last24h, icon: Timer, color: "bg-cyan-600 text-white" },
  ];

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setDateFilter("all");
    setSmartFilter("all");
    setSyncFilter("all");
    setDirectionFilter("all");
    setBranchFilter("all");
    setWarehouseFilter("all");
    setPage(1);
  };

  const copyMovement = async (m: any) => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            product: m.product_name,
            type: m.movement_type,
            quantity_change: m.quantity_change,
            stock_before: m.stock_before,
            stock_after: m.stock_after,
            reference: m.reference,
            date: m.created_at,
          },
          null,
          2
        )
      );
      toast.success("Movement details copied");
    } catch {
      toast.error("Failed to copy movement details");
    }
  };

  const printAuditReport = () => {
    const printWindow = window.open("", "_blank", "width=1100,height=900");

    if (!printWindow) {
      toast.error("Popup blocked. Allow popups to print the movement audit report.");
      return;
    }

    const rows = filtered.slice(0, 120);
    const generatedAt = safeFormat(new Date().toISOString(), "dd MMM yyyy, HH:mm");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Movement Audit Report</title>
          <meta charset="utf-8" />
          <style>
            body { margin: 0; background: #f3f4f6; color: #111827; font-family: Arial, sans-serif; }
            .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 16mm; }
            .bar { height: 8px; background: linear-gradient(90deg, #2563eb, #0891b2); margin: -16mm -16mm 14mm; }
            .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 18px; }
            h1 { margin: 0; color: #2563eb; letter-spacing: .03em; }
            .muted { color: #6b7280; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fbfdff; }
            .label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
            .value { font-size: 18px; font-weight: 800; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e5e7eb; }
            th { background: #2563eb; color: #fff; text-align: left; padding: 8px; text-transform: uppercase; font-size: 10px; }
            td { border-top: 1px solid #e5e7eb; padding: 8px; vertical-align: top; }
            .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 42px; }
            .sig { border-top: 1px solid #111827; text-align: center; padding-top: 8px; color: #4b5563; font-weight: 700; }
            @page { size: A4; margin: 0; }
            @media print { body { background: #fff; } .page { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="bar"></div>
            <div class="header">
              <div>
                <h1>ShopCore Stock Movement Audit Report</h1>
                <p class="muted">Generated ${generatedAt}</p>
              </div>
              <div style="text-align:right">
                <h1>AUDIT TRAIL</h1>
                <p class="muted">${filtered.length} movements</p>
              </div>
            </div>
            <div class="grid">
              <div class="card"><div class="label">Movements</div><div class="value">${summary.count}</div></div>
              <div class="card"><div class="label">Stock In</div><div class="value">+${summary.totalIn}</div></div>
              <div class="card"><div class="label">Stock Out</div><div class="value">-${summary.totalOut}</div></div>
              <div class="card"><div class="label">Pending Sync</div><div class="value">${summary.pendingSync}</div></div>
            </div>
            <table>
              <thead>
                <tr><th>Date</th><th>Product</th><th>Type</th><th>Change</th><th>Before / After</th><th>Reference</th><th>Risk</th></tr>
              </thead>
              <tbody>
                ${rows.map((m: any) => `
                  <tr>
                    <td>${safeFormat(m.created_at, "dd MMM yyyy HH:mm")}</td>
                    <td>${String(m.product_name || "Unknown Product").replace(/</g, "&lt;")}</td>
                    <td>${formatMovementType(m.movement_type)}</td>
                    <td>${safeNumber(m.quantity_change)}</td>
                    <td>${safeNumber(m.stock_before)} → ${safeNumber(m.stock_after)}</td>
                    <td>${String(m.reference || "—").replace(/</g, "&lt;")}</td>
                    <td>${getRiskLabel(getMovementRiskScore(m))}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div class="signatures">
              <div class="sig">Prepared By</div>
              <div class="sig">Reviewed By</div>
              <div class="sig">Approved By</div>
            </div>
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 350);</script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const MovementIconView = ({ type, className = "w-5 h-5" }: { type: string; className?: string }) => {
    const Icon = TYPE_ICONS[type] || FileText;
    return <Icon className={className} />;
  };

  const MovementMenu = ({ movement }: { movement: any }) => (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => setSelectedMovement(movement)}>
        <Eye className="w-4 h-4 mr-2" />
        View
      </Button>
      <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => copyMovement(movement)}>
        <Copy className="w-4 h-4" />
      </Button>
    </div>
  );

  const MovementCard = ({ movement }: { movement: any }) => {
    const positive = safeNumber(movement.quantity_change) > 0;
    const neutral = safeNumber(movement.quantity_change) === 0;
    const type = normalizeMovementType(movement.movement_type);
    const iconBg = TYPE_ICON_BG[type] || CONTROL_BLUE;
    const risk = getMovementRiskScore(movement);
    const pending = isPendingSync(movement);

    return (
      <div className="rounded-3xl border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0"
              style={{ background: iconBg }}
            >
              <MovementIconView type={type} />
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate">{movement.product_name || "Unknown Product"}</h3>
              <p className="text-xs text-muted-foreground">
                {safeFormat(movement.created_at, "MMM d, HH:mm")} · {safeDistance(movement.created_at)}
              </p>
            </div>
          </div>

          <Badge variant="outline" className={`capitalize rounded-full px-3 ${TYPE_COLORS[type] ?? TYPE_COLORS.manual}`}>
            {formatMovementType(type)}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Quantity</p>
            <p
              className={`font-data font-bold text-lg ${
                neutral ? "" : positive ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {positive ? `+${movement.quantity_change}` : movement.quantity_change}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Before / After</p>
            <p className="font-data font-semibold text-sm">
              {safeNumber(movement.stock_before)} → {safeNumber(movement.stock_after)}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Risk</p>
            <Badge variant="outline" className={`rounded-full ${getRiskClass(risk)}`}>
              {getRiskLabel(risk)}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Reference</p>
            <p className="font-data text-sm truncate">{movement.reference || "No reference"}</p>
          </div>

          <div className="rounded-2xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Sync</p>
            <p className={`font-medium text-sm ${pending ? "text-blue-600" : "text-emerald-600"}`}>
              {pending ? "Pending" : "Synced"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <div className="flex-1 rounded-2xl bg-muted/40 px-4 py-2 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{movement.notes || "No notes available"}</p>
          </div>
          <MovementMenu movement={movement} />
        </div>
      </div>
    );
  };

  return (
    <PageShell
      title="Stock Movement History"
      description="Enterprise inventory control for every stock movement, risk signal, source reference, sync state, and operational stock change."
    >
      <PageBackground image={warehouseBg} opacity={0.035}>
        <div className="space-y-6">
          {(offlineModeActive || summary.pendingSync > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "Stock movements are using offline cache" : "Some movements are waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending movement records in this view: {summary.pendingSync}. Audit records remain available while offline.
                    </p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  {offlineModeActive ? "Offline Audit" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-7 rounded-[1.5rem] border border-blue-200 bg-blue-50 shadow-sm p-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0"
                >
                  <History className="w-6 h-6" />
                </div>

                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/20 mb-3">
                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                    Inventory Operations Control
                  </Badge>
                  <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Stock Movement Control Center</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Monitor stock in, stock out, sales, purchases, refunds, transfers, corrections,
                    damage, wastage, stock counts, sync status, and risky inventory changes.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-blue-700">
                      <p className="text-xs text-blue-700/80">Mode</p>
                      <p className="text-sm font-semibold">{offlineModeActive ? "Offline audit" : "Live audit"}</p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
                      <p className="text-xs text-emerald-700/80">Net Movement</p>
                      <p className={`text-sm font-semibold font-data ${summary.netMovement < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {summary.netMovement > 0 ? "+" : ""}
                        {compactNumber(summary.netMovement)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-violet-700">
                      <p className="text-xs text-violet-700/80">Last 7 Days</p>
                      <p className="text-sm font-semibold font-data">{summary.last7d}</p>
                    </div>

                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-cyan-700">
                      <p className="text-xs text-cyan-700/80">Latest Activity</p>
                      <p className="text-sm font-semibold truncate">
                        {summary.latest?.product_name || "No movement yet"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 gap-3">
              {kpis.map((item) => {
                const Icon = item.icon;
                const valueClass = String(item.value).length > 10 ? "text-lg break-words" : "text-2xl";

                return (
                  <div
                    key={item.label}
                    className={`rounded-[1.25rem] border shadow-sm p-4 min-h-[112px] ${item.color}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">{item.label}</p>
                        <p className={`${valueClass} font-bold font-data mt-1`}>{item.value}</p>
                        <p className="text-[11px] opacity-70 truncate">{item.helper}</p>
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

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3">
            {smartCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  setSmartFilter(card.key);
                  setPage(1);
                }}
                className={`rounded-[1.25rem] border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  smartFilter === card.key ? "ring-2 ring-blue-600" : ""
                }`}
              >
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${card.color}`}>
                  <card.icon className="h-4 w-4" />
                </div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="font-data text-lg font-black">{compactNumber(Number(card.value || 0))}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl text-white flex items-center justify-center"
                  style={{ background: CONTROL_BLUE }}
                >
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Audit Summary</h3>
                  <p className="text-xs text-muted-foreground">Business source activity</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Purchases", value: summary.purchases, icon: ShoppingCart },
                  { label: "Sales", value: summary.sales, icon: Receipt },
                  { label: "Refunds", value: summary.refunds, icon: ArrowUp },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-center text-blue-700">
                    <item.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-data font-bold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-700">
                <p className="text-xs text-muted-foreground">Latest Activity</p>
                <p className="text-sm font-medium mt-1 truncate">
                  {summary.latest?.product_name || "No movement yet"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.latest ? `${formatMovementType(summary.latest.movement_type)} · ${safeDistance(summary.latest.created_at)}` : "No audit activity available"}
                </p>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-rose-200 bg-rose-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Risk & Control Signals</h3>
                  <p className="text-xs text-muted-foreground">Audit exceptions to review</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Critical Events", value: summary.criticalEvents, icon: FileWarning, tone: "bg-rose-500/10 text-rose-700" },
                  { label: "Negative Stock After", value: summary.negativeAfter, icon: PackageX, tone: "bg-orange-500/10 text-orange-700" },
                  { label: "No Reference", value: summary.noReference, icon: Hash, tone: "bg-amber-500/10 text-amber-700" },
                  { label: "Large Changes", value: summary.largeChanges, icon: Activity, tone: "bg-violet-500/10 text-violet-700" },
                ].map((row) => (
                  <div key={row.label} className={`flex items-center justify-between rounded-2xl p-3 ${row.tone}`}>
                    <div className="flex items-center gap-2">
                      <row.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{row.label}</span>
                    </div>
                    <span className="font-data font-bold">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-violet-200 bg-violet-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <Layers3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Movement Type Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Most common activity types</p>
                </div>
              </div>

              <div className="space-y-3">
                {typeBreakdown.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No movement breakdown yet.</p>
                  </div>
                ) : (
                  typeBreakdown.slice(0, 5).map((item) => {
                    const percent = summary.count > 0 ? Math.round((item.count / summary.count) * 100) : 0;

                    return (
                      <div key={item.type}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="capitalize">{formatMovementType(item.type)}</span>
                          <span className="font-data text-muted-foreground">
                            {item.count} · {percent}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, background: CONTROL_BLUE }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Movement Trend</h3>
                  <p className="text-xs text-muted-foreground">Recent stock in and stock out intensity</p>
                </div>
              </div>
              <div className="flex h-40 items-end gap-2 rounded-2xl bg-muted/30 p-4">
                {filtered.slice(0, 10).reverse().map((movement: any, index: number) => {
                  const quantity = Math.abs(safeNumber(movement.quantity_change));
                  const max = Math.max(1, ...filtered.slice(0, 10).map((row: any) => Math.abs(safeNumber(row.quantity_change))));
                  const height = Math.max(8, (quantity / max) * 100);

                  return (
                    <div key={`${movement.id || movement.product_name}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className={`w-full rounded-t-xl ${safeNumber(movement.quantity_change) >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ height: `${height}%`, minHeight: 8 }}
                        title={`${movement.product_name || "Movement"}: ${movement.quantity_change}`}
                      />
                      <span className="max-w-[42px] truncate text-[9px] text-muted-foreground">
                        {safeFormat(movement.created_at, "dd MMM")}
                      </span>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    No movement trend yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <Route className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Traceability Overview</h3>
                  <p className="text-xs text-muted-foreground">Source references and reversal signals</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Referenced</p>
                  <p className="font-data text-xl font-bold">{summary.count - summary.noReference}</p>
                </div>
                <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-700">
                  <p className="text-xs">Potential Reversals</p>
                  <p className="font-data text-xl font-bold">{summary.potentialReversals}</p>
                </div>
                <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-700">
                  <p className="text-xs">Branches</p>
                  <p className="font-data text-xl font-bold">{branchOptions.length}</p>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-700">
                  <p className="text-xs">Warehouses</p>
                  <p className="font-data text-xl font-bold">{warehouseOptions.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Inventory Velocity</h3>
                  <p className="text-xs text-muted-foreground">Fast and slow moving product signals</p>
                </div>
              </div>
              <div className="space-y-3">
                {velocityRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No velocity signal yet.</p>
                ) : (
                  velocityRows.slice(0, 4).map((row) => (
                    <div key={row.product} className="rounded-2xl bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{row.product}</span>
                        <Badge variant="outline" className="rounded-full">{row.level}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{row.movementRate} movement records</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Smart Audit Flags</h3>
                <p className="text-xs text-muted-foreground">Repeated stock behavior that may require review</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {auditFlags.map((flag) => (
                <div key={flag.label} className="rounded-2xl border bg-muted/30 p-4">
                  <p className="text-sm font-semibold">{flag.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{flag.detail}</p>
                  <div className="mt-3 space-y-2">
                    {flag.rows.length === 0 ? (
                      <p className="text-xs text-emerald-600">No active flag</p>
                    ) : (
                      flag.rows.map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate">{name}</span>
                          <span className="font-data font-bold">{count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-col gap-4 border-b p-4 lg:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">Audit Trail</h2>
                    <Badge variant="outline" className="rounded-full">
                      {offlineModeActive ? <WifiOff className="mr-1 h-3 w-3 text-amber-600" /> : <Wifi className="mr-1 h-3 w-3 text-emerald-600" />}
                      {offlineModeActive ? "Offline cache" : "Live online"}
                    </Badge>
                    {summary.pendingSync > 0 && (
                      <Badge className="rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/10">
                        <UploadCloud className="mr-1 h-3 w-3" />
                        {summary.pendingSync} pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} movements
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ExportMenu
                    onCSV={() => exportToCSV(exportRows, "stock_movements", cols)}
                    onPDF={() =>
                      exportToPDF(exportRows, "stock_movements", "Stock Movement Enterprise Audit Report", cols, {
                        subtitle: `${filtered.length} movements`,
                        summary: [
                          { label: "Movements", value: String(summary.count) },
                          { label: "Stock In", value: `+${summary.totalIn}` },
                          { label: "Stock Out", value: `-${summary.totalOut}` },
                          { label: "Net Movement", value: String(summary.netMovement) },
                          { label: "Risk Events", value: String(summary.riskEvents) },
                          { label: "Pending Sync", value: String(summary.pendingSync) },
                        ],
                      })
                    }
                  />

                  <Button variant="outline" className="rounded-2xl h-10" onClick={printAuditReport}>
                    <FileText className="w-4 h-4 mr-2" />
                    Print Audit
                  </Button>

                  <Button variant="outline" className="rounded-2xl h-10" onClick={() => toast.info("Audit trail refreshed from current query cache.")}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>

                  <div className="flex rounded-2xl border bg-muted/40 p-1">
                    {[
                      { key: "timeline" as ViewMode, label: "Timeline", icon: History },
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
                        style={viewMode === mode.key ? { background: CONTROL_BLUE } : undefined}
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
                  <Input
                    placeholder="Search product, SKU/product ID, reference, notes, type, quantity, user, batch..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10 h-11 rounded-2xl"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[165px] h-11 rounded-2xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {formatMovementType(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={directionFilter} onValueChange={(v) => { setDirectionFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[140px] h-11 rounded-2xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Direction</SelectItem>
                      <SelectItem value="in">Stock In</SelectItem>
                      <SelectItem value="out">Stock Out</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[150px] h-11 rounded-2xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branchOptions.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={warehouseFilter} onValueChange={(v) => { setWarehouseFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[165px] h-11 rounded-2xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Warehouses</SelectItem>
                      {warehouseOptions.map((warehouse) => (
                        <SelectItem key={warehouse} value={warehouse}>
                          {warehouse}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[145px] h-11 rounded-2xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={syncFilter} onValueChange={(v) => { setSyncFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[130px] h-11 rounded-2xl text-xs">
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
                    onValueChange={(v) => {
                      const [key, direction] = v.split(":") as [SortKey, "asc" | "desc"];
                      setSortKey(key);
                      setSortAsc(direction === "asc");
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[165px] h-11 rounded-2xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at:desc">Newest</SelectItem>
                      <SelectItem value="created_at:asc">Oldest</SelectItem>
                      <SelectItem value="product_name:asc">Product A-Z</SelectItem>
                      <SelectItem value="quantity_change:desc">Highest In</SelectItem>
                      <SelectItem value="quantity_change:asc">Highest Out</SelectItem>
                      <SelectItem value="risk_score:desc">Highest Risk</SelectItem>
                      <SelectItem value="stock_after:asc">Lowest Stock After</SelectItem>
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
              {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="rounded-3xl border bg-card p-5 shadow-sm">
                      <Skeleton className="h-44 w-full rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-3xl border bg-muted/20 py-16 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  No stock movements found
                </div>
              ) : viewMode === "timeline" ? (
                <div className="space-y-3">
                  {paged.map((m: any, index) => {
                    const type = normalizeMovementType(m.movement_type);
                    const iconBg = TYPE_ICON_BG[type] || CONTROL_BLUE;
                    const positive = safeNumber(m.quantity_change) > 0;
                    const risk = getMovementRiskScore(m);

                    return (
                      <div key={m.id || `${m.product_name}-${index}`} className="relative pl-8">
                        <div className="absolute left-[13px] top-14 bottom-[-12px] w-px bg-border last:hidden" />
                        <div
                          className="absolute left-0 top-4 h-7 w-7 rounded-full text-white flex items-center justify-center"
                          style={{ background: iconBg }}
                        >
                          <MovementIconView type={type} className="h-3.5 w-3.5" />
                        </div>

                        <div className="rounded-3xl border bg-card p-4 shadow-sm hover:shadow-md transition">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold truncate">{m.product_name || "Unknown Product"}</h3>
                                <Badge variant="outline" className={`capitalize rounded-full ${TYPE_COLORS[type] || TYPE_COLORS.manual}`}>
                                  {formatMovementType(type)}
                                </Badge>
                                <Badge variant="outline" className={`rounded-full ${getRiskClass(risk)}`}>
                                  {getRiskLabel(risk)}
                                </Badge>
                                {isPendingSync(m) && (
                                  <Badge variant="outline" className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {safeFormat(m.created_at, "dd MMM yyyy, HH:mm")} · {safeDistance(m.created_at)}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`font-data text-xl font-black ${positive ? "text-emerald-600" : safeNumber(m.quantity_change) < 0 ? "text-rose-600" : ""}`}>
                                  {positive ? `+${m.quantity_change}` : m.quantity_change}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {safeNumber(m.stock_before)} → {safeNumber(m.stock_after)}
                                </p>
                              </div>
                              <MovementMenu movement={m} />
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <p className="text-[11px] text-muted-foreground">Reference</p>
                              <p className="font-data text-sm truncate">{m.reference || "No reference"}</p>
                            </div>
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <p className="text-[11px] text-muted-foreground">Product ID</p>
                              <p className="font-data text-sm truncate">{m.product_id || "—"}</p>
                            </div>
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <p className="text-[11px] text-muted-foreground">Notes</p>
                              <p className="text-sm truncate">{m.notes || "No notes"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
                  {paged.map((m: any, index) => (
                    <MovementCard key={m.id || `${m.product_name}-${index}`} movement={m} />
                  ))}
                </div>
              ) : viewMode === "list" ? (
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[1200px] text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Product</th>
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className="px-4 py-3 text-left font-medium">Change</th>
                        <th className="px-4 py-3 text-left font-medium">Before / After</th>
                        <th className="px-4 py-3 text-left font-medium">Reference</th>
                        <th className="px-4 py-3 text-left font-medium">Risk</th>
                        <th className="px-4 py-3 text-left font-medium">Sync</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {paged.map((m: any, index) => {
                        const type = normalizeMovementType(m.movement_type);
                        const risk = getMovementRiskScore(m);
                        const qty = safeNumber(m.quantity_change);

                        return (
                          <tr key={m.id || `${m.product_name}-${index}`} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-data text-xs whitespace-nowrap">
                              {safeFormat(m.created_at, "yyyy-MM-dd HH:mm")}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium truncate max-w-[240px]">{m.product_name || "Unknown Product"}</p>
                              <p className="font-data text-xs text-muted-foreground truncate max-w-[240px]">{m.product_id || "—"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`capitalize rounded-full ${TYPE_COLORS[type] || TYPE_COLORS.manual}`}>
                                {formatMovementType(type)}
                              </Badge>
                            </td>
                            <td className={`px-4 py-3 font-data font-bold ${qty > 0 ? "text-emerald-600" : qty < 0 ? "text-rose-600" : ""}`}>
                              {qty > 0 ? `+${qty}` : qty}
                            </td>
                            <td className="px-4 py-3 font-data">
                              {safeNumber(m.stock_before)} → {safeNumber(m.stock_after)}
                            </td>
                            <td className="px-4 py-3 font-data text-xs truncate max-w-[180px]">{m.reference || "—"}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`rounded-full ${getRiskClass(risk)}`}>
                                {getRiskLabel(risk)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={isPendingSync(m) ? "rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30" : "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
                                {isPendingSync(m) ? "Pending" : "Synced"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end">
                                <MovementMenu movement={m} />
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
                  {paged.map((m: any, index) => {
                    const type = normalizeMovementType(m.movement_type);
                    const qty = safeNumber(m.quantity_change);
                    return (
                      <div key={m.id || `${m.product_name}-${index}`} className="rounded-2xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl text-white flex items-center justify-center shrink-0" style={{ background: TYPE_ICON_BG[type] || CONTROL_BLUE }}>
                            <MovementIconView type={type} className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{m.product_name || "Unknown Product"}</p>
                            <p className="truncate text-xs text-muted-foreground">{formatMovementType(type)} · {safeDistance(m.created_at)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSelectedMovement(m)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className={`font-data font-bold ${qty > 0 ? "text-emerald-600" : qty < 0 ? "text-rose-600" : ""}`}>
                            {qty > 0 ? `+${qty}` : qty}
                          </span>
                          <span className="text-muted-foreground">{safeNumber(m.stock_before)} → {safeNumber(m.stock_after)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t px-4 lg:px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages} · {filtered.length} movements
              </p>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  ‹
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                  .map((n, index, arr) => {
                    const previous = arr[index - 1];
                    const showDots = previous && n - previous > 1;

                    return (
                      <div key={n} className="flex items-center gap-1">
                        {showDots && <span className="px-2 text-xs text-muted-foreground">...</span>}
                        <Button
                          variant={n === currentPage ? "default" : "outline"}
                          size="icon"
                          className="h-9 w-9 rounded-xl text-xs"
                          style={n === currentPage ? { background: CONTROL_BLUE } : undefined}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </Button>
                      </div>
                    );
                  })}

                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                  ›
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Top Products by Movement Activity</h3>
                  <p className="text-xs text-muted-foreground">Products with most stock changes</p>
                </div>
              </div>

              <div className="space-y-3">
                {productBreakdown.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No product activity yet.</p>
                ) : (
                  productBreakdown.map((row) => {
                    const percent = summary.count ? Math.round((row.count / summary.count) * 100) : 0;
                    return (
                      <div key={row.product}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="truncate">{row.product}</span>
                          <span className="font-data text-muted-foreground">{row.count} · {percent}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, background: CONTROL_BLUE }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Audit Control Checklist</h3>
                  <p className="text-xs text-muted-foreground">Operational controls for inventory accuracy</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Every stock change has a reference", good: summary.noReference === 0, detail: `${summary.noReference} missing references` },
                  { label: "No negative stock after movement", good: summary.negativeAfter === 0, detail: `${summary.negativeAfter} negative stock events` },
                  { label: "Critical risk events reviewed", good: summary.criticalEvents === 0, detail: `${summary.criticalEvents} critical risk events` },
                  { label: "Offline movement queue is clear", good: summary.pendingSync === 0, detail: `${summary.pendingSync} pending movements` },
                ].map((item) => (
                  <div key={item.label} className={`rounded-2xl p-3 ${item.good ? "bg-emerald-500/10 text-emerald-700" : "bg-orange-500/10 text-orange-700"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {item.good ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <span className="text-xs">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={!!selectedMovement} onOpenChange={() => setSelectedMovement(null)}>
          <DialogContent className="max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>Movement Details</DialogTitle>
              <DialogDescription>Full audit details for this stock movement.</DialogDescription>
            </DialogHeader>

            {selectedMovement && (
              <div className="space-y-5 text-sm">
                <div className="flex items-center gap-4 rounded-3xl border bg-muted/30 p-4">
                  <div className="w-14 h-14 rounded-2xl text-white flex items-center justify-center shrink-0" style={{ background: TYPE_ICON_BG[normalizeMovementType(selectedMovement.movement_type)] || CONTROL_BLUE }}>
                    <MovementIconView type={normalizeMovementType(selectedMovement.movement_type)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Product</p>
                    <p className="font-semibold truncate">{selectedMovement.product_name || "Unknown Product"}</p>
                    <p className="text-xs text-muted-foreground font-data truncate">{selectedMovement.product_id || "No product ID"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Type</p>
                    <p className="font-medium capitalize">{formatMovementType(selectedMovement.movement_type)}</p>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Quantity Change</p>
                    <p className="font-data font-bold">{selectedMovement.quantity_change}</p>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Before / After</p>
                    <p className="font-data font-medium">
                      {safeNumber(selectedMovement.stock_before)} → {safeNumber(selectedMovement.stock_after)}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Risk Level</p>
                    <Badge variant="outline" className={`rounded-full ${getRiskClass(getMovementRiskScore(selectedMovement))}`}>
                      {getRiskLabel(getMovementRiskScore(selectedMovement))}
                    </Badge>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Reference</p>
                    <p className="font-data font-medium break-words">{selectedMovement.reference || "—"}</p>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Reference ID</p>
                    <p className="font-data font-medium break-words">{selectedMovement.reference_id || "—"}</p>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Sync</p>
                    <p className={isPendingSync(selectedMovement) ? "font-medium text-blue-600" : "font-medium text-emerald-600"}>
                      {isPendingSync(selectedMovement) ? "Pending Sync" : "Synced"}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Date</p>
                    <p className="font-medium">{safeFormat(selectedMovement.created_at, "yyyy-MM-dd HH:mm:ss")}</p>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="font-medium mt-1">{selectedMovement.notes || "—"}</p>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-muted-foreground text-xs">Audit Metadata</p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 font-data text-xs">
                    <p>ID: {selectedMovement.id || "—"}</p>
                    <p>User: {selectedMovement.user_id || selectedMovement.created_by || "—"}</p>
                    <p>Tenant: {selectedMovement.tenant_id || tenantId || "—"}</p>
                    <p>Batch: {selectedMovement.batch_id || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => selectedMovement && copyMovement(selectedMovement)}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Details
              </Button>
              <Button variant="outline" onClick={() => setSelectedMovement(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}