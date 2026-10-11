import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Route,
  ScanBarcode,
  XCircle,
  UserCheck,
  ShieldCheck,
  UploadCloud,
  RotateCcw,
  Grid3X3,
  List,
  Eye,
  MoreHorizontal,
  FileText,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  LoadingState,
  type StatItem,
} from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { Textarea } from "@/components/ui/textarea";
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

const CONTROL_COLOR = "hsl(var(--primary))";
const PAGE_SIZE = 18;

interface Transfer {
  id: string;
  tenant_id: string;
  user_id: string | null;
  transfer_no: string | null;
  product_id?: string | null;
  product_name: string;
  sku?: string | null;
  quantity: number;
  from_location: string;
  to_location: string;
  status: string | null;
  requested_by: string | null;
  approved_by: string | null;
  transfer_date: string | null;
  expected_date: string | null;
  completed_date: string | null;
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
  | "pending"
  | "approved"
  | "in_transit"
  | "completed"
  | "cancelled"
  | "overdue"
  | "same_day"
  | "pending_sync";

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "in_transit", label: "In Transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

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

function withTimeout<T>(promise: Promise<T>, message = "Operation timed out", timeoutMs = 12000): Promise<T> {
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

function getTransferDate(transfer: any) {
  return (
    transfer?.updated_offline_at ||
    transfer?.updated_at ||
    transfer?.created_offline_at ||
    transfer?.created_at ||
    transfer?.transfer_date ||
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

function getProductStock(product: any) {
  return Math.max(0, safeNumber(product?.stock ?? product?.stock_quantity));
}

function getProductMinStock(product: any) {
  return Math.max(0, safeNumber(product?.min_stock ?? product?.min_stock_level ?? product?.reorder_level));
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

function isOverdue(transfer: Transfer) {
  if ((transfer.status || "pending") === "completed" || (transfer.status || "pending") === "cancelled") {
    return false;
  }
  if (!transfer.expected_date) return false;
  const today = new Date(todayIso()).getTime();
  const expected = new Date(transfer.expected_date).getTime();
  return expected < today;
}

function isSameDayRoute(transfer: Transfer) {
  return !!transfer.transfer_date && !!transfer.expected_date && transfer.transfer_date === transfer.expected_date;
}

function transferRiskScore(transfer: Transfer) {
  let score = 0;
  const status = transfer.status || "pending";

  if (isOverdue(transfer)) score += 35;
  if (status === "pending") score += 15;
  if (status === "cancelled") score += 20;
  if (!transfer.approved_by && ["approved", "in_transit", "completed"].includes(status)) score += 10;
  if (!transfer.transfer_no) score += 8;
  if (!transfer.from_location || !transfer.to_location) score += 25;
  if (transfer.from_location === transfer.to_location) score += 35;
  if (safeNumber(transfer.quantity) <= 0) score += 30;
  if (isPendingSync(transfer)) score += 8;

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

function dedupeTransfers(transfers: Transfer[]) {
  const map = new Map<string, Transfer>();

  for (const transfer of transfers || []) {
    const key = String(transfer.id || transfer.offline_id || transfer.transfer_no || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, transfer);
      continue;
    }

    const existingTime = new Date(getTransferDate(existing)).getTime();
    const incomingTime = new Date(getTransferDate(transfer)).getTime();

    map.set(
      key,
      incomingTime >= existingTime
        ? { ...existing, ...transfer }
        : { ...transfer, ...existing }
    );
  }

  return Array.from(map.values())
    .filter((transfer) => !isPendingDelete(transfer))
    .sort((a, b) => new Date(getTransferDate(b)).getTime() - new Date(getTransferDate(a)).getTime());
}

function statusClass(s: string | null) {
  switch (s || "pending") {
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "in_transit":
      return "bg-primary/10 text-muted-foreground border-primary/30";
    case "approved":
      return "bg-primary/10 text-muted-foreground border-primary/30";
    case "cancelled":
      return "bg-rose-500/10 text-rose-600 border-rose-500/30";
    default:
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  }
}

function statusIcon(s: string | null) {
  switch (s || "pending") {
    case "completed":
      return CheckCircle2;
    case "in_transit":
      return Truck;
    case "approved":
      return ShieldCheck;
    case "cancelled":
      return XCircle;
    default:
      return Clock;
  }
}

function statusLabel(s: string | null) {
  return String(s || "pending").replace(/_/g, " ");
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeTransferPayload(payload: any) {
  const clean = { ...payload };

  delete clean.id;
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

function sanitizeProductStockPatch(payload: any) {
  const clean = {
    id: payload.id,
    tenant_id: payload.tenant_id,
    user_id: payload.user_id ?? null,
    stock: safeNumber(payload.stock),
    stock_quantity: safeNumber(payload.stock_quantity ?? payload.stock),
    status: payload.status || "active",
    operation: payload.operation || "update",
    sync_status: payload.sync_status || "pending",
    updated_offline_at: payload.updated_offline_at || nowIso(),
  };

  return clean;
}

function shouldFallbackToOffline(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  const code = String((error as any)?.code || "").toLowerCase();

  return (
    !isOnline() ||
    isNetworkError(error) ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("jwt") ||
    message.includes("unauthorized") ||
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    code === "pgrst204" ||
    code === "42p01"
  );
}

function mergeProductsForCache(cachedProducts: any[], liveProducts: any[]) {
  const map = new Map<string, any>();
  [...(cachedProducts || []), ...(liveProducts || [])].forEach((product) => {
    const key = String(product?.id || product?.offline_id || product?.sku || product?.barcode || product?.name || Math.random());
    const existing = map.get(key);
    if (!existing) {
      map.set(key, product);
      return;
    }
    const existingTime = new Date(existing?.updated_offline_at || existing?.updated_at || existing?.created_at || 0).getTime();
    const nextTime = new Date(product?.updated_offline_at || product?.updated_at || product?.created_at || 0).getTime();
    map.set(key, nextTime >= existingTime ? { ...existing, ...product } : { ...product, ...existing });
  });
  return Array.from(map.values()).filter((product) => !isPendingDelete(product));
}

export default function Transfers() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editing, setEditing] = useState<Transfer | null>(null);
  const [viewTransfer, setViewTransfer] = useState<Transfer | null>(null);
  const [deleteTransferRow, setDeleteTransferRow] = useState<Transfer | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const [transferNo, setTransferNo] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [status, setStatus] = useState("pending");
  const [requestedBy, setRequestedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [notes, setNotes] = useState("");

  const offlineModeActive = !isOnline() || isOfflineMode() || !session?.access_token;
  const canUseOnlineSupabase = isOnline() && !!session?.access_token && !isOfflineMode();

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    };

    window.addEventListener("online", refresh);
    window.addEventListener("shopcore-local-data-changed", refresh);
    window.addEventListener("shopcore-offline-data-changed", refresh);
    window.addEventListener("shopcore-sync-completed", refresh);

    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("shopcore-local-data-changed", refresh);
      window.removeEventListener("shopcore-offline-data-changed", refresh);
      window.removeEventListener("shopcore-sync-completed", refresh);
    };
  }, [queryClient]);

  const cleanProducts = useMemo(
    () => (products as any[]).filter((p) => !isPendingDelete(p)),
    [products]
  );

  const selectedProduct = cleanProducts.find((p) => p.id === selectedProductId);

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["transfers", tenantId, offlineModeActive ? "offline" : "online"],
    enabled: !!user && !!tenantId,
    retry: offlineModeActive ? 0 : 1,
    refetchOnWindowFocus: !offlineModeActive,
    queryFn: async () => {
      if (offlineModeActive) {
        const cached = (await getCachedTable("transfers")) as unknown as Transfer[];
        return dedupeTransfers(cached);
      }

      try {
        const { data, error } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("transfers")
              .select("*")
              .eq("tenant_id", tenantId)
              .order("created_at", { ascending: false })
          ),
          "Loading transfers timed out",
          12000
        );

        if (error) throw error;

        const cleaned = dedupeTransfers((data || []) as Transfer[]);
        await saveCachedTable("transfers", cleaned);
        return cleaned;
      } catch (error) {
        const cached = (await getCachedTable("transfers")) as unknown as Transfer[];
        if (Array.isArray(cached) && cached.length > 0) return dedupeTransfers(cached);
        if (shouldFallbackToOffline(error)) return [] as Transfer[];
        throw error;
      }
    },
  });

  const filteredTransfers = useMemo(() => {
    const q = search.toLowerCase().trim();

    return transfers.filter((t) => {
      const matchesSearch =
        !q ||
        (t.transfer_no || "").toLowerCase().includes(q) ||
        (t.product_name || "").toLowerCase().includes(q) ||
        (t.sku || "").toLowerCase().includes(q) ||
        (t.from_location || "").toLowerCase().includes(q) ||
        (t.to_location || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q) ||
        String(t.quantity || "").includes(q);

      const currentStatus = t.status || "pending";
      const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;
      const pending = isPendingSync(t);

      const matchesSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      const matchesSmart =
        smartFilter === "all" ||
        (smartFilter === "pending" && currentStatus === "pending") ||
        (smartFilter === "approved" && currentStatus === "approved") ||
        (smartFilter === "in_transit" && currentStatus === "in_transit") ||
        (smartFilter === "completed" && currentStatus === "completed") ||
        (smartFilter === "cancelled" && currentStatus === "cancelled") ||
        (smartFilter === "overdue" && isOverdue(t)) ||
        (smartFilter === "same_day" && isSameDayRoute(t)) ||
        (smartFilter === "pending_sync" && pending);

      return matchesSearch && matchesStatus && matchesSync && matchesSmart;
    });
  }, [transfers, search, statusFilter, syncFilter, smartFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTransfers = filteredTransfers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const now = new Date();

    const thisMonth = transfers.filter((t) => {
      const d = new Date(t.created_at || t.created_offline_at || 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const inTransit = transfers.filter((t) => t.status === "in_transit").length;
    const pending = transfers.filter((t) => (t.status || "pending") === "pending").length;
    const approved = transfers.filter((t) => t.status === "approved").length;
    const completed = transfers.filter((t) => t.status === "completed").length;
    const cancelled = transfers.filter((t) => t.status === "cancelled").length;
    const totalQuantity = transfers.reduce((sum, t) => sum + safeNumber(t.quantity), 0);
    const pendingSync = transfers.filter(isPendingSync).length;
    const overdue = transfers.filter(isOverdue).length;
    const sameDay = transfers.filter(isSameDayRoute).length;
    const risky = transfers.filter((t) => transferRiskScore(t) >= 15).length;
    const critical = transfers.filter((t) => transferRiskScore(t) >= 70).length;
    const transferHealth = transfers.length
      ? Math.max(0, Math.min(100, Math.round(100 - overdue * 6 - pending * 2 - cancelled * 3 - pendingSync * 2 - critical * 10)))
      : 100;

    const locationMap = new Map<string, number>();
    transfers.forEach((t) => {
      if (t.from_location) locationMap.set(t.from_location, (locationMap.get(t.from_location) || 0) + 1);
      if (t.to_location) locationMap.set(t.to_location, (locationMap.get(t.to_location) || 0) + 1);
    });

    const topLocations = Array.from(locationMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      inTransit,
      pending,
      completed,
      thisMonth: thisMonth.length,
      approved,
      cancelled,
      totalQuantity,
      pendingSync,
      overdue,
      sameDay,
      risky,
      critical,
      transferHealth,
      topLocations,
      total: transfers.length,
    };
  }, [transfers]);

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: stats.total, icon: ArrowLeftRight },
    { key: "pending" as SmartFilter, label: "Pending", value: stats.pending, icon: Clock },
    { key: "approved" as SmartFilter, label: "Approved", value: stats.approved, icon: ShieldCheck },
    { key: "in_transit" as SmartFilter, label: "In Transit", value: stats.inTransit, icon: Truck },
    { key: "completed" as SmartFilter, label: "Completed", value: stats.completed, icon: CheckCircle2 },
    { key: "cancelled" as SmartFilter, label: "Cancelled", value: stats.cancelled, icon: XCircle },
    { key: "overdue" as SmartFilter, label: "Overdue", value: stats.overdue, icon: AlertTriangle },
    { key: "pending_sync" as SmartFilter, label: "Pending Sync", value: stats.pendingSync, icon: UploadCloud },
  ];

  const exportRows = filteredTransfers.map((t) => ({
    transfer_no: t.transfer_no || "",
    product: t.product_name || "",
    sku: t.sku || "",
    quantity: safeNumber(t.quantity),
    from_location: t.from_location || "",
    to_location: t.to_location || "",
    status: statusLabel(t.status),
    requested_by: t.requested_by || "",
    approved_by: t.approved_by || "",
    transfer_date: t.transfer_date || "",
    expected_date: t.expected_date || "",
    completed_date: t.completed_date || "",
    risk: riskLabel(transferRiskScore(t)),
    sync: isPendingSync(t) ? "Pending" : "Synced",
  }));

  const exportCols = [
    { key: "transfer_no" as const, label: "Transfer No" },
    { key: "product" as const, label: "Product" },
    { key: "sku" as const, label: "SKU" },
    { key: "quantity" as const, label: "Quantity" },
    { key: "from_location" as const, label: "From" },
    { key: "to_location" as const, label: "To" },
    { key: "status" as const, label: "Status" },
    { key: "requested_by" as const, label: "Requested By" },
    { key: "approved_by" as const, label: "Approved By" },
    { key: "transfer_date" as const, label: "Transfer Date" },
    { key: "expected_date" as const, label: "Expected Date" },
    { key: "completed_date" as const, label: "Completed Date" },
    { key: "risk" as const, label: "Risk" },
    { key: "sync" as const, label: "Sync" },
  ];

  const refreshTransferQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transfers"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const buildTransferPayload = () => {
    const selected = selectedProduct || cleanProducts.find((p) => p.name === productName);

    return {
      tenant_id: tenantId,
      user_id: user?.id || null,
      transfer_no: transferNo.trim() || `TR-${Date.now()}`,
      product_id: selected?.id || selectedProductId || null,
      product_name: productName.trim(),
      sku: selected?.sku || "",
      quantity: safeNumber(quantity),
      from_location: fromLocation.trim(),
      to_location: toLocation.trim(),
      status: status || "pending",
      requested_by: requestedBy.trim() || user?.email || null,
      approved_by: approvedBy.trim() || null,
      transfer_date: transferDate || todayIso(),
      expected_date: expectedDate || null,
      completed_date:
        status === "completed"
          ? completedDate || todayIso()
          : completedDate || null,
      notes: notes.trim() || null,
    };
  };

  const saveTransferOffline = async (payload: any, options: { forceId?: string } = {}) => {
    if (!tenantId) throw new Error("No active workspace");

    const now = nowIso();
    const id = options.forceId || editing?.id || makeLocalId("offline-transfer");
    const operation = String(id).startsWith("offline-") ? "create" : editing || options.forceId ? "update" : "create";

    const offlineTransfer: Transfer = {
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

    const cached = (await getCachedTable("transfers")) as unknown as Transfer[];
    await saveCachedTable("transfers", dedupeTransfers([offlineTransfer, ...(Array.isArray(cached) ? cached : [])]));
    await savePending("transfers", offlineTransfer);

    queryClient.setQueriesData({ queryKey: ["transfers"] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return dedupeTransfers([offlineTransfer, ...old]);
    });

    await refreshTransferQueries();
    return offlineTransfer;
  };

  const applyCompletedTransferLocalStock = async (transfer: Transfer) => {
    const qty = safeNumber(transfer.quantity);
    if (qty <= 0) return;

    const productId = transfer.product_id || cleanProducts.find((p) => p.name === transfer.product_name)?.id;
    if (!productId) return;

    const now = nowIso();
    const cachedProducts = await getCachedProducts();
    const productsForCache = mergeProductsForCache(cachedProducts, cleanProducts);
    const currentProduct = productsForCache.find((product: any) => String(product.id) === String(productId));

    if (!currentProduct) return;

    const currentStock = getProductStock(currentProduct);
    const minStock = getProductMinStock(currentProduct);
    const nextStock = Math.max(0, currentStock - qty);
    const nextStatus = nextStock <= 0 ? "out_of_stock" : minStock > 0 && nextStock <= minStock ? "low_stock" : "active";

    const changedProduct = {
      ...currentProduct,
      stock: nextStock,
      stock_quantity: nextStock,
      status: nextStatus,
      updated_at: now,
      updated_offline_at: now,
      sync_status: canUseOnlineSupabase ? "synced" : "pending_update",
    };

    const movementRow = {
      id: makeLocalId("offline-transfer-movement"),
      tenant_id: tenantId,
      user_id: user?.id || transfer.user_id || null,
      product_id: productId,
      product_name: transfer.product_name || currentProduct.name || "Unknown Product",
      movement_type: "transfer_out",
      quantity_change: -qty,
      stock_before: currentStock,
      stock_after: nextStock,
      reference: transfer.transfer_no || transfer.id,
      reference_id: transfer.id,
      notes: `Transfer ${transfer.transfer_no || transfer.id}: ${transfer.from_location} to ${transfer.to_location}`,
      created_at: now,
      created_offline_at: canUseOnlineSupabase ? undefined : now,
      sync_status: canUseOnlineSupabase ? "synced" : "pending",
      operation: canUseOnlineSupabase ? undefined : "create",
    };

    if (canUseOnlineSupabase && !String(productId).startsWith("offline-")) {
      try {
        const { error: productError } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("products")
              .update({
                stock: nextStock,
                stock_quantity: nextStock,
                status: nextStatus,
              })
              .eq("id", productId)
              .eq("tenant_id", tenantId)
          ),
          "Updating product stock timed out",
          12000
        );

        if (productError) throw productError;

        const { error: movementError } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("stock_movements")
              .insert(sanitizeTransferPayload(movementRow))
          ),
          "Creating transfer stock movement timed out",
          12000
        );

        if (movementError) throw movementError;
      } catch (error) {
        if (!shouldFallbackToOffline(error)) throw error;

        await savePending(
          "products",
          sanitizeProductStockPatch({
            id: productId,
            tenant_id: tenantId,
            user_id: user?.id || null,
            operation: "update",
            stock: nextStock,
            stock_quantity: nextStock,
            status: nextStatus,
            sync_status: "pending",
            updated_offline_at: now,
          })
        );

        await savePending("stock_movements", {
          ...movementRow,
          sync_status: "pending",
          operation: "create",
          created_offline_at: now,
        });
      }
    } else {
      await savePending(
        "products",
        sanitizeProductStockPatch({
          id: productId,
          tenant_id: tenantId,
          user_id: user?.id || null,
          operation: "update",
          stock: nextStock,
          stock_quantity: nextStock,
          status: nextStatus,
          sync_status: "pending",
          updated_offline_at: now,
        })
      );

      await savePending("stock_movements", {
        ...movementRow,
        sync_status: "pending",
        operation: "create",
        created_offline_at: now,
      });
    }

    const updatedProducts = productsForCache.map((product: any) =>
      String(product.id) === String(productId) ? changedProduct : product
    );

    await saveCachedProducts(updatedProducts);

    const cachedMovements = await getCachedTable("stock_movements");
    await saveCachedTable("stock_movements", [
      movementRow,
      ...(Array.isArray(cachedMovements) ? cachedMovements : []),
    ]);

    queryClient.setQueriesData({ queryKey: ["products"] }, (old: any) => {
      if (!Array.isArray(old)) return updatedProducts;
      return old.map((product: any) => String(product.id) === String(productId) ? changedProduct : product);
    });

    queryClient.setQueriesData({ queryKey: ["stock_movements"] }, (old: any) => {
      if (!Array.isArray(old)) return [movementRow];
      return [movementRow, ...old];
    });

    window.dispatchEvent(new CustomEvent("shopcore-offline-data-changed", { detail: { table: "transfers" } }));
  };

  const createTransfer = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!productName.trim()) throw new Error("Product name is required");
      if (!fromLocation.trim()) throw new Error("From location is required");
      if (!toLocation.trim()) throw new Error("To location is required");
      if (fromLocation.trim() === toLocation.trim()) throw new Error("From and To locations cannot be the same");
      if (safeNumber(quantity) <= 0) throw new Error("Quantity must be greater than zero");

      const payload = buildTransferPayload();

      if (!canUseOnlineSupabase) {
        return await saveTransferOffline(payload);
      }

      try {
        const { data, error } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("transfers")
              .insert(sanitizeTransferPayload(payload))
              .select()
              .single()
          ),
          "Creating transfer timed out",
          12000
        );

        if (error) throw error;

        const cached = (await getCachedTable("transfers")) as unknown as Transfer[];
        await saveCachedTable("transfers", dedupeTransfers([data as Transfer, ...(Array.isArray(cached) ? cached : [])]));

        return data as Transfer;
      } catch (error) {
        if (isNetworkError(error) || !isOnline()) return await saveTransferOffline(payload);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      refreshTransferQueries();
      toast.success(data?.sync_status?.includes("pending") ? "Transfer saved locally and will sync when connection is ready." : "Transfer created");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTransfer = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!editing) throw new Error("No transfer selected");
      if (!productName.trim()) throw new Error("Product name is required");
      if (!fromLocation.trim()) throw new Error("From location is required");
      if (!toLocation.trim()) throw new Error("To location is required");
      if (fromLocation.trim() === toLocation.trim()) throw new Error("From and To locations cannot be the same");
      if (safeNumber(quantity) <= 0) throw new Error("Quantity must be greater than zero");

      const payload = buildTransferPayload();

      if (!canUseOnlineSupabase || String(editing.id).startsWith("offline-")) {
        return await saveTransferOffline(payload, { forceId: editing.id });
      }

      try {
        const { error } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("transfers")
              .update(sanitizeTransferPayload(payload))
              .eq("id", editing.id)
              .eq("tenant_id", tenantId)
          ),
          "Updating transfer timed out",
          12000
        );

        if (error) throw error;

        const updated = { ...editing, ...payload, updated_at: nowIso(), sync_status: "synced" } as Transfer;
        const cached = (await getCachedTable("transfers")) as unknown as Transfer[];
        await saveCachedTable(
          "transfers",
          dedupeTransfers((Array.isArray(cached) ? cached : transfers).map((row) => (row.id === editing.id ? updated : row)))
        );

        return updated;
      } catch (error) {
        if (isNetworkError(error) || !isOnline()) return await saveTransferOffline(payload, { forceId: editing.id });
        throw error;
      }
    },
    onSuccess: (data: any) => {
      refreshTransferQueries();
      toast.success(data?.sync_status?.includes("pending") ? "Transfer update saved locally." : "Transfer updated");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickStatusUpdate = useMutation({
    mutationFn: async ({ transfer, newStatus }: { transfer: Transfer; newStatus: string }) => {
      if (!tenantId) throw new Error("No active workspace");

      const patch: Record<string, any> = {
        status: newStatus,
        approved_by:
          newStatus === "approved" && !transfer.approved_by
            ? user?.email || transfer.requested_by || null
            : transfer.approved_by,
      };

      if (newStatus === "completed") patch.completed_date = todayIso();

      const updatedTransfer = { ...transfer, ...patch, updated_at: nowIso() } as Transfer;

      if (!canUseOnlineSupabase || String(transfer.id).startsWith("offline-")) {
        if (newStatus === "completed") await applyCompletedTransferLocalStock(updatedTransfer);
        return await saveTransferOffline(updatedTransfer, { forceId: transfer.id });
      }

      try {
        const { error } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("transfers")
              .update(sanitizeTransferPayload(patch))
              .eq("id", transfer.id)
              .eq("tenant_id", tenantId)
          ),
          "Updating transfer status timed out",
          12000
        );

        if (error) throw error;

        if (newStatus === "completed") {
          await applyCompletedTransferLocalStock(updatedTransfer);
        }

        const cached = (await getCachedTable("transfers")) as unknown as Transfer[];
        await saveCachedTable(
          "transfers",
          dedupeTransfers((Array.isArray(cached) ? cached : transfers).map((row) => (row.id === transfer.id ? updatedTransfer : row)))
        );

        return updatedTransfer;
      } catch (error) {
        if (shouldFallbackToOffline(error)) {
          if (newStatus === "completed") await applyCompletedTransferLocalStock(updatedTransfer);
          return await saveTransferOffline(updatedTransfer, { forceId: transfer.id });
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      refreshTransferQueries();
      toast.success(data?.sync_status?.includes("pending") ? "Transfer status saved locally." : "Transfer status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTransfer = useMutation({
    mutationFn: async (transfer: Transfer) => {
      if (!tenantId) throw new Error("No active workspace");

      const cached = (await getCachedTable("transfers")) as unknown as Transfer[];

      if (!canUseOnlineSupabase || String(transfer.id).startsWith("offline-")) {
        if (String(transfer.id).startsWith("offline-")) {
          await saveCachedTable("transfers", (Array.isArray(cached) ? cached : []).filter((row) => row.id !== transfer.id));
          return { sync_status: "removed" };
        }

        const deleted = {
          ...transfer,
          operation: "delete",
          sync_status: "pending_delete",
          status: "deleted",
          updated_offline_at: nowIso(),
        } as Transfer;

        await savePending("transfers", deleted);
        await saveCachedTable("transfers", (Array.isArray(cached) ? cached : []).map((row) => (row.id === transfer.id ? deleted : row)));
        return deleted;
      }

      try {
        const { error } = await withTimeout<any>(
          Promise.resolve(
            (supabase as any)
              .from("transfers")
              .delete()
              .eq("id", transfer.id)
              .eq("tenant_id", tenantId)
          ),
          "Deleting transfer timed out",
          12000
        );

        if (error) throw error;

        await saveCachedTable("transfers", (Array.isArray(cached) ? cached : []).filter((row) => row.id !== transfer.id));
        return { sync_status: "synced" };
      } catch (error) {
        if (shouldFallbackToOffline(error)) {
          const deleted = {
            ...transfer,
            operation: "delete",
            sync_status: "pending_delete",
            status: "deleted",
            updated_offline_at: nowIso(),
          } as Transfer;
          await savePending("transfers", deleted);
          await saveCachedTable("transfers", (Array.isArray(cached) ? cached : []).map((row) => (row.id === transfer.id ? deleted : row)));
          return deleted;
        }

        throw error;
      }
    },
    onSuccess: (data: any) => {
      refreshTransferQueries();
      setDeleteTransferRow(null);
      toast.success(
        data?.sync_status === "pending_delete"
          ? "Transfer deletion saved locally."
          : data?.sync_status === "removed"
          ? "Local transfer removed."
          : "Transfer deleted"
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setTransferNo(`TR-${Date.now().toString().slice(-8)}`);
    setSelectedProductId("");
    setProductName("");
    setQuantity("");
    setFromLocation("");
    setToLocation("");
    setStatus("pending");
    setRequestedBy(user?.email || "");
    setApprovedBy("");
    setTransferDate(todayIso());
    setExpectedDate("");
    setCompletedDate("");
    setNotes("");
    setDialogOpen(true);
  };

  const openEdit = (transfer: Transfer) => {
    setEditing(transfer);
    setTransferNo(transfer.transfer_no || "");
    setSelectedProductId(transfer.product_id || "");
    setProductName(transfer.product_name || "");
    setQuantity(String(transfer.quantity || ""));
    setFromLocation(transfer.from_location || "");
    setToLocation(transfer.to_location || "");
    setStatus(transfer.status || "pending");
    setRequestedBy(transfer.requested_by || "");
    setApprovedBy(transfer.approved_by || "");
    setTransferDate(transfer.transfer_date || "");
    setExpectedDate(transfer.expected_date || "");
    setCompletedDate(transfer.completed_date || "");
    setNotes(transfer.notes || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (editing) updateTransfer.mutate();
    else createTransfer.mutate();
  };

  const handleScan = (code: string) => {
    const product = cleanProducts.find((p) => p.barcode === code || p.sku === code);

    if (!product) {
      toast.error(`No product found for code: ${code}`);
      return;
    }

    setSelectedProductId(product.id);
    setProductName(product.name);
    setScannerOpen(false);
    toast.success(`Selected ${product.name}`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSyncFilter("all");
    setSmartFilter("all");
    setPage(1);
  };

  const printTransferNote = (transfer: Transfer) => {
    const printWindow = window.open("", "_blank", "width=1000,height=900");
    if (!printWindow) {
      toast.error("Popup blocked. Allow popups to print transfer note.");
      return;
    }

    const risk = transferRiskScore(transfer);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transfer Note ${escapeHtml(transfer.transfer_no || "")}</title>
          <meta charset="utf-8" />
          <style>
            body { margin: 0; background: #f3f4f6; font-family: Arial, sans-serif; color: #111827; }
            .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 18mm; }
            .bar { height: 8px; background: #2563EB; margin: -18mm -18mm 16mm; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563EB; padding-bottom: 18px; }
            h1 { margin: 0; color: #2563EB; letter-spacing: 0.04em; }
            .pill { display: inline-block; margin-top: 10px; padding: 7px 14px; border: 2px solid #2563EB; border-radius: 999px; color: #2563EB; font-weight: 800; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 22px; }
            .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; background: #fbfdff; }
            .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            .value { font-weight: 800; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; border: 1px solid #e5e7eb; }
            th { background: #2563EB; color: white; text-align: left; padding: 11px; text-transform: uppercase; font-size: 11px; }
            td { border-top: 1px solid #e5e7eb; padding: 12px; }
            .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 60px; }
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
                <h1>ShopCore Transfer Note</h1>
                <p>Internal stock movement document</p>
              </div>
              <div style="text-align:right;">
                <h1>TRANSFER</h1>
                <div class="pill">${escapeHtml(transfer.transfer_no || "TR")}</div>
              </div>
            </div>

            <div class="grid">
              <div class="card"><div class="label">Status</div><div class="value">${escapeHtml(statusLabel(transfer.status))}</div></div>
              <div class="card"><div class="label">Risk</div><div class="value">${escapeHtml(riskLabel(risk))}</div></div>
              <div class="card"><div class="label">Quantity</div><div class="value">${safeNumber(transfer.quantity).toLocaleString()}</div></div>
              <div class="card"><div class="label">From</div><div class="value">${escapeHtml(transfer.from_location)}</div></div>
              <div class="card"><div class="label">To</div><div class="value">${escapeHtml(transfer.to_location)}</div></div>
              <div class="card"><div class="label">Expected</div><div class="value">${escapeHtml(formatDate(transfer.expected_date))}</div></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Transfer Date</th>
                  <th>Completed</th>
                  <th>Requested By</th>
                  <th>Approved By</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(transfer.product_name)}</td>
                  <td>${escapeHtml(transfer.sku || "—")}</td>
                  <td>${escapeHtml(formatDate(transfer.transfer_date))}</td>
                  <td>${escapeHtml(formatDate(transfer.completed_date))}</td>
                  <td>${escapeHtml(transfer.requested_by || "—")}</td>
                  <td>${escapeHtml(transfer.approved_by || "—")}</td>
                </tr>
              </tbody>
            </table>

            <div class="card" style="margin-top: 20px;">
              <div class="label">Notes</div>
              <div class="value">${escapeHtml(transfer.notes || "No notes recorded.")}</div>
            </div>

            <div class="signatures">
              <div class="sig">Prepared By</div>
              <div class="sig">Dispatched By</div>
              <div class="sig">Received By</div>
            </div>
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 350);</script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const TransferMenu = ({ transfer }: { transfer: Transfer }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewTransfer(transfer)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openEdit(transfer)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => printTransferNote(transfer)}>
          <FileText className="mr-2 h-4 w-4" />
          Print Note
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTransferRow(transfer)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const TransferCard = ({ transfer }: { transfer: Transfer }) => {
    const StatusIcon = statusIcon(transfer.status);
    const risk = transferRiskScore(transfer);
    const currentStatus = transfer.status || "pending";

    return (
      <div className="rounded-3xl border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md transition p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold truncate">{transfer.product_name}</h3>
              <p className="text-xs text-muted-foreground">
                {transfer.transfer_no || "-"} · {formatDate(transfer.transfer_date || transfer.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-1">
            <Badge variant="outline" className={`rounded-full capitalize ${statusClass(transfer.status)}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusLabel(transfer.status)}
            </Badge>
            <TransferMenu transfer={transfer} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Quantity</p>
            <p className="font-data font-bold text-lg">{safeNumber(transfer.quantity).toLocaleString()}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Expected</p>
            <p className={`font-data font-semibold text-sm ${isOverdue(transfer) ? "text-rose-600" : ""}`}>
              {transfer.expected_date || "Not set"}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Risk</p>
            <Badge variant="outline" className={`rounded-full ${riskClass(risk)}`}>
              {riskLabel(risk)}
            </Badge>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="font-medium truncate">{transfer.from_location}</p>
            </div>

            <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0" />

            <div className="min-w-0 text-right">
              <p className="text-xs text-muted-foreground">To</p>
              <p className="font-medium truncate">{transfer.to_location}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 rounded-2xl border border-border bg-muted/40 px-4 py-2 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{transfer.notes || "No notes"}</p>
          </div>

          <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => setViewTransfer(transfer)}>
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isPendingSync(transfer) ? <UploadCloud className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            {isPendingSync(transfer) ? "Pending sync" : transfer.requested_by || "No requester"}
          </div>

          <div className="flex gap-1">
            {currentStatus === "pending" && (
              <Button
                size="sm"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary"
                onClick={() => quickStatusUpdate.mutate({ transfer, newStatus: "approved" })}
                disabled={quickStatusUpdate.isPending}
              >
                Approve
              </Button>
            )}

            {currentStatus === "approved" && (
              <Button
                size="sm"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary"
                onClick={() => quickStatusUpdate.mutate({ transfer, newStatus: "in_transit" })}
                disabled={quickStatusUpdate.isPending}
              >
                Dispatch
              </Button>
            )}

            {currentStatus === "in_transit" && (
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => quickStatusUpdate.mutate({ transfer, newStatus: "completed" })}
                disabled={quickStatusUpdate.isPending}
              >
                Receive
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const statCards: StatItem[] = [
    { label: "Transfers", value: stats.total, icon: ArrowLeftRight, tone: "indigo", helper: "all records" },
    {
      label: "In Transit",
      value: stats.inTransit,
      icon: Truck,
      tone: stats.inTransit > 0 ? "amber" : "cyan",
      helper: "moving now",
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: Clock,
      tone: stats.pending > 0 ? "amber" : "sky",
      helper: "awaiting approval",
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
      tone: "emerald",
      helper: "received transfers",
    },
    {
      label: "Health",
      value: `${stats.transferHealth}%`,
      icon: Gauge,
      tone: stats.transferHealth >= 70 ? "teal" : "amber",
      helper: "workflow quality",
    },
  ];


  return (
    <PageShell
      title="Transfers"
      description="Move stock between branches and warehouses, with approval, dispatch and receiving in one trail."
    >
      <PageBackground image={warehouseBg} opacity={0}>
        <PageContainer>
          <PageToolbar>
            <div className="flex rounded-2xl border bg-muted/40 p-1">
              {[
                { key: "grid" as ViewMode, label: "Grid", icon: Grid3X3 },
                { key: "list" as ViewMode, label: "List", icon: List },
                { key: "compact" as ViewMode, label: "Compact", icon: ArrowLeftRight },
              ].map((mode) => (
                <Button
                  key={mode.key}
                  type="button"
                  size="sm"
                  variant={viewMode === mode.key ? "default" : "ghost"}
                  className={`rounded-xl h-9 px-3 ${viewMode === mode.key ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
                  onClick={() => setViewMode(mode.key)}
                >
                  <mode.icon className="w-4 h-4 mr-1.5" />
                  {mode.label}
                </Button>
              ))}
            </div>

            <Button variant="ghost" className="h-9 rounded-xl text-foreground" onClick={resetFilters}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>

            <ExportMenu
              onCSV={() => exportToCSV(exportRows, "transfers", exportCols)}
              onPDF={() =>
                exportToPDF(exportRows, "transfers", "Transfers Report", exportCols, {
                  subtitle: `${filteredTransfers.length} transfer records`,
                  summary: [
                    { label: "Total Transfers", value: String(stats.total) },
                    { label: "Pending", value: String(stats.pending) },
                    { label: "In Transit", value: String(stats.inTransit) },
                    { label: "Completed", value: String(stats.completed) },
                    { label: "Overdue", value: String(stats.overdue) },
                    { label: "Pending Sync", value: String(stats.pendingSync) },
                  ],
                })
              }
            />

            <Button onClick={openCreate} className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary">
              <Plus className="w-4 h-4 mr-2" />
              New Transfer
            </Button>
          </PageToolbar>


          <StatGrid items={statCards} columns={5} />

          <SectionCard
            icon={ArrowLeftRight}
            title="Transfer Register"
            description="Search and manage stock moving between locations in this workspace."
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

            <div className="flex flex-col gap-3 xl:flex-row">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 border border-border bg-muted/40 rounded-2xl">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search transfer number, product, SKU, route, quantity, or notes..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full xl:w-48 h-12 rounded-2xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={syncFilter} onValueChange={(value) => { setSyncFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full xl:w-40 h-12 rounded-2xl">
                <SelectValue placeholder="Sync" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sync</SelectItem>
                <SelectItem value="synced">Synced</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            </div>

            {isLoading ? (
            <LoadingState label="Loading transfers..." />
            ) : filteredTransfers.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="No transfers found"
              description="Create a transfer to move stock between branches or warehouses."
            />
            ) : viewMode === "list" ? (
              <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table" style={{ minWidth: 1100 }}>
                    <thead>
                      <tr>
                        <th>Transfer</th>
                        <th>Product</th>
                        <th>Route</th>
                        <th>Qty</th>
                        <th>Expected</th>
                        <th>Status</th>
                        <th>Risk</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedTransfers.map((transfer) => {
                        const StatusIcon = statusIcon(transfer.status);
                        const risk = transferRiskScore(transfer);

                        return (
                          <tr key={transfer.id}>
                            <td>
                              <p className="font-semibold">{transfer.transfer_no || "—"}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(transfer.created_at || transfer.created_offline_at)}</p>
                            </td>
                            <td>
                              <p className="font-medium truncate max-w-[220px]">{transfer.product_name}</p>
                              <p className="text-xs text-muted-foreground">{transfer.sku || "No SKU"}</p>
                            </td>
                            <td>
                              <p className="truncate max-w-[280px]">{transfer.from_location} → {transfer.to_location}</p>
                            </td>
                            <td className="font-data">{safeNumber(transfer.quantity).toLocaleString()}</td>
                            <td className={`px-4 py-3 ${isOverdue(transfer) ? "text-rose-600 font-medium" : ""}`}>{formatDate(transfer.expected_date)}</td>
                            <td>
                              <Badge variant="outline" className={`rounded-full capitalize ${statusClass(transfer.status)}`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusLabel(transfer.status)}
                              </Badge>
                            </td>
                            <td>
                              <Badge variant="outline" className={`rounded-full ${riskClass(risk)}`}>
                                {riskLabel(risk)}
                              </Badge>
                            </td>
                            <td className="text-right">
                              <TransferMenu transfer={transfer} />
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
                {pagedTransfers.map((transfer) => {
                  const StatusIcon = statusIcon(transfer.status);
                  return (
                    <div key={transfer.id} className="rounded-2xl border bg-card p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                          <Package className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{transfer.product_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{transfer.from_location} → {transfer.to_location}</p>
                        </div>
                        <Badge variant="outline" className={`rounded-full ${statusClass(transfer.status)}`}>
                          <StatusIcon className="h-3 w-3" />
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
                {pagedTransfers.map((transfer) => (
                  <TransferCard key={transfer.id} transfer={transfer} />
                ))}
              </div>
            )}

            <TablePagination
              page={currentPage}
              perPage={PAGE_SIZE}
              total={filteredTransfers.length}
              onPageChange={setPage}
              noun="transfers"
            />
          </SectionCard>
        </PageContainer>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[95vw] max-w-4xl rounded-3xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Transfer" : "New Transfer"}</DialogTitle>
              <DialogDescription>
                Create a trackable stock transfer between branches, warehouses, vans, or internal stock locations.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Transfer No</label>
                  <Input
                    value={transferNo}
                    onChange={(e) => setTransferNo(e.target.value)}
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
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Product</label>

                  <div className="flex gap-2">
                    <Select
                      value={selectedProductId}
                      onValueChange={(id) => {
                        const product = cleanProducts.find((p) => p.id === id);
                        setSelectedProductId(id);
                        setProductName(product?.name || "");
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>

                      <SelectContent>
                        {cleanProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.sku || "No SKU"} · Stock: {getProductStock(p)}
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
                  <Input value={productName} onChange={(e) => setProductName(e.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Quantity *</label>
                  <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">From Location *</label>
                  <Input value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} placeholder="Main Warehouse" className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">To Location *</label>
                  <Input value={toLocation} onChange={(e) => setToLocation(e.target.value)} placeholder="Kigali Branch" className="rounded-xl" />
                </div>

                <div className="md:col-span-2 rounded-2xl border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Route className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Transfer Route Preview</p>
                  </div>

                  <div className="flex items-center justify-between text-sm gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">From</p>
                      <p className="font-medium truncate">{fromLocation || "Source location"}</p>
                    </div>

                    <ArrowLeftRight className="w-5 h-5 text-muted-foreground shrink-0" />

                    <div className="text-right min-w-0">
                      <p className="text-xs text-muted-foreground">To</p>
                      <p className="font-medium truncate">{toLocation || "Destination location"}</p>
                    </div>
                  </div>

                  {selectedProduct && (
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-background/70 border p-3">
                        <p className="text-xs text-muted-foreground">Available Stock</p>
                        <p className="font-data font-bold">{getProductStock(selectedProduct)}</p>
                      </div>
                      <div className="rounded-xl bg-background/70 border p-3">
                        <p className="text-xs text-muted-foreground">Requested Qty</p>
                        <p className="font-data font-bold">{safeNumber(quantity)}</p>
                      </div>
                      <div className="rounded-xl bg-background/70 border p-3">
                        <p className="text-xs text-muted-foreground">After Transfer</p>
                        <p className={`font-data font-bold ${getProductStock(selectedProduct) - safeNumber(quantity) < 0 ? "text-rose-600" : ""}`}>
                          {getProductStock(selectedProduct) - safeNumber(quantity)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Requested By</label>
                  <Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Approved By</label>
                  <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Transfer Date</label>
                  <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Expected Date</label>
                  <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Completed Date</label>
                  <Input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} className="rounded-xl" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[78px] rounded-xl" />
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={handleSave} disabled={createTransfer.isPending || updateTransfer.isPending} className="bg-primary text-primary-foreground hover:bg-primary">
                {editing ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewTransfer} onOpenChange={() => setViewTransfer(null)}>
          <DialogContent className="w-[95vw] max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{viewTransfer?.transfer_no || "Transfer Details"}</DialogTitle>
              <DialogDescription>
                Transfer route, approval, risk, sync status, and movement details.
              </DialogDescription>
            </DialogHeader>

            {viewTransfer && (
              <div className="space-y-5">
                <div className="rounded-3xl border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-lg">{viewTransfer.product_name}</p>
                      <p className="text-sm text-muted-foreground">{viewTransfer.sku || "No SKU"} · Qty {safeNumber(viewTransfer.quantity).toLocaleString()}</p>
                    </div>
                    <Badge variant="outline" className={`rounded-full capitalize ${statusClass(viewTransfer.status)}`}>
                      {statusLabel(viewTransfer.status)}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-medium">{viewTransfer.from_location}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="font-medium">{viewTransfer.to_location}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Risk</p>
                    <Badge variant="outline" className={`mt-1 rounded-full ${riskClass(transferRiskScore(viewTransfer))}`}>
                      {riskLabel(transferRiskScore(viewTransfer))}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ["Transfer Date", formatDate(viewTransfer.transfer_date)],
                    ["Expected", formatDate(viewTransfer.expected_date)],
                    ["Completed", formatDate(viewTransfer.completed_date)],
                    ["Sync", isPendingSync(viewTransfer) ? "Pending" : "Synced"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1">{viewTransfer.notes || "No notes recorded."}</p>
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="outline" onClick={() => viewTransfer && printTransferNote(viewTransfer)}>
                <FileText className="w-4 h-4 mr-2" />
                Print Note
              </Button>
              <Button variant="outline" onClick={() => setViewTransfer(null)}>Close</Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary"
                onClick={() => {
                  if (viewTransfer) openEdit(viewTransfer);
                  setViewTransfer(null);
                }}
              >
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTransferRow} onOpenChange={() => setDeleteTransferRow(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Delete Transfer</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteTransferRow?.transfer_no || deleteTransferRow?.product_name}"? Offline deletions will sync later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTransferRow(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteTransferRow && deleteTransfer.mutate(deleteTransferRow)}
                disabled={deleteTransfer.isPending}
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