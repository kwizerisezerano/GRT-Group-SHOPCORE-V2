import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {
  PageContainer,
  PageToolbar,
  StatGrid,
  SectionCard,
  FilterChips,
  TablePagination,  EmptyState,
  type StatItem,
} from "@/components/patterns";
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
  Search,
  ClipboardList,
  ArrowLeftRight,
  ShoppingCart,
  Receipt,
  Eye,
  ShieldCheck,
  Activity,
  AlertTriangle,
  FileText,
  Layers3,
  UploadCloud,
  RotateCcw,
  RefreshCcw,
  Gauge,
  PackageCheck,
  PackageX,
  Grid3X3,
  List,
  Timer,
  Copy,
  FileWarning,
} from "lucide-react";
import {
  format,
  formatDistanceToNow,
  isAfter,
  isSameDay,
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
  sale: "bg-primary/10 text-muted-foreground border-primary/30",
  refund: "bg-primary/10 text-muted-foreground border-primary/30",
  partial_refund: "bg-primary/10 text-muted-foreground border-primary/30",
  sale_cancel: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  adjustment: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  damage: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  wastage: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  correction: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  transfer: "bg-primary/10 text-muted-foreground border-primary/30",
  count: "bg-primary/10 text-muted-foreground border-primary/30",
  stock_count: "bg-primary/10 text-muted-foreground border-primary/30",
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


  const statCards: StatItem[] = [
    {
      label: "Movements",
      value: compactNumber(summary.count),
      icon: Activity,
      tone: "indigo",
      helper: `${summary.uniqueProducts} products`,
    },
    {
      label: "Stock In",
      value: `+${compactNumber(summary.totalIn)}`,
      icon: ArrowUp,
      tone: "emerald",
      helper: "incoming units",
    },
    {
      label: "Stock Out",
      value: `-${compactNumber(summary.totalOut)}`,
      icon: ArrowDown,
      tone: summary.totalOut > 0 ? "amber" : "sky",
      helper: "outgoing units",
    },
    {
      label: "Risk Score",
      value: `${summary.avgRisk}%`,
      icon: Gauge,
      tone: summary.avgRisk >= 50 ? "rose" : "teal",
      helper: getRiskLabel(summary.avgRisk),
    },
    {
      label: "Pending Sync",
      value: summary.pendingSync,
      icon: UploadCloud,
      tone: summary.pendingSync > 0 ? "amber" : "cyan",
      helper: "offline changes",
    },
  ];

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: summary.count, icon: History },
    { key: "stock_in" as SmartFilter, label: "Stock In", value: summary.totalIn, icon: ArrowUp },
    { key: "stock_out" as SmartFilter, label: "Stock Out", value: summary.totalOut, icon: ArrowDown },
    { key: "risk" as SmartFilter, label: "Risk Events", value: summary.riskEvents, icon: AlertTriangle },
    { key: "negative_after" as SmartFilter, label: "Negative Stock", value: summary.negativeAfter, icon: PackageX },
    { key: "large_change" as SmartFilter, label: "Large Changes", value: summary.largeChanges, icon: Activity },
    { key: "no_reference" as SmartFilter, label: "No Reference", value: summary.noReference, icon: FileWarning },
    { key: "pending" as SmartFilter, label: "Pending", value: summary.pendingSync, icon: UploadCloud },
    { key: "today" as SmartFilter, label: "Today", value: summary.last24h, icon: Timer },
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
            <p className={`font-medium text-sm ${pending ? "text-muted-foreground" : "text-emerald-600"}`}>
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
      description="Review every stock movement, its source reference, risk signal and sync state."
    >
      <PageBackground image={warehouseBg} opacity={0}>
        <PageContainer>
          <PageToolbar>
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

            <Button variant="outline" className="h-9 rounded-xl" onClick={printAuditReport}>
              <FileText className="w-4 h-4 mr-2" />
              Print Audit
            </Button>

            <Button variant="outline" className="h-9 rounded-xl" onClick={() => toast.info("Audit trail refreshed from current query cache.")}>
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
          </PageToolbar>


          <StatGrid items={statCards} columns={5} />

          <SectionCard
            icon={History}
            title="Audit Trail"
            description="Search and filter every stock movement recorded in this workspace."
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
                <Input
                  placeholder="Search product, SKU/product ID, reference, notes, type, quantity, user, batch..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10 h-12 rounded-2xl"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[165px] h-12 rounded-2xl">
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
                  <SelectTrigger className="w-[140px] h-12 rounded-2xl">
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
                  <SelectTrigger className="w-[150px] h-12 rounded-2xl">
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
                  <SelectTrigger className="w-[165px] h-12 rounded-2xl">
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
                  <SelectTrigger className="w-[145px] h-12 rounded-2xl">
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
                  <SelectTrigger className="w-[130px] h-12 rounded-2xl">
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
                  <SelectTrigger className="w-[165px] h-12 rounded-2xl">
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

                <Button variant="ghost" className="h-12 rounded-2xl text-foreground" onClick={resetFilters}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="rounded-3xl border bg-card p-5 shadow-sm">
                    <Skeleton className="h-44 w-full rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
            <EmptyState
              icon={History}
              title="No stock movements found"
              description="Adjust the filters above to widen the results."
            />
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
                                <Badge variant="outline" className="rounded-full bg-primary/10 text-muted-foreground border-primary/30">
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
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="data-table" style={{ minWidth: 1200 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Type</th>
                      <th>Change</th>
                      <th>Before / After</th>
                      <th>Reference</th>
                      <th>Risk</th>
                      <th>Sync</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paged.map((m: any, index) => {
                      const type = normalizeMovementType(m.movement_type);
                      const risk = getMovementRiskScore(m);
                      const qty = safeNumber(m.quantity_change);

                      return (
                        <tr key={m.id || `${m.product_name}-${index}`}>
                          <td className="font-data text-xs whitespace-nowrap">
                            {safeFormat(m.created_at, "yyyy-MM-dd HH:mm")}
                          </td>
                          <td>
                            <p className="font-medium truncate max-w-[240px]">{m.product_name || "Unknown Product"}</p>
                            <p className="font-data text-xs text-muted-foreground truncate max-w-[240px]">{m.product_id || "—"}</p>
                          </td>
                          <td>
                            <Badge variant="outline" className={`capitalize rounded-full ${TYPE_COLORS[type] || TYPE_COLORS.manual}`}>
                              {formatMovementType(type)}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 font-data font-bold ${qty > 0 ? "text-emerald-600" : qty < 0 ? "text-rose-600" : ""}`}>
                            {qty > 0 ? `+${qty}` : qty}
                          </td>
                          <td className="font-data">
                            {safeNumber(m.stock_before)} → {safeNumber(m.stock_after)}
                          </td>
                          <td className="font-data text-xs truncate max-w-[180px]">{m.reference || "—"}</td>
                          <td>
                            <Badge variant="outline" className={`rounded-full ${getRiskClass(risk)}`}>
                              {getRiskLabel(risk)}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant="outline" className={isPendingSync(m) ? "rounded-full bg-primary/10 text-muted-foreground border-primary/30" : "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
                              {isPendingSync(m) ? "Pending" : "Synced"}
                            </Badge>
                          </td>
                          <td className="text-right">
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

            <TablePagination
              page={currentPage}
              perPage={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
              noun="movements"
            />
          </SectionCard>
        </PageContainer>

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
                    <p className={isPendingSync(selectedMovement) ? "font-medium text-muted-foreground" : "font-medium text-emerald-600"}>
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