import { useMemo, useState } from "react";
import {
  Box,
  Plus,
  Pencil,
  Trash2,
  Search,
  ScanBarcode,
  AlertTriangle,
  ClipboardCheck,
  Package,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  CalendarDays,
  UserCheck,
  BarChart3,
  WifiOff,
  Database,
  UploadCloud,
  RotateCcw,
  Grid3X3,
  List,
  Eye,
  MoreHorizontal,
  FileText,
  Gauge,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  PieChart,
  Target,
  Layers3,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { useProducts } from "@/hooks/useSupabaseData";
import {
  getCachedProducts,
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedProducts,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { toast } from "sonner";

const CONTROL_BLUE = "#2563eb";
const PAGE_SIZE = 24;

interface StockCount {
  id: string;
  tenant_id: string;
  user_id: string | null;
  count_no: string | null;
  product_id: string | null;
  product_name: string;
  sku?: string | null;
  location: string | null;
  system_quantity: number;
  counted_quantity: number;
  variance: number;
  status: string | null;
  counted_by: string | null;
  count_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
  sync_status?: string | null;
  operation?: "create" | "update" | "delete" | null;
  offline_id?: string | null;
  created_offline_at?: string | null;
  updated_offline_at?: string | null;
}

type ViewMode = "grid" | "list" | "compact";
type SmartFilter =
  | "all"
  | "active"
  | "completed"
  | "variance"
  | "clean"
  | "positive"
  | "negative"
  | "critical"
  | "pending_sync";

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function getProductStock(product: any) {
  return Math.max(0, safeNumber(product?.stock ?? product?.stock_quantity));
}

function getProductMinStock(product: any) {
  return Math.max(0, safeNumber(product?.min_stock ?? product?.min_stock_level ?? product?.reorder_level));
}

function getCountDate(count: any) {
  return (
    count?.updated_offline_at ||
    count?.updated_at ||
    count?.created_offline_at ||
    count?.created_at ||
    count?.count_date ||
    new Date().toISOString()
  );
}

function formatDate(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: any) {
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

function isPendingSync(row: any) {
  return (
    String(row?.id || "").startsWith("offline-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    String(row?.sync_status || "").toLowerCase().includes("pending")
  );
}

function isPendingDelete(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function getVariance(count: Partial<StockCount>) {
  return safeNumber(count.counted_quantity) - safeNumber(count.system_quantity);
}

function varianceClass(variance: number) {
  if (variance > 0) return "text-emerald-600";
  if (variance < 0) return "text-rose-600";
  return "text-muted-foreground";
}

function varianceBadgeClass(variance: number) {
  if (variance > 0) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
  if (variance < 0) return "bg-rose-500/10 text-rose-600 border-rose-500/30";
  return "bg-slate-500/10 text-slate-600 border-slate-500/30";
}

function statusClass(value: string | null) {
  if (value === "completed") {
    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
  }

  if (value === "cancelled") {
    return "bg-rose-500/10 text-rose-600 border-rose-500/30";
  }

  return "bg-amber-500/10 text-amber-600 border-amber-500/30";
}

function countRiskScore(count: StockCount) {
  const variance = Math.abs(getVariance(count));
  const system = Math.max(1, Math.abs(safeNumber(count.system_quantity)));
  const varianceRate = (variance / system) * 100;
  let score = 0;

  if (variance > 0) score += 12;
  if (varianceRate >= 10) score += 15;
  if (varianceRate >= 25) score += 25;
  if (varianceRate >= 50) score += 25;
  if ((count.status || "active") === "active" && variance > 0) score += 10;
  if (!count.location) score += 6;
  if (!count.counted_by) score += 6;
  if (isPendingSync(count)) score += 8;

  return Math.min(100, score);
}

function riskLabel(score: number) {
  if (score >= 70) return "Critical";
  if (score >= 40) return "High Risk";
  if (score >= 15) return "Review";
  return "Normal";
}

function riskClass(score: number) {
  if (score >= 70) return "bg-rose-500/10 text-rose-600 border-rose-500/30";
  if (score >= 40) return "bg-orange-500/10 text-orange-600 border-orange-500/30";
  if (score >= 15) return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
}

function dedupeCounts(counts: StockCount[]) {
  const map = new Map<string, StockCount>();

  for (const count of counts || []) {
    const key = String(count.id || count.offline_id || count.count_no || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, count);
      continue;
    }

    const existingTime = new Date(getCountDate(existing)).getTime();
    const incomingTime = new Date(getCountDate(count)).getTime();

    map.set(
      key,
      incomingTime >= existingTime ? { ...existing, ...count } : { ...count, ...existing }
    );
  }

  return Array.from(map.values())
    .filter((count) => !isPendingDelete(count))
    .sort((a, b) => new Date(getCountDate(b)).getTime() - new Date(getCountDate(a)).getTime());
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function withTimeout<T>(promise: Promise<T>, message = "Operation timeout", timeoutMs = 12000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }),
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function cleanProductQueuePatch(patch: Record<string, any>) {
  const clean = { ...patch };
  delete clean.price;
  delete clean.purchase_price;
  delete clean.unit_cost;
  return clean;
}

function cleanStockCountPayload(payload: Record<string, any>) {
  const clean = { ...payload };
  delete clean.variance;
  delete clean.offline_id;
  delete clean.sync_status;
  delete clean.operation;
  delete clean.created_offline_at;
  delete clean.updated_offline_at;
  Object.keys(clean).forEach((key) => {
    if (clean[key] === undefined) delete clean[key];
  });
  return clean;
}

export default function StockCounts() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editing, setEditing] = useState<StockCount | null>(null);
  const [viewCount, setViewCount] = useState<StockCount | null>(null);
  const [deleteCountRow, setDeleteCountRow] = useState<StockCount | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const [countNo, setCountNo] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [location, setLocation] = useState("");
  const [systemQuantity, setSystemQuantity] = useState("");
  const [countedQuantity, setCountedQuantity] = useState("");
  const [status, setStatus] = useState("active");
  const [countedBy, setCountedBy] = useState("");
  const [countDate, setCountDate] = useState("");
  const [notes, setNotes] = useState("");

  const offlineModeActive = !isOnline() || isOfflineMode() || !session?.access_token;
  const canUseOnlineSupabase = isOnline() && !!session?.access_token && !isOfflineMode();

  const cleanProducts = useMemo(
    () => (products as any[]).filter((product) => !isPendingDelete(product)),
    [products]
  );

  const selectedProduct = cleanProducts.find((p) => p.id === selectedProductId);
  const systemQty = safeNumber(systemQuantity);
  const countedQty = safeNumber(countedQuantity);
  const variancePreview = countedQty - systemQty;

  const { data: counts = [], isLoading } = useQuery({
    queryKey: ["stock-counts", tenantId, offlineModeActive ? "offline" : "online"],
    enabled: !!user && !!tenantId,
    retry: offlineModeActive ? 0 : 1,
    refetchOnWindowFocus: !offlineModeActive,
    queryFn: async () => {
      if (offlineModeActive) {
        const cached = (await getCachedTable("stock_counts")) as unknown as StockCount[];
        return dedupeCounts(cached);
      }

      try {
        const { data, error } = await (supabase as any)
          .from("stock_counts")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const cleaned = dedupeCounts((data || []) as StockCount[]);
        await saveCachedTable("stock_counts", cleaned);
        return cleaned;
      } catch (error) {
        const cached = (await getCachedTable("stock_counts")) as unknown as StockCount[];
        if (cached.length > 0) return dedupeCounts(cached);
        throw error;
      }
    },
  });

  const filteredCounts = useMemo(() => {
    const q = search.toLowerCase().trim();

    return counts.filter((count) => {
      const variance = getVariance(count);
      const risk = countRiskScore(count);
      const currentStatus = count.status || "active";
      const pending = isPendingSync(count);

      const matchesSearch =
        !q ||
        (count.count_no || "").toLowerCase().includes(q) ||
        (count.product_name || "").toLowerCase().includes(q) ||
        (count.sku || "").toLowerCase().includes(q) ||
        (count.location || "").toLowerCase().includes(q) ||
        (count.counted_by || "").toLowerCase().includes(q) ||
        (count.notes || "").toLowerCase().includes(q) ||
        String(count.system_quantity || "").includes(q) ||
        String(count.counted_quantity || "").includes(q) ||
        String(variance || "").includes(q);

      const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;

      const matchesSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      const matchesSmart =
        smartFilter === "all" ||
        (smartFilter === "active" && currentStatus === "active") ||
        (smartFilter === "completed" && currentStatus === "completed") ||
        (smartFilter === "variance" && variance !== 0) ||
        (smartFilter === "clean" && variance === 0) ||
        (smartFilter === "positive" && variance > 0) ||
        (smartFilter === "negative" && variance < 0) ||
        (smartFilter === "critical" && risk >= 70) ||
        (smartFilter === "pending_sync" && pending);

      return matchesSearch && matchesStatus && matchesSync && matchesSmart;
    });
  }, [counts, search, statusFilter, syncFilter, smartFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCounts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCounts = filteredCounts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const active = counts.filter((count) => (count.status || "active") === "active").length;
    const completed = counts.filter((count) => count.status === "completed").length;
    const cancelled = counts.filter((count) => count.status === "cancelled").length;
    const variances = counts.filter((count) => getVariance(count) !== 0).length;
    const positiveVariance = counts.filter((count) => getVariance(count) > 0).length;
    const negativeVariance = counts.filter((count) => getVariance(count) < 0).length;
    const cleanCounts = counts.filter((count) => getVariance(count) === 0).length;
    const totalSystemQty = counts.reduce((sum, count) => sum + safeNumber(count.system_quantity), 0);
    const totalCountedQty = counts.reduce((sum, count) => sum + safeNumber(count.counted_quantity), 0);
    const netVariance = totalCountedQty - totalSystemQty;
    const absoluteVariance = counts.reduce((sum, count) => sum + Math.abs(getVariance(count)), 0);
    const pendingSync = counts.filter(isPendingSync).length;
    const risky = counts.filter((count) => countRiskScore(count) >= 15).length;
    const critical = counts.filter((count) => countRiskScore(count) >= 70).length;
    const accuracyRate =
      counts.length > 0
        ? Math.max(0, Math.min(100, Math.round((cleanCounts / counts.length) * 100)))
        : 100;

    const auditHealth =
      counts.length > 0
        ? Math.max(0, Math.min(100, Math.round(100 - variances * 3 - critical * 10 - pendingSync * 2)))
        : 100;

    const locationMap = new Map<string, { counts: number; variance: number }>();
    counts.forEach((count) => {
      const name = count.location || "No location";
      const row = locationMap.get(name) || { counts: 0, variance: 0 };
      row.counts += 1;
      row.variance += Math.abs(getVariance(count));
      locationMap.set(name, row);
    });

    const locationBreakdown = Array.from(locationMap.entries())
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 6);

    const varianceTrend = counts
      .slice()
      .reverse()
      .slice(-8)
      .map((count) => ({
        label: count.count_no || formatDate(count.count_date || count.created_at),
        variance: Math.abs(getVariance(count)),
      }));

    return {
      active,
      completed,
      cancelled,
      variances,
      totalItems: counts.length,
      positiveVariance,
      negativeVariance,
      cleanCounts,
      totalSystemQty,
      totalCountedQty,
      netVariance,
      absoluteVariance,
      pendingSync,
      risky,
      critical,
      accuracyRate,
      auditHealth,
      locationBreakdown,
      varianceTrend,
    };
  }, [counts]);

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: stats.totalItems, icon: ClipboardCheck, color: "bg-slate-700 text-white" },
    { key: "active" as SmartFilter, label: "Active", value: stats.active, icon: ClipboardList, color: "bg-amber-600 text-white" },
    { key: "completed" as SmartFilter, label: "Completed", value: stats.completed, icon: CheckCircle2, color: "bg-emerald-600 text-white" },
    { key: "variance" as SmartFilter, label: "Variance", value: stats.variances, icon: AlertTriangle, color: "bg-orange-600 text-white" },
    { key: "clean" as SmartFilter, label: "Clean", value: stats.cleanCounts, icon: ShieldCheck, color: "bg-blue-600 text-white" },
    { key: "positive" as SmartFilter, label: "Positive", value: stats.positiveVariance, icon: TrendingUp, color: "bg-emerald-600 text-white" },
    { key: "negative" as SmartFilter, label: "Negative", value: stats.negativeVariance, icon: TrendingDown, color: "bg-rose-600 text-white" },
    { key: "pending_sync" as SmartFilter, label: "Pending Sync", value: stats.pendingSync, icon: UploadCloud, color: "bg-violet-600 text-white" },
  ];

  const exportRows = filteredCounts.map((count) => {
    const variance = getVariance(count);
    const risk = countRiskScore(count);

    return {
      count_no: count.count_no || "",
      product: count.product_name || "",
      sku: count.sku || "",
      location: count.location || "",
      system_quantity: safeNumber(count.system_quantity),
      counted_quantity: safeNumber(count.counted_quantity),
      variance,
      status: count.status || "active",
      counted_by: count.counted_by || "",
      count_date: count.count_date || "",
      risk: riskLabel(risk),
      sync: isPendingSync(count) ? "Pending" : "Synced",
      notes: count.notes || "",
    };
  });

  const exportCols = [
    { key: "count_no" as const, label: "Count No" },
    { key: "product" as const, label: "Product" },
    { key: "sku" as const, label: "SKU" },
    { key: "location" as const, label: "Location" },
    { key: "system_quantity" as const, label: "System Qty" },
    { key: "counted_quantity" as const, label: "Counted Qty" },
    { key: "variance" as const, label: "Variance" },
    { key: "status" as const, label: "Status" },
    { key: "counted_by" as const, label: "Counted By" },
    { key: "count_date" as const, label: "Count Date" },
    { key: "risk" as const, label: "Risk" },
    { key: "sync" as const, label: "Sync" },
  ];

  const refreshCountQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stock-counts"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const buildCountPayload = () => {
    const product = selectedProduct || cleanProducts.find((item) => item.name === productName);
    const variance = countedQty - systemQty;

    return {
      tenant_id: tenantId,
      user_id: user?.id || null,
      count_no: countNo.trim() || `SC-${Date.now()}`,
      product_id: product?.id || selectedProductId || null,
      product_name: productName.trim(),
      sku: product?.sku || "",
      location: location.trim() || null,
      system_quantity: systemQty,
      counted_quantity: countedQty,
      variance,
      status: status || "active",
      counted_by: countedBy.trim() || user?.email || null,
      count_date: countDate || todayIso(),
      notes: notes.trim() || null,
    };
  };

  const queueProductReconciliation = async (payload: any, savedCountId: string | null) => {
    const product = selectedProduct || cleanProducts.find((item) => item.id === payload.product_id || item.name === payload.product_name);
    if (!product || payload.status !== "completed") return;

    const productStatus =
      payload.counted_quantity <= 0
        ? "out_of_stock"
        : payload.counted_quantity <= getProductMinStock(product)
          ? "low_stock"
          : "active";

    const now = nowIso();
    const cachedProducts = await getCachedProducts();

    const updatedProducts = cachedProducts.map((cached: any) => {
      if (String(cached.id) !== String(product.id)) return cached;

      return {
        ...cached,
        stock: payload.counted_quantity,
        stock_quantity: payload.counted_quantity,
        status: productStatus,
        updated_at: now,
        updated_offline_at: now,
        sync_status: "pending_update",
      };
    });

    await saveCachedProducts(updatedProducts);

    await savePending(
      "products",
      cleanProductQueuePatch({
        id: product.id,
        operation: "update",
        stock: payload.counted_quantity,
        stock_quantity: payload.counted_quantity,
        status: productStatus,
        sync_status: "pending_update",
        updated_offline_at: now,
      })
    );

    const movement = {
      id: makeLocalId("offline-stock-movement"),
      tenant_id: tenantId,
      user_id: user?.id || null,
      product_id: product.id,
      product_name: product.name,
      movement_type: "stock_count",
      quantity_change: payload.variance,
      stock_before: payload.system_quantity,
      stock_after: payload.counted_quantity,
      reference: payload.count_no,
      reference_id: savedCountId,
      notes: payload.notes || "Stock count reconciliation",
      operation: "create",
      sync_status: "pending",
      created_at: now,
      created_offline_at: now,
      updated_offline_at: now,
    };

    const cachedMovements = (await getCachedTable("stock_movements")) as unknown as any[];
    await saveCachedTable("stock_movements", [movement, ...(Array.isArray(cachedMovements) ? cachedMovements : [])]);
    await savePending("stock_movements", movement);
  };

  const saveCountOffline = async (payload: any, options: { forceId?: string } = {}) => {
    if (!tenantId) throw new Error("No active workspace");

    const now = nowIso();
    const id = options.forceId || editing?.id || makeLocalId("offline-stock-count");
    const operation = String(id).startsWith("offline-") ? "create" : editing || options.forceId ? "update" : "create";

    const offlineCount: StockCount = {
      ...(editing || {}),
      ...payload,
      id,
      tenant_id: tenantId,
      user_id: user?.id || null,
      operation: operation as any,
      sync_status: operation === "create" ? "pending" : "pending_update",
      created_at: (editing as any)?.created_at || now,
      updated_at: now,
      created_offline_at: (editing as any)?.created_offline_at || (operation === "create" ? now : undefined),
      updated_offline_at: now,
    };

    const cached = (await getCachedTable("stock_counts")) as unknown as StockCount[];
    await saveCachedTable("stock_counts", dedupeCounts([offlineCount, ...(Array.isArray(cached) ? cached : [])]));
    await savePending("stock_counts", offlineCount);

    if (payload.status === "completed") {
      await queueProductReconciliation(payload, id);
    }

    queryClient.setQueriesData({ queryKey: ["stock-counts"] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return dedupeCounts([offlineCount, ...old]);
    });

    await refreshCountQueries();
    return offlineCount;
  };

  const saveStockCount = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!productName.trim()) throw new Error("Product name is required");

      const payload = buildCountPayload();

      if (!canUseOnlineSupabase) {
        return await saveCountOffline(payload);
      }

      try {
        let savedCountId = editing?.id || null;

        if (editing && !String(editing.id).startsWith("offline-")) {
          const { data, error } = await withTimeout<any>(
            Promise.resolve(
              (supabase as any)
                .from("stock_counts")
                .update(cleanStockCountPayload(payload))
                .eq("id", editing.id)
                .eq("tenant_id", tenantId)
                .select("id")
                .single()
            ),
            "Stock count update timeout"
          );

          if (error) throw error;
          savedCountId = data?.id || editing.id;
        } else {
          const { data, error } = await withTimeout<any>(
            Promise.resolve(
              (supabase as any)
                .from("stock_counts")
                .insert(cleanStockCountPayload(payload))
                .select("id")
                .single()
            ),
            "Stock count save timeout"
          );

          if (error) throw error;
          savedCountId = data?.id || null;
        }

        if (payload.status === "completed" && selectedProduct) {
          const productStatus =
            countedQty <= 0
              ? "out_of_stock"
              : countedQty <= getProductMinStock(selectedProduct)
                ? "low_stock"
                : "active";

          const { error: productError } = await withTimeout<any>(
            Promise.resolve(
              (supabase as any)
                .from("products")
                .update({
                  stock: countedQty,
                  stock_quantity: countedQty,
                  status: productStatus,
                  updated_at: nowIso(),
                })
                .eq("id", selectedProduct.id)
                .eq("tenant_id", tenantId)
            ),
            "Product reconciliation timeout"
          );

          if (productError) throw productError;

          const { error: movementError } = await withTimeout<any>(
            Promise.resolve(
              (supabase as any)
                .from("stock_movements")
                .insert({
                  tenant_id: tenantId,
                  user_id: user?.id || null,
                  product_id: selectedProduct.id,
                  product_name: selectedProduct.name,
                  movement_type: "stock_count",
                  quantity_change: variancePreview,
                  stock_before: systemQty,
                  stock_after: countedQty,
                  reference: payload.count_no,
                  reference_id: savedCountId,
                  notes: payload.notes || "Stock count reconciliation",
                  created_at: nowIso(),
                })
            ),
            "Stock movement save timeout"
          );

          if (movementError) throw movementError;
        }

        const cached = (await getCachedTable("stock_counts")) as unknown as StockCount[];
        const savedCount = {
          ...(editing || {}),
          ...payload,
          id: savedCountId || editing?.id || makeLocalId("stock-count"),
          created_at: editing?.created_at || nowIso(),
          sync_status: "synced",
        } as StockCount;

        await saveCachedTable("stock_counts", dedupeCounts([savedCount, ...(Array.isArray(cached) ? cached : [])]));
        return savedCount;
      } catch (error) {
        if (isNetworkError(error) || !isOnline()) return await saveCountOffline(payload, { forceId: editing?.id });
        throw error;
      }
    },
    onSuccess: (data: any) => {
      refreshCountQueries();
      toast.success(
        data?.sync_status?.includes("pending")
          ? "Stock count saved offline. It will sync later."
          : editing
            ? "Stock count updated"
            : "Stock count created"
      );
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error?.message || error?.details || error?.hint || "Failed to save stock count");
    },
  });

  const deleteCount = useMutation({
    mutationFn: async (count: StockCount) => {
      if (!tenantId) throw new Error("No active workspace");
      const cached = (await getCachedTable("stock_counts")) as unknown as StockCount[];

      if (!canUseOnlineSupabase || String(count.id).startsWith("offline-")) {
        if (String(count.id).startsWith("offline-")) {
          await saveCachedTable("stock_counts", (Array.isArray(cached) ? cached : []).filter((row) => row.id !== count.id));
          return { sync_status: "removed" };
        }

        const deleted = {
          ...count,
          operation: "delete",
          sync_status: "pending_delete",
          status: "deleted",
          updated_offline_at: nowIso(),
        } as StockCount;

        await savePending("stock_counts", deleted);
        await saveCachedTable("stock_counts", (Array.isArray(cached) ? cached : []).map((row) => (row.id === count.id ? deleted : row)));
        return deleted;
      }

      try {
        const { error } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("stock_counts")
              .update({ status: "cancelled", updated_at: nowIso() })
              .eq("id", count.id)
              .eq("tenant_id", tenantId)
          ),
          "Stock count archive timeout"
        );

        if (error) throw error;

        await saveCachedTable("stock_counts", (Array.isArray(cached) ? cached : []).map((row) => row.id === count.id ? { ...row, status: "cancelled", updated_at: nowIso() } : row));
        return { sync_status: "synced", archived: true };
      } catch (error) {
        if (isNetworkError(error) || !isOnline()) {
          const deleted = {
            ...count,
            operation: "delete",
            sync_status: "pending_delete",
            status: "deleted",
            updated_offline_at: nowIso(),
          } as StockCount;

          await savePending("stock_counts", deleted);
          await saveCachedTable("stock_counts", (Array.isArray(cached) ? cached : []).map((row) => (row.id === count.id ? deleted : row)));
          return deleted;
        }

        throw error;
      }
    },
    onSuccess: (data: any) => {
      refreshCountQueries();
      setDeleteCountRow(null);
      toast.success(
        data?.sync_status === "pending_delete"
          ? "Stock count deletion saved offline."
          : data?.sync_status === "removed"
            ? "Offline stock count removed locally."
            : data?.archived ? "Stock count archived" : "Stock count deleted"
      );
    },
    onError: (error: any) => toast.error(error?.message || "Failed to delete stock count"),
  });

  const markCompleted = useMutation({
    mutationFn: async (count: StockCount) => {
      if (!tenantId) throw new Error("No active workspace");

      const product = cleanProducts.find((p) => p.id === count.product_id);
      const counted = safeNumber(count.counted_quantity);
      const system = safeNumber(count.system_quantity);
      const variance = counted - system;
      const patch = { ...count, status: "completed", variance, updated_at: nowIso() };

      if (!canUseOnlineSupabase || String(count.id).startsWith("offline-")) {
        await queueProductReconciliation(
          {
            ...patch,
            count_no: count.count_no || "Stock Count",
            counted_quantity: counted,
            system_quantity: system,
            product_name: count.product_name,
            product_id: count.product_id,
          },
          count.id
        );

        return await saveCountOffline(patch, { forceId: count.id });
      }

      try {
        const { error } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("stock_counts")
              .update({ status: "completed" })
              .eq("id", count.id)
              .eq("tenant_id", tenantId)
          ),
          "Stock count completion timeout"
        );

        if (error) throw error;

        if (product) {
          const productStatus =
            counted <= 0
              ? "out_of_stock"
              : counted <= getProductMinStock(product)
                ? "low_stock"
                : "active";

          const { error: productError } = await withTimeout<any>(
            Promise.resolve(
              (supabase as any)
                .from("products")
                .update({
                  stock: counted,
                  stock_quantity: counted,
                  status: productStatus,
                  updated_at: nowIso(),
                })
                .eq("id", product.id)
                .eq("tenant_id", tenantId)
            ),
            "Product reconciliation timeout"
          );

          if (productError) throw productError;

          const { error: movementError } = await withTimeout<any>(
            Promise.resolve(
              (supabase as any)
                .from("stock_movements")
                .insert({
                  tenant_id: tenantId,
                  user_id: user?.id || null,
                  product_id: product.id,
                  product_name: product.name,
                  movement_type: "stock_count",
                  quantity_change: variance,
                  stock_before: system,
                  stock_after: counted,
                  reference: count.count_no || "Stock Count",
                  reference_id: count.id,
                  notes: count.notes || "Stock count completed",
                  created_at: nowIso(),
                })
            ),
            "Stock movement save timeout"
          );

          if (movementError) throw movementError;
        }

        const cached = (await getCachedTable("stock_counts")) as unknown as StockCount[];
        await saveCachedTable(
          "stock_counts",
          dedupeCounts((Array.isArray(cached) ? cached : counts).map((row) => (row.id === count.id ? { ...row, status: "completed", variance } : row)))
        );

        return { sync_status: "synced" };
      } catch (error) {
        if (isNetworkError(error) || !isOnline()) {
          await queueProductReconciliation(
            {
              ...patch,
              count_no: count.count_no || "Stock Count",
              counted_quantity: counted,
              system_quantity: system,
              product_name: count.product_name,
              product_id: count.product_id,
            },
            count.id
          );
          return await saveCountOffline(patch, { forceId: count.id });
        }

        throw error;
      }
    },
    onSuccess: (data: any) => {
      refreshCountQueries();
      toast.success(data?.sync_status?.includes("pending") ? "Stock count completion queued offline." : "Stock count completed");
    },
    onError: (error: any) => toast.error(error?.message || "Failed to complete stock count"),
  });

  const openCreate = () => {
    setEditing(null);
    setCountNo(`SC-${Date.now().toString().slice(-8)}`);
    setSelectedProductId("");
    setProductName("");
    setLocation("");
    setSystemQuantity("");
    setCountedQuantity("");
    setStatus("active");
    setCountedBy(user?.email || "");
    setCountDate(todayIso());
    setNotes("");
    setDialogOpen(true);
  };

  const openEdit = (count: StockCount) => {
    setEditing(count);
    setCountNo(count.count_no || "");
    setSelectedProductId(count.product_id || "");
    setProductName(count.product_name || "");
    setLocation(count.location || "");
    setSystemQuantity(String(count.system_quantity || ""));
    setCountedQuantity(String(count.counted_quantity || ""));
    setStatus(count.status || "active");
    setCountedBy(count.counted_by || "");
    setCountDate(count.count_date || "");
    setNotes(count.notes || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleScan = (code: string) => {
    const product = cleanProducts.find((p) => p.barcode === code || p.sku === code);

    if (!product) {
      toast.error(`No product found for code: ${code}`);
      return;
    }

    setSelectedProductId(product.id);
    setProductName(product.name);
    setSystemQuantity(String(getProductStock(product)));
    setScannerOpen(false);
    toast.success(`Selected ${product.name}`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSmartFilter("all");
    setSyncFilter("all");
    setPage(1);
  };

  const printCountSheet = (count: StockCount) => {
    const printWindow = window.open("", "_blank", "width=1000,height=900");

    if (!printWindow) {
      toast.error("Popup blocked. Allow popups to print stock count sheet.");
      return;
    }

    const variance = getVariance(count);
    const risk = countRiskScore(count);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Count ${escapeHtml(count.count_no || "")}</title>
          <meta charset="utf-8" />
          <style>
            body { margin:0; background:#f3f4f6; font-family:Arial, sans-serif; color:#111827; }
            .page { width:210mm; min-height:297mm; margin:0 auto; background:#fff; padding:18mm; }
            .bar { height:8px; background:linear-gradient(90deg, #2563eb, #0891b2); margin:-18mm -18mm 16mm; }
            .header { display:flex; justify-content:space-between; border-bottom:2px solid #2563eb; padding-bottom:18px; }
            h1 { margin:0; color:#2563eb; letter-spacing:.04em; }
            .pill { display:inline-block; margin-top:10px; padding:7px 14px; border:2px solid #2563eb; border-radius:999px; color:#2563eb; font-weight:800; }
            .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-top:22px; }
            .card { border:1px solid #e5e7eb; border-radius:14px; padding:14px; background:#fbfdff; }
            .label { color:#6b7280; font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
            .value { font-weight:800; margin-top:5px; }
            table { width:100%; border-collapse:collapse; margin-top:24px; border:1px solid #e5e7eb; }
            th { background:#2563eb; color:white; text-align:left; padding:11px; text-transform:uppercase; font-size:11px; }
            td { border-top:1px solid #e5e7eb; padding:12px; }
            .signatures { display:grid; grid-template-columns:repeat(3, 1fr); gap:18px; margin-top:60px; }
            .sig { border-top:1px solid #111827; text-align:center; padding-top:8px; color:#4b5563; font-weight:700; }
            @page { size:A4; margin:0; }
            @media print { body { background:#fff; } .page { margin:0; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="bar"></div>
            <div class="header">
              <div>
                <h1>ShopCore Stock Count Sheet</h1>
                <p>Physical stock count and reconciliation document</p>
              </div>
              <div style="text-align:right;">
                <h1>STOCK COUNT</h1>
                <div class="pill">${escapeHtml(count.count_no || "SC")}</div>
              </div>
            </div>

            <div class="grid">
              <div class="card"><div class="label">Product</div><div class="value">${escapeHtml(count.product_name)}</div></div>
              <div class="card"><div class="label">Location</div><div class="value">${escapeHtml(count.location || "—")}</div></div>
              <div class="card"><div class="label">Status</div><div class="value">${escapeHtml(count.status || "active")}</div></div>
              <div class="card"><div class="label">System Qty</div><div class="value">${safeNumber(count.system_quantity).toLocaleString()}</div></div>
              <div class="card"><div class="label">Counted Qty</div><div class="value">${safeNumber(count.counted_quantity).toLocaleString()}</div></div>
              <div class="card"><div class="label">Variance</div><div class="value">${variance > 0 ? "+" : ""}${variance.toLocaleString()}</div></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Count Date</th>
                  <th>Counted By</th>
                  <th>Risk</th>
                  <th>Sync</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(formatDate(count.count_date))}</td>
                  <td>${escapeHtml(count.counted_by || "—")}</td>
                  <td>${escapeHtml(riskLabel(risk))}</td>
                  <td>${escapeHtml(isPendingSync(count) ? "Pending" : "Synced")}</td>
                  <td>${escapeHtml(formatDateTime(count.created_at || count.created_offline_at))}</td>
                </tr>
              </tbody>
            </table>

            <div class="card" style="margin-top:20px;">
              <div class="label">Notes</div>
              <div class="value">${escapeHtml(count.notes || "No notes recorded.")}</div>
            </div>

            <div class="signatures">
              <div class="sig">Counted By</div>
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

  const CountMenu = ({ count }: { count: StockCount }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewCount(count)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openEdit(count)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => printCountSheet(count)}>
          <FileText className="mr-2 h-4 w-4" />
          Print Sheet
        </DropdownMenuItem>
        {count.status !== "completed" && (
          <DropdownMenuItem onClick={() => markCompleted.mutate(count)}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Complete
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteCountRow(count)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const CountCard = ({ count }: { count: StockCount }) => {
    const variance = getVariance(count);
    const risk = countRiskScore(count);

    return (
      <div className="rounded-3xl border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md transition p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0" >
              <Package className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold truncate">{count.product_name}</h3>
              <p className="text-xs text-muted-foreground">
                {count.count_no || "-"} · {formatDate(count.count_date || count.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-1">
            <Badge variant="outline" className={`rounded-full capitalize ${statusClass(count.status)}`}>
              {count.status || "active"}
            </Badge>
            <CountMenu count={count} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">System</p>
            <p className="font-data font-bold text-base">{safeNumber(count.system_quantity).toLocaleString()}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Counted</p>
            <p className="font-data font-bold text-base">{safeNumber(count.counted_quantity).toLocaleString()}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Variance</p>
            <p className={`font-data font-bold text-base ${varianceClass(variance)}`}>
              {variance > 0 ? "+" : ""}{variance}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-muted/40 p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium truncate">{count.location || "No location"}</p>
            </div>

            <div className="min-w-0 text-right">
              <p className="text-xs text-muted-foreground">Risk</p>
              <Badge variant="outline" className={`rounded-full ${riskClass(risk)}`}>
                {riskLabel(risk)}
              </Badge>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Accuracy</span>
              <span>{variance === 0 ? "100%" : `${Math.max(0, 100 - Math.min(100, Math.round((Math.abs(variance) / Math.max(1, safeNumber(count.system_quantity))) * 100)))}%`}</span>
            </div>
            <Progress
              value={
                variance === 0
                  ? 100
                  : Math.max(0, 100 - Math.min(100, Math.round((Math.abs(variance) / Math.max(1, safeNumber(count.system_quantity))) * 100)))
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 rounded-2xl bg-muted/30 px-4 py-2 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{count.notes || "No notes"}</p>
          </div>

          <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => setViewCount(count)}>
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isPendingSync(count) ? <UploadCloud className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            {isPendingSync(count) ? "Pending sync" : count.counted_by || "No counter"}
          </div>

          {count.status !== "completed" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markCompleted.mutate(count)}
              disabled={markCompleted.isPending}
            >
              Complete
            </Button>
          )}
        </div>
      </div>
    );
  };

  const kpis = [
    {
      label: "Active Counts",
      value: stats.active,
      icon: ClipboardCheck,
      color: "bg-rose-600 text-white border-rose-500",
      helper: "open audits",
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
      color: "bg-emerald-600 text-white border-emerald-500",
      helper: "reconciled",
    },
    {
      label: "Accuracy",
      value: `${stats.accuracyRate}%`,
      icon: Target,
      color: "bg-orange-600 text-white border-orange-500",
      helper: "clean counts",
    },
    {
      label: "Audit Health",
      value: `${stats.auditHealth}%`,
      icon: Gauge,
      color: "bg-violet-600 text-white border-violet-500",
      helper: "readiness score",
    },
  ];

  return (
    <PageShell
      title="Stock Counts"
      description="Manage stock audits, variance control, barcode counting, reconciliation, offline count queues, product stock correction, and inventory accuracy."
    >
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-5">
          {(offlineModeActive || stats.pendingSync > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-3 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "Stock counts are using offline cache" : "Stock counts waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending count records: {stats.pendingSync}. Counts, reconciliations, product stock updates, and stock movements can be queued offline.
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

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-4">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-4 h-4" />
                </div>

                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/20 mb-2">
                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                    Inventory Audit Control
                  </Badge>
                  <h2 className="text-xl font-black tracking-tight">Stock Count Control Center</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Count physical stock, compare it with system quantities, review variance risk,
                    generate count sheets, and reconcile stock into product inventory records.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-4">
                    <div className="rounded-2xl border bg-muted/30 p-2.5">
                      <p className="text-xs text-muted-foreground">Workflow</p>
                      <p className="text-sm font-semibold">Count → Review → Complete</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-2.5">
                      <p className="text-xs text-muted-foreground">Net Variance</p>
                      <p className={`text-sm font-semibold font-data ${varianceClass(stats.netVariance)}`}>
                        {stats.netVariance > 0 ? "+" : ""}{stats.netVariance}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-2.5">
                      <p className="text-xs text-muted-foreground">Absolute Variance</p>
                      <p className="text-sm font-semibold font-data">{stats.absoluteVariance.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-2.5">
                      <p className="text-xs text-muted-foreground">Critical</p>
                      <p className="text-sm font-semibold font-data text-rose-600">{stats.critical}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 gap-2.5">
              {kpis.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className={`rounded-2xl border bg-card shadow-sm p-3 ${item.color}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">{item.label}</p>
                        <p className="text-xl font-black font-data mt-0.5">{item.value}</p>
                        <p className="text-[11px] opacity-70 truncate">{item.helper}</p>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
            {smartCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  setSmartFilter(card.key);
                  setPage(1);
                }}
                className={`rounded-2xl border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  smartFilter === card.key ? "ring-2 ring-blue-600" : ""
                }`}
              >
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="font-data text-lg font-black">{card.value}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Variance Summary</h3>
                  <p className="text-xs text-muted-foreground">Physical vs system differences</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between rounded-2xl bg-emerald-500/10 p-3">
                  <span className="text-sm text-muted-foreground">Positive Variance</span>
                  <span className="font-data font-semibold text-emerald-600">{stats.positiveVariance}</span>
                </div>

                <div className="flex justify-between rounded-2xl bg-rose-500/10 p-3">
                  <span className="text-sm text-muted-foreground">Negative Variance</span>
                  <span className="font-data font-semibold text-rose-600">{stats.negativeVariance}</span>
                </div>

                <div className="flex justify-between rounded-2xl bg-muted/50 p-3">
                  <span className="text-sm text-muted-foreground">Clean Counts</span>
                  <span className="font-data font-semibold">{stats.cleanCounts}</span>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-emerald-200 bg-emerald-50 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <PieChart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Count Accuracy</h3>
                  <p className="text-xs text-muted-foreground">Clean counts compared to variance cases</p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="relative h-36 w-36 rounded-full border-[16px] border-muted flex items-center justify-center">
                  <div
                    className="absolute inset-[-16px] rounded-full"
                    style={{
                      background: `conic-gradient(${CONTROL_BLUE} ${stats.accuracyRate * 3.6}deg, transparent 0deg)`,
                      mask: "radial-gradient(circle, transparent 54%, black 56%)",
                      WebkitMask: "radial-gradient(circle, transparent 54%, black 56%)",
                    }}
                  />
                  <div className="text-center">
                    <p className="font-data text-xl font-black">{stats.accuracyRate}%</p>
                    <p className="text-xs text-muted-foreground">Accuracy</p>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>Clean</span>
                      <span className="font-data">{stats.cleanCounts}</span>
                    </div>
                    <Progress value={stats.accuracyRate} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>Variance</span>
                      <span className="font-data">{stats.variances}</span>
                    </div>
                    <Progress value={stats.totalItems ? (stats.variances / stats.totalItems) * 100 : 0} />
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-orange-200 bg-orange-50 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Variance Trend</h3>
                  <p className="text-xs text-muted-foreground">Last audit variance intensity</p>
                </div>
              </div>

              <div className="flex h-32 items-end gap-2 rounded-2xl bg-muted/30 p-3">
                {stats.varianceTrend.length === 0 ? (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    No trend data yet.
                  </div>
                ) : (
                  stats.varianceTrend.map((row, index) => {
                    const max = Math.max(1, ...stats.varianceTrend.map((item) => item.variance));
                    const height = Math.max(8, (row.variance / max) * 100);

                    return (
                      <div key={`${row.label}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-t-xl bg-[#2563eb]"
                          style={{ height: `${height}%`, minHeight: 8 }}
                          title={`${row.label}: ${row.variance}`}
                        />
                        <span className="max-w-[44px] truncate text-[9px] text-muted-foreground">{row.label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 rounded-3xl border border-rose-200 bg-rose-50 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Highest Variance Alerts</h3>
                  <p className="text-xs text-muted-foreground">Items that need review before reconciliation</p>
                </div>
              </div>

              <div className="grid gap-3">
                {counts
                  .filter((count) => getVariance(count) !== 0)
                  .sort((a, b) => Math.abs(getVariance(b)) - Math.abs(getVariance(a)))
                  .slice(0, 5)
                  .map((count) => {
                    const variance = getVariance(count);
                    return (
                      <div key={count.id} className="rounded-2xl border bg-muted/30 p-2.5">
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{count.product_name}</p>
                            <p className="text-xs text-muted-foreground">{count.count_no || "-"} · {count.location || "No location"}</p>
                          </div>
                          <p className={`font-data font-bold ${varianceClass(variance)}`}>
                            {variance > 0 ? "+" : ""}{variance}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                {counts.filter((count) => getVariance(count) !== 0).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No variance alerts yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="xl:col-span-7 rounded-3xl border border-cyan-200 bg-cyan-50 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Location Variance Chart</h3>
                  <p className="text-xs text-muted-foreground">Top locations by absolute stock variance</p>
                </div>
              </div>

              <div className="space-y-3">
                {stats.locationBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">No location data yet.</p>
                ) : (
                  stats.locationBreakdown.map((row) => {
                    const max = Math.max(1, ...stats.locationBreakdown.map((item) => item.variance));
                    const percent = Math.round((row.variance / max) * 100);

                    return (
                      <div key={row.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="truncate">{row.name}</span>
                          <span className="font-data text-muted-foreground">
                            {row.counts} counts · {row.variance} variance
                          </span>
                        </div>
                        <Progress value={percent} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-3">
            <div className="flex flex-col xl:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-xl">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  placeholder="Search count number, product, SKU, location, quantity, counter, or notes..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger className="w-full xl:w-40 h-10 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={syncFilter} onValueChange={(value) => { setSyncFilter(value); setPage(1); }}>
                <SelectTrigger className="w-full xl:w-36 h-10 rounded-xl">
                  <SelectValue placeholder="Sync" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sync</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

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
                    className="rounded-lg h-8 px-2.5"
                    style={viewMode === mode.key ? { background: CONTROL_BLUE } : undefined}
                    onClick={() => setViewMode(mode.key)}
                  >
                    <mode.icon className="w-4 h-4 mr-1.5" />
                    {mode.label}
                  </Button>
                ))}
              </div>

              <Button variant="ghost" className="h-10 rounded-xl text-blue-700" onClick={resetFilters}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>

              <ExportMenu
                onCSV={() => exportToCSV(exportRows, "stock-counts", exportCols)}
                onPDF={() =>
                  exportToPDF(exportRows, "stock-counts", "Stock Counts Report", exportCols, {
                    subtitle: `${filteredCounts.length} stock count records`,
                    summary: [
                      { label: "Active Counts", value: String(stats.active) },
                      { label: "Completed", value: String(stats.completed) },
                      { label: "With Variance", value: String(stats.variances) },
                      { label: "Net Variance", value: String(stats.netVariance) },
                      { label: "Accuracy", value: `${stats.accuracyRate}%` },
                      { label: "Pending Sync", value: String(stats.pendingSync) },
                    ],
                  })
                }
              />

              <Button onClick={openCreate} className="h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                New Count
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-3xl border bg-card text-center py-12 text-muted-foreground">
              Loading stock counts...
            </div>
          ) : filteredCounts.length === 0 ? (
            <div className="rounded-3xl border bg-card py-10 text-center text-muted-foreground">
              <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No stock counts found
            </div>
          ) : viewMode === "list" ? (
            <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Count</th>
                      <th className="px-4 py-3 text-left font-medium">Product</th>
                      <th className="px-4 py-3 text-left font-medium">Location</th>
                      <th className="px-4 py-3 text-left font-medium">System</th>
                      <th className="px-4 py-3 text-left font-medium">Counted</th>
                      <th className="px-4 py-3 text-left font-medium">Variance</th>
                      <th className="px-4 py-3 text-left font-medium">Risk</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagedCounts.map((count) => {
                      const variance = getVariance(count);
                      const risk = countRiskScore(count);

                      return (
                        <tr key={count.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-semibold">{count.count_no || "—"}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(count.created_at || count.created_offline_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium truncate max-w-[240px]">{count.product_name}</p>
                            <p className="text-xs text-muted-foreground">{count.sku || "No SKU"}</p>
                          </td>
                          <td className="px-4 py-3">{count.location || "—"}</td>
                          <td className="px-4 py-3 font-data">{safeNumber(count.system_quantity).toLocaleString()}</td>
                          <td className="px-4 py-3 font-data">{safeNumber(count.counted_quantity).toLocaleString()}</td>
                          <td className={`px-4 py-3 font-data font-bold ${varianceClass(variance)}`}>
                            {variance > 0 ? "+" : ""}{variance}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`rounded-full ${riskClass(risk)}`}>
                              {riskLabel(risk)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`rounded-full ${statusClass(count.status)}`}>
                              {count.status || "active"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <CountMenu count={count} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : viewMode === "compact" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {pagedCounts.map((count) => {
                const variance = getVariance(count);
                return (
                  <div key={count.id} className="rounded-2xl border bg-card p-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{count.product_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{count.count_no || "—"} · {count.location || "No location"}</p>
                      </div>
                      <Badge variant="outline" className={`rounded-full ${varianceBadgeClass(variance)}`}>
                        {variance > 0 ? "+" : ""}{variance}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
              {pagedCounts.map((count) => (
                <CountCard key={count.id} count={count} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-3xl border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages} · {filteredCounts.length} counts
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  ‹
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 8).map((n) => (
                  <Button
                    key={n}
                    variant={n === currentPage ? "default" : "outline"}
                    size="icon"
                    className={`h-9 w-9 rounded-xl text-xs ${n === currentPage ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                  ›
                </Button>
              </div>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[95vw] max-w-4xl rounded-3xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Stock Count" : "New Stock Count"}</DialogTitle>
              <DialogDescription>
                Count physical stock, compare with system stock, preview variance, and reconcile differences.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Count No</label>
                  <Input
                    value={countNo}
                    onChange={(event) => setCountNo(event.target.value)}
                    placeholder="Auto-generated if empty"
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Product</label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedProductId}
                      onValueChange={(id) => {
                        const product = cleanProducts.find((item) => item.id === id);
                        setSelectedProductId(id);
                        setProductName(product?.name || "");
                        setSystemQuantity(String(getProductStock(product || {})));
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {cleanProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} · {product.sku || "No SKU"} · Stock: {getProductStock(product)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setScannerOpen(true)}>
                      <ScanBarcode className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Manual Product Name *</label>
                  <Input value={productName} onChange={(event) => setProductName(event.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Location</label>
                  <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Warehouse or branch" className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">System Quantity</label>
                  <Input type="number" value={systemQuantity} onChange={(event) => setSystemQuantity(event.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Counted Quantity</label>
                  <Input type="number" value={countedQuantity} onChange={(event) => setCountedQuantity(event.target.value)} className="rounded-xl" />
                </div>

                <div className="md:col-span-2 rounded-2xl border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Variance Preview</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">System Qty</p>
                      <p className="font-data font-semibold">{systemQty}</p>
                    </div>

                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">Counted Qty</p>
                      <p className="font-data font-semibold">{countedQty}</p>
                    </div>

                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">Variance</p>
                      <p className={`font-data font-semibold ${varianceClass(variancePreview)}`}>
                        {variancePreview > 0 ? "+" : ""}{variancePreview}
                      </p>
                    </div>

                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">Impact</p>
                      <p className="font-data font-semibold">{variancePreview === 0 ? "Clean" : "Review"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Counted By</label>
                  <Input value={countedBy} onChange={(event) => setCountedBy(event.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Count Date</label>
                  <Input type="date" value={countDate} onChange={(event) => setCountDate(event.target.value)} className="rounded-xl" />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[82px] rounded-xl" />
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => saveStockCount.mutate()} disabled={saveStockCount.isPending} className="bg-blue-600 text-white hover:bg-blue-700">
                {saveStockCount.isPending ? "Saving..." : editing ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewCount} onOpenChange={() => setViewCount(null)}>
          <DialogContent className="w-[95vw] max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{viewCount?.count_no || "Stock Count Details"}</DialogTitle>
              <DialogDescription>Count details, variance, risk, sync, and reconciliation status.</DialogDescription>
            </DialogHeader>

            {viewCount && (
              <div className="space-y-5">
                <div className="rounded-3xl border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-lg">{viewCount.product_name}</p>
                      <p className="text-sm text-muted-foreground">{viewCount.sku || "No SKU"} · {viewCount.location || "No location"}</p>
                    </div>
                    <Badge variant="outline" className={`rounded-full capitalize ${statusClass(viewCount.status)}`}>
                      {viewCount.status || "active"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    ["System Qty", safeNumber(viewCount.system_quantity).toLocaleString()],
                    ["Counted Qty", safeNumber(viewCount.counted_quantity).toLocaleString()],
                    ["Variance", `${getVariance(viewCount) > 0 ? "+" : ""}${getVariance(viewCount)}`],
                    ["Risk", riskLabel(countRiskScore(viewCount))],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ["Count Date", formatDate(viewCount.count_date)],
                    ["Counted By", viewCount.counted_by || "—"],
                    ["Created", formatDate(viewCount.created_at || viewCount.created_offline_at)],
                    ["Sync", isPendingSync(viewCount) ? "Pending" : "Synced"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium truncate">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1">{viewCount.notes || "No notes recorded."}</p>
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="outline" onClick={() => viewCount && printCountSheet(viewCount)}>
                <FileText className="w-4 h-4 mr-2" />
                Print Sheet
              </Button>
              <Button variant="outline" onClick={() => setViewCount(null)}>Close</Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  if (viewCount) openEdit(viewCount);
                  setViewCount(null);
                }}
              >
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteCountRow} onOpenChange={() => setDeleteCountRow(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Delete Stock Count</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteCountRow?.count_no || deleteCountRow?.product_name}"? Offline deletions will sync later.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteCountRow(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteCountRow && deleteCount.mutate(deleteCountRow)}
                disabled={deleteCount.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
      </PageBackground>
    </PageShell>
  );
}