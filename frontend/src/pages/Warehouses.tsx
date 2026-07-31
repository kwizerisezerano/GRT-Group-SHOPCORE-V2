import { useMemo, useState } from "react";
import {
  Store,
  Plus,
  Pencil,
  Trash2,
  Warehouse,
  Boxes,
  MapPin,
  Phone,
  Mail,
  Users,
  Activity,
  Target,
  ShieldCheck,
  AlertTriangle,
  Gauge,
  PackageCheck,
  Clock,
  Search,
  RotateCcw,
  Eye,
  Download,
  FileText,
  BarChart3,
  TrendingUp,
  Layers3,
  Database,
  UploadCloud,
  WifiOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const NAVY = "#0b3d5c";
const PAGE_SIZE = 9;

type SortKey = "created_at" | "name" | "capacity" | "utilized_capacity" | "status";

interface WarehouseRow {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  manager: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  capacity: number | null;
  utilized_capacity: number | null;
  warehouse_type: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
  operation?: "create" | "update" | "delete" | null;
  sync_status?: string | null;
  offline_id?: string | null;
  created_offline_at?: string | null;
  updated_offline_at?: string | null;
  archived_at?: string | null;
}

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number) {
  return safeNumber(value).toLocaleString();
}

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function nowIso() {
  return new Date().toISOString();
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

type SupabaseResult<T = any> = {
  data?: T;
  error?: any;
};

function withSupabaseTimeout<T = any>(
  query: PromiseLike<SupabaseResult<T>>,
  message = "Supabase operation timeout",
  timeoutMs = 12000
): Promise<SupabaseResult<T>> {
  return withTimeout(Promise.resolve(query), message, timeoutMs);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatus(value?: string | null) {
  return String(value || "active").toLowerCase();
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

function isPendingArchive(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted" || String(row?.status || "").toLowerCase() === "archived"
  );
}

function dedupeWarehouses(rows: any[]) {
  const map = new Map<string, WarehouseRow>();

  for (const row of rows || []) {
    if (!row || isPendingArchive(row)) continue;

    const key = String(row.id || row.offline_id || row.code || row.name || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, row as WarehouseRow);
      continue;
    }

    const existingTime = new Date(existing.updated_offline_at || existing.updated_at || existing.created_at || 0).getTime();
    const incomingTime = new Date(row.updated_offline_at || row.updated_at || row.created_at || 0).getTime();

    map.set(key, incomingTime >= existingTime ? { ...existing, ...row } : { ...row, ...existing });
  }

  return Array.from(map.values()).sort((a, b) => {
    const aDate = new Date(a.updated_offline_at || a.updated_at || a.created_at || 0).getTime();
    const bDate = new Date(b.updated_offline_at || b.updated_at || b.created_at || 0).getTime();
    return bDate - aDate;
  });
}

function getUtilization(warehouse: WarehouseRow) {
  const capacity = safeNumber(warehouse.capacity);
  const used = safeNumber(warehouse.utilized_capacity);
  return capacity > 0 ? Math.round((used / capacity) * 100) : 0;
}

function getFreeSpace(warehouse: WarehouseRow) {
  return Math.max(safeNumber(warehouse.capacity) - safeNumber(warehouse.utilized_capacity), 0);
}

function getWarehouseIcon(type?: string | null) {
  const value = String(type || "main").toLowerCase();
  if (value.includes("cold")) return ShieldCheck;
  if (value.includes("reserve")) return Boxes;
  if (value.includes("distribution")) return PackageCheck;
  return Warehouse;
}

function getUtilizationTone(percent: number) {
  if (percent >= 90) return "bg-rose-500";
  if (percent >= 75) return "bg-amber-500";
  if (percent >= 50) return "bg-sky-500";
  return "bg-emerald-500";
}

function getHealthScore(warehouse: WarehouseRow) {
  const utilization = getUtilization(warehouse);
  let score = 0;
  if (warehouse.name) score += 12;
  if (warehouse.manager) score += 14;
  if (warehouse.phone || warehouse.email) score += 14;
  if (warehouse.address || warehouse.city) score += 14;
  if (safeNumber(warehouse.capacity) > 0) score += 16;
  if (getStatus(warehouse.status) === "active") score += 14;
  if (utilization < 90) score += 16;
  else if (utilization < 100) score += 6;
  return Math.min(100, score);
}

function getHealthLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Healthy";
  if (score >= 50) return "Warning";
  return "Critical";
}

function getHealthColor(score: number) {
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-sky-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
}

function getStatusBadge(status?: string | null) {
  const value = getStatus(status);
  if (value === "active") {
    return <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">Active</Badge>;
  }
  if (value === "inactive") {
    return <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-rose-600">Inactive</Badge>;
  }
  if (value === "maintenance") {
    return <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">Maintenance</Badge>;
  }
  return <Badge variant="outline" className="rounded-full border-sky-500/30 bg-sky-500/10 text-sky-600 capitalize">{value}</Badge>;
}

function WarehouseKpi({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: any;
  tone: string;
}) {
  return (
    <div className={`relative min-h-[86px] overflow-hidden rounded-[1.4rem] p-4 text-white shadow-sm ${tone}`}>
      <div className="absolute -right-7 -top-8 h-20 w-20 rounded-full bg-white/15" />
      <div className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-white/35" />
      <div className="relative flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-white/90">{label}</p>
          <p className={`mt-1 font-data font-black leading-tight ${String(value).length > 12 ? "text-lg break-words" : "text-xl"}`}>
            {value}
          </p>
          <div className="mt-2 inline-flex rounded-full bg-white/18 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-inner">
            {helper}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildWarehousePayload(form: {
  name: string;
  code: string;
  manager: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  capacity: string;
  utilizedCapacity: string;
  warehouseType: string;
  status: string;
  notes: string;
}) {
  return {
    name: form.name.trim(),
    code: form.code.trim() || null,
    manager: form.manager.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    city: form.city.trim() || null,
    capacity: safeNumber(form.capacity),
    utilized_capacity: safeNumber(form.utilizedCapacity),
    warehouse_type: form.warehouseType.trim() || "main",
    status: form.status || "active",
    notes: form.notes.trim() || null,
  };
}

export default function WarehousesPage() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [viewWarehouse, setViewWarehouse] = useState<WarehouseRow | null>(null);
  const [deleteTarget, setArchiveTarget] = useState<WarehouseRow | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [capacityFilter, setCapacityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [manager, setManager] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [capacity, setCapacity] = useState("");
  const [utilizedCapacity, setUtilizedCapacity] = useState("");
  const [warehouseType, setWarehouseType] = useState("main");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");

  const offlineModeActive = !isOnline() || isOfflineMode() || !session?.access_token;
  const canUseOnlineSupabase = isOnline() && !!session?.access_token && !isOfflineMode();

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["warehouses", tenantId, canUseOnlineSupabase ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    refetchOnReconnect: canUseOnlineSupabase,
    refetchOnWindowFocus: canUseOnlineSupabase,
    queryFn: async () => {
      if (!tenantId) return [] as WarehouseRow[];

      const cachedWarehouses = await getCachedTable("warehouses");

      if (!canUseOnlineSupabase) {
        return dedupeWarehouses(Array.isArray(cachedWarehouses) ? cachedWarehouses : []);
      }

      try {
        const { data, error } = await withSupabaseTimeout(
          (supabase as any)
            .from("warehouses")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false }),
          "Warehouse loading timeout"
        );

        if (error) throw error;

        const merged = dedupeWarehouses([...(data || []), ...(Array.isArray(cachedWarehouses) ? cachedWarehouses : [])]);
        await saveCachedTable("warehouses", merged);
        return merged;
      } catch (error) {
        if (isNetworkError(error)) {
          return dedupeWarehouses(Array.isArray(cachedWarehouses) ? cachedWarehouses : []);
        }
        throw error;
      }
    },
  });

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>(["main", "cold room", "reserve", "distribution"]);
    warehouses.forEach((w) => w.warehouse_type && set.add(w.warehouse_type));
    return [...set].sort();
  }, [warehouses]);

  const filteredWarehouses = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = warehouses.filter((w) => {
      const utilization = getUtilization(w);
      const matchesSearch =
        !q ||
        (w.name || "").toLowerCase().includes(q) ||
        (w.code || "").toLowerCase().includes(q) ||
        (w.manager || "").toLowerCase().includes(q) ||
        (w.city || "").toLowerCase().includes(q) ||
        (w.address || "").toLowerCase().includes(q) ||
        (w.warehouse_type || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || getStatus(w.status) === statusFilter;
      const matchesType = typeFilter === "all" || w.warehouse_type === typeFilter;
      const matchesCapacity =
        capacityFilter === "all" ||
        (capacityFilter === "healthy" && utilization < 75) ||
        (capacityFilter === "warning" && utilization >= 75 && utilization < 90) ||
        (capacityFilter === "critical" && utilization >= 90);
      return matchesSearch && matchesStatus && matchesType && matchesCapacity;
    });

    rows.sort((a: any, b: any) => {
      if (sortKey === "created_at") {
        const av = new Date(a.created_at || 0).getTime();
        const bv = new Date(b.created_at || 0).getTime();
        return sortAsc ? av - bv : bv - av;
      }
      if (["capacity", "utilized_capacity"].includes(sortKey)) {
        return sortAsc ? safeNumber(a[sortKey]) - safeNumber(b[sortKey]) : safeNumber(b[sortKey]) - safeNumber(a[sortKey]);
      }
      const av = String(a[sortKey] || "");
      const bv = String(b[sortKey] || "");
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return rows;
  }, [warehouses, search, statusFilter, typeFilter, capacityFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredWarehouses.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedWarehouses = filteredWarehouses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const storageCapacity = warehouses.reduce((sum, w) => sum + safeNumber(w.capacity), 0);
    const occupiedSpace = warehouses.reduce((sum, w) => sum + safeNumber(w.utilized_capacity), 0);
    const freeSpace = Math.max(storageCapacity - occupiedSpace, 0);
    const utilization = storageCapacity > 0 ? Math.round((occupiedSpace / storageCapacity) * 100) : 0;
    const activeWarehouses = warehouses.filter((w) => getStatus(w.status) === "active").length;
    const inactiveWarehouses = warehouses.filter((w) => getStatus(w.status) === "inactive").length;
    const maintenanceWarehouses = warehouses.filter((w) => getStatus(w.status) === "maintenance").length;
    const criticalWarehouses = warehouses.filter((w) => getUtilization(w) >= 90).length;
    const warningWarehouses = warehouses.filter((w) => getUtilization(w) >= 75 && getUtilization(w) < 90).length;
    const missingManagers = warehouses.filter((w) => !w.manager).length;
    const missingContacts = warehouses.filter((w) => !w.phone && !w.email).length;
    const pendingSync = warehouses.filter(isPendingSync).length;
    const avgHealth = warehouses.length
      ? Math.round(warehouses.reduce((sum, w) => sum + getHealthScore(w), 0) / warehouses.length)
      : 0;
    const topUtilized = [...warehouses]
      .map((warehouse) => ({ warehouse, percent: getUtilization(warehouse) }))
      .sort((a, b) => b.percent - a.percent)[0];
    const bestHealth = [...warehouses]
      .map((warehouse) => ({ warehouse, score: getHealthScore(warehouse) }))
      .sort((a, b) => b.score - a.score)[0];

    return {
      total: warehouses.length,
      storageCapacity,
      occupiedSpace,
      freeSpace,
      utilization,
      activeWarehouses,
      inactiveWarehouses,
      maintenanceWarehouses,
      criticalWarehouses,
      warningWarehouses,
      missingManagers,
      missingContacts,
      pendingSync,
      avgHealth,
      topUtilized,
      bestHealth,
    };
  }, [warehouses]);

  const utilizationBuckets = useMemo(() => {
    const buckets = [
      { label: "0–50%", value: warehouses.filter((w) => getUtilization(w) < 50).length, className: "bg-emerald-500" },
      { label: "50–75%", value: warehouses.filter((w) => getUtilization(w) >= 50 && getUtilization(w) < 75).length, className: "bg-sky-500" },
      { label: "75–90%", value: warehouses.filter((w) => getUtilization(w) >= 75 && getUtilization(w) < 90).length, className: "bg-amber-500" },
      { label: "90%+", value: warehouses.filter((w) => getUtilization(w) >= 90).length, className: "bg-rose-500" },
    ];
    const max = Math.max(...buckets.map((b) => b.value), 1);
    return buckets.map((b) => ({ ...b, percent: Math.round((b.value / max) * 100) }));
  }, [warehouses]);

  const typeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    warehouses.forEach((w) => {
      const key = w.warehouse_type || "main";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()]
      .map(([name, count]) => ({ name, count, percent: stats.total ? Math.round((count / stats.total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [warehouses, stats.total]);

  const rankedWarehouses = useMemo(() => {
    return [...warehouses]
      .map((warehouse) => ({
        warehouse,
        utilization: getUtilization(warehouse),
        health: getHealthScore(warehouse),
        freeSpace: getFreeSpace(warehouse),
      }))
      .sort((a, b) => b.health - a.health || b.utilization - a.utilization)
      .slice(0, 6);
  }, [warehouses]);

  const alerts = useMemo(() => {
    const list: Array<{ title: string; message: string; tone: string; icon: any }> = [];
    warehouses.forEach((w) => {
      const utilization = getUtilization(w);
      if (utilization >= 90) {
        list.push({ title: `${w.name} is near full`, message: `${utilization}% utilized. Plan transfer, expansion, or dispatch.`, tone: "bg-rose-500/10 text-rose-700 border-rose-500/20", icon: AlertTriangle });
      } else if (utilization >= 75) {
        list.push({ title: `${w.name} capacity warning`, message: `${utilization}% utilized. Monitor receiving volume.`, tone: "bg-amber-500/10 text-amber-700 border-amber-500/20", icon: Gauge });
      }
      if (!w.manager) {
        list.push({ title: `${w.name} has no manager`, message: "Assign a warehouse manager for accountability.", tone: "bg-blue-500/10 text-blue-700 border-blue-500/20", icon: Users });
      }
      if (!w.phone && !w.email) {
        list.push({ title: `${w.name} contact missing`, message: "Add phone or email for operations communication.", tone: "bg-violet-500/10 text-violet-700 border-violet-500/20", icon: Mail });
      }
    });
    return list.slice(0, 6);
  }, [warehouses]);

  const exportRows = filteredWarehouses.map((w) => ({
    name: w.name,
    code: w.code || "",
    type: w.warehouse_type || "main",
    manager: w.manager || "",
    city: w.city || "",
    address: w.address || "",
    phone: w.phone || "",
    email: w.email || "",
    capacity: safeNumber(w.capacity),
    occupied: safeNumber(w.utilized_capacity),
    free_space: getFreeSpace(w),
    utilization: `${getUtilization(w)}%`,
    health_score: `${getHealthScore(w)}%`,
    status: w.status || "active",
    created_at: formatDate(w.created_at),
    notes: w.notes || "",
  }));

  const exportCols = [
    { key: "name" as const, label: "Warehouse" },
    { key: "code" as const, label: "Code" },
    { key: "type" as const, label: "Type" },
    { key: "manager" as const, label: "Manager" },
    { key: "city" as const, label: "City" },
    { key: "capacity" as const, label: "Capacity" },
    { key: "occupied" as const, label: "Occupied" },
    { key: "free_space" as const, label: "Free Space" },
    { key: "utilization" as const, label: "Utilization" },
    { key: "health_score" as const, label: "Health" },
    { key: "status" as const, label: "Status" },
  ];

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setCapacityFilter("all");
    setSortKey("created_at");
    setSortAsc(false);
    setPage(1);
  };

  const refreshWarehouseQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
      queryClient.invalidateQueries({ queryKey: ["transfers"] }),
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const saveWarehouseOffline = async (payload: any) => {
    if (!tenantId) throw new Error("No active workspace");

    const now = nowIso();
    const cachedWarehouses = await getCachedTable("warehouses");
    let nextRows: WarehouseRow[];

    if (editing) {
      const isOfflineWarehouse = String(editing.id || "").startsWith("offline-") || !!editing.offline_id;
      const updatedWarehouse: WarehouseRow = {
        ...editing,
        ...payload,
        id: editing.id,
        tenant_id: editing.tenant_id || tenantId,
        operation: isOfflineWarehouse ? "create" : "update",
        sync_status: isOfflineWarehouse ? "pending" : "pending_update",
        updated_at: now,
        updated_offline_at: now,
      };

      nextRows = dedupeWarehouses([updatedWarehouse, ...(Array.isArray(cachedWarehouses) ? cachedWarehouses : [])]);
      await savePending("warehouses", updatedWarehouse);
      await saveCachedTable("warehouses", nextRows);
      await refreshWarehouseQueries();
      return updatedWarehouse;
    }

    const offlineWarehouse: WarehouseRow = {
      ...payload,
      id: makeLocalId("offline-warehouse"),
      tenant_id: tenantId,
      created_at: now,
      operation: "create",
      sync_status: "pending",
      created_offline_at: now,
      updated_offline_at: now,
    };

    nextRows = dedupeWarehouses([offlineWarehouse, ...(Array.isArray(cachedWarehouses) ? cachedWarehouses : [])]);
    await savePending("warehouses", offlineWarehouse);
    await saveCachedTable("warehouses", nextRows);
    await refreshWarehouseQueries();
    return offlineWarehouse;
  };

  const createWarehouse = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!name.trim()) throw new Error("Warehouse name is required");

      const payload = buildWarehousePayload({ name, code, manager, phone, email, address, city, capacity, utilizedCapacity, warehouseType, status, notes });

      if (!canUseOnlineSupabase) {
        return await saveWarehouseOffline(payload);
      }

      try {
        const { data, error } = await withSupabaseTimeout(
          (supabase as any)
            .from("warehouses")
            .insert({ tenant_id: tenantId, ...payload })
            .select()
            .single(),
          "Warehouse save timeout"
        );

        if (error) throw error;

        const cachedWarehouses = await getCachedTable("warehouses");
        await saveCachedTable("warehouses", dedupeWarehouses([data, ...(Array.isArray(cachedWarehouses) ? cachedWarehouses : [])]));
        return data as WarehouseRow;
      } catch (error) {
        if (isNetworkError(error) || !isOnline()) {
          return await saveWarehouseOffline(payload);
        }
        throw error;
      }
    },
    onSuccess: async (data: any) => {
      await refreshWarehouseQueries();
      toast.success(data?.sync_status?.includes("pending") ? "Warehouse saved offline. It will sync when internet returns." : "Warehouse added successfully.");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateWarehouse = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!editing) throw new Error("No warehouse selected");
      if (!name.trim()) throw new Error("Warehouse name is required");

      const payload = buildWarehousePayload({ name, code, manager, phone, email, address, city, capacity, utilizedCapacity, warehouseType, status, notes });

      if (!canUseOnlineSupabase || String(editing.id || "").startsWith("offline-") || !!editing.offline_id) {
        return await saveWarehouseOffline(payload);
      }

      try {
        const { data, error } = await withSupabaseTimeout(
          (supabase as any)
            .from("warehouses")
            .update(payload)
            .eq("id", editing.id)
            .eq("tenant_id", tenantId)
            .select()
            .single(),
          "Warehouse update timeout"
        );

        if (error) throw error;

        const cachedWarehouses = await getCachedTable("warehouses");
        await saveCachedTable("warehouses", dedupeWarehouses([data, ...(Array.isArray(cachedWarehouses) ? cachedWarehouses : [])]));
        return { ...(data as WarehouseRow), sync_status: "synced" };
      } catch (error) {
        if (isNetworkError(error) || !isOnline()) {
          return await saveWarehouseOffline(payload);
        }
        throw error;
      }
    },
    onSuccess: async (data: any) => {
      await refreshWarehouseQueries();
      toast.success(data?.sync_status?.includes("pending") ? "Warehouse update saved offline." : "Warehouse updated successfully.");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archiveWarehouse = useMutation({
    mutationFn: async (warehouse: WarehouseRow) => {
      if (!tenantId) throw new Error("No active workspace");
      const cachedWarehouses = await getCachedTable("warehouses");
      const now = nowIso();

      if (String(warehouse.id || "").startsWith("offline-")) {
        await saveCachedTable("warehouses", (Array.isArray(cachedWarehouses) ? cachedWarehouses : []).filter((row: any) => String(row.id) !== String(warehouse.id)));
        return { sync_status: "removed" };
      }

      const archived: WarehouseRow = { ...warehouse, status: "inactive", operation: "update", sync_status: "pending_update", updated_at: now, updated_offline_at: now, archived_at: now };

      if (!canUseOnlineSupabase) {
        await savePending("warehouses", archived);
        await saveCachedTable("warehouses", (Array.isArray(cachedWarehouses) ? cachedWarehouses : []).map((row: any) => String(row.id) === String(warehouse.id) ? archived : row));
        return archived;
      }

      try {
        const { data, error } = await withSupabaseTimeout(
          (supabase as any)
            .from("warehouses")
            .update({ status: "inactive", updated_at: now })
            .eq("id", warehouse.id)
            .eq("tenant_id", tenantId)
            .select()
            .single(),
          "Warehouse archive timeout"
        );

        if (error) throw error;
        await saveCachedTable("warehouses", dedupeWarehouses([data, ...(Array.isArray(cachedWarehouses) ? cachedWarehouses : [])]));
        return { ...(data as WarehouseRow), sync_status: "synced" };
      } catch (error) {
        if (isNetworkError(error) || !isOnline()) {
          await savePending("warehouses", archived);
          await saveCachedTable("warehouses", (Array.isArray(cachedWarehouses) ? cachedWarehouses : []).map((row: any) => String(row.id) === String(warehouse.id) ? archived : row));
          return archived;
        }
        throw error;
      }
    },
    onSuccess: async (data: any) => {
      await refreshWarehouseQueries();
      toast.success(data?.sync_status === "pending_update" ? "Warehouse archive saved offline." : data?.sync_status === "removed" ? "Offline warehouse removed locally." : "Warehouse archived successfully.");
      setArchiveTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setManager("");
    setPhone("");
    setEmail("");
    setAddress("");
    setCity("");
    setCapacity("");
    setUtilizedCapacity("");
    setWarehouseType("main");
    setStatus("active");
    setNotes("");
    setDialogOpen(true);
  };

  const openEdit = (warehouse: WarehouseRow) => {
    setEditing(warehouse);
    setName(warehouse.name || "");
    setCode(warehouse.code || "");
    setManager(warehouse.manager || "");
    setPhone(warehouse.phone || "");
    setEmail(warehouse.email || "");
    setAddress(warehouse.address || "");
    setCity(warehouse.city || "");
    setCapacity(warehouse.capacity ? String(warehouse.capacity) : "");
    setUtilizedCapacity(warehouse.utilized_capacity ? String(warehouse.utilized_capacity) : "");
    setWarehouseType(warehouse.warehouse_type || "main");
    setStatus(warehouse.status || "active");
    setNotes(warehouse.notes || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (editing) updateWarehouse.mutate();
    else createWarehouse.mutate();
  };

  return (
    <PageShell
      title="Warehouses"
      description="Manage warehouse capacity, storage health, utilization, managers, alerts, receiving readiness, and dispatch operations."
    >
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-4">
          {(offlineModeActive || stats.pendingSync > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? <Database className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">{offlineModeActive ? "Warehouse records are using offline storage" : "Warehouse changes waiting to sync"}</p>
                    <p className="text-sm opacity-90">Pending warehouse records: {stats.pendingSync}. Capacity planning, manager contacts, and storage locations remain available offline.</p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  <UploadCloud className="mr-1 h-3 w-3" />
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-7 self-start overflow-hidden rounded-[1.75rem] border border-blue-200 bg-blue-50 p-4 shadow-sm relative">
              <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-blue-500/10" />
              <div className="absolute -right-6 top-16 h-20 w-20 rounded-full bg-cyan-500/10" />
              <div className="absolute -bottom-14 left-14 h-32 w-32 rounded-full bg-violet-500/10" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                  <Warehouse className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <Badge className="mb-2 rounded-full border-blue-200 bg-blue-600 px-3 py-1 text-white shadow-sm hover:bg-blue-600">
                    <Activity className="mr-1 h-3.5 w-3.5" />
                    Warehouse Operations Center
                  </Badge>
                  <h2 className="text-xl font-black tracking-tight text-slate-950">Warehouse Operations Control</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Monitor warehouse capacity, utilization, health score, managers, contact readiness, storage alerts, receiving capacity, and dispatch readiness.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground">Top Utilized</p>
                      <p className="text-sm font-semibold truncate">{stats.topUtilized?.warehouse?.name || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground">Average Health</p>
                      <p className={`text-sm font-semibold ${getHealthColor(stats.avgHealth)}`}>{stats.avgHealth}% · {getHealthLabel(stats.avgHealth)}</p>
                    </div>
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground">Filtered</p>
                      <p className="text-sm font-semibold font-data">{filteredWarehouses.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 2xl:grid-cols-3 gap-3">
              <WarehouseKpi label="Warehouses" value={stats.total} helper="storage locations" icon={Warehouse} tone="bg-blue-600" />
              <WarehouseKpi label="Active" value={stats.activeWarehouses} helper="ready for operations" icon={CheckCircle2} tone="bg-emerald-600" />
              <WarehouseKpi label="Utilization" value={`${stats.utilization}%`} helper="network usage" icon={Gauge} tone="bg-orange-600" />
              <WarehouseKpi label="Capacity" value={formatNumber(stats.storageCapacity)} helper="maximum storage" icon={Boxes} tone="bg-violet-600" />
              <WarehouseKpi label="Critical" value={stats.criticalWarehouses} helper="capacity risk" icon={AlertTriangle} tone="bg-rose-600" />
              <WarehouseKpi label="Pending Sync" value={stats.pendingSync} helper="waiting upload" icon={UploadCloud} tone="bg-cyan-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-4 rounded-3xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl text-white flex items-center justify-center" style={{ background: NAVY }}>
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Warehouse Health</h3>
                  <p className="text-xs text-muted-foreground">Network readiness score</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-32 w-32 shrink-0 rounded-full p-3" style={{ background: `conic-gradient(${NAVY} ${stats.avgHealth * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-center">
                    <div>
                      <p className="text-2xl font-black font-data">{stats.avgHealth}%</p>
                      <p className="text-[10px] uppercase text-muted-foreground">Health</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 flex-1">
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Missing Managers</p>
                    <p className="font-bold font-data">{stats.missingManagers}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Missing Contacts</p>
                    <p className="font-bold font-data">{stats.missingContacts}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-cyan-300 bg-cyan-50 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Utilization Heatmap</h3>
                  <p className="text-xs text-muted-foreground">Capacity risk buckets</p>
                </div>
              </div>
              <div className="space-y-3">
                {utilizationBuckets.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="font-data text-muted-foreground">{item.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${item.className}`} style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-violet-300 bg-violet-50 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <Layers3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Warehouse Types</h3>
                  <p className="text-xs text-muted-foreground">Storage network composition</p>
                </div>
              </div>
              <div className="space-y-3">
                {typeDistribution.length === 0 ? (
                  <div className="rounded-2xl border bg-muted/20 py-8 text-center text-sm text-muted-foreground">No warehouse type data</div>
                ) : (
                  typeDistribution.map((item) => (
                    <div key={item.name} className="rounded-2xl bg-muted/30 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">{item.name}</span>
                        <span className="font-data text-muted-foreground">{item.count} · {item.percent}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-background overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.percent}%`, background: NAVY }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-5 rounded-3xl border bg-card shadow-sm p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Warehouse Ranking</h3>
                  <p className="text-xs text-muted-foreground">Ranked by health and utilization</p>
                </div>
              </div>
              <div className="space-y-3">
                {rankedWarehouses.length === 0 ? (
                  <div className="rounded-2xl border bg-muted/20 py-8 text-center text-sm text-muted-foreground">No ranking data</div>
                ) : (
                  rankedWarehouses.map((item, index) => (
                    <button
                      key={item.warehouse.id}
                      onClick={() => setViewWarehouse(item.warehouse)}
                      className="w-full rounded-2xl border bg-muted/20 p-3 text-left transition hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-white font-bold" style={{ background: NAVY }}>
                          #{index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.warehouse.name}</p>
                          <p className="text-xs text-muted-foreground">{item.utilization}% used · {item.freeSpace.toLocaleString()} free</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${getHealthColor(item.health)}`}>{item.health}%</p>
                          <p className="text-[10px] text-muted-foreground">{getHealthLabel(item.health)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="xl:col-span-7 rounded-3xl border bg-card shadow-sm p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Warehouse Alerts</h3>
                  <p className="text-xs text-muted-foreground">Capacity, contact, and manager warnings</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {alerts.length === 0 ? (
                  <div className="md:col-span-2 rounded-2xl border bg-emerald-500/10 p-4 text-emerald-700">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5" />
                      <div>
                        <p className="font-semibold">No urgent warehouse alerts</p>
                        <p className="text-sm opacity-80">Capacity, contacts, and manager coverage look controlled.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  alerts.map((alert, index) => {
                    const Icon = alert.icon;
                    return (
                      <div key={`${alert.title}-${index}`} className={`rounded-2xl border p-4 ${alert.tone}`}>
                        <div className="flex items-start gap-3">
                          <Icon className="mt-0.5 h-5 w-5" />
                          <div>
                            <p className="font-semibold">{alert.title}</p>
                            <p className="text-sm opacity-80">{alert.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-2xl border border-blue-200/70 bg-white/80 px-4 shadow-sm focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  placeholder="Search warehouse, code, manager, type, city, or address..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-blue-500/80"
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-2xl border-blue-200 bg-blue-50/60 text-blue-700 xl:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-2xl border-cyan-200 bg-cyan-50/70 text-cyan-700 xl:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((typeName) => <SelectItem key={typeName} value={typeName} className="capitalize">{typeName}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={capacityFilter} onValueChange={(v) => { setCapacityFilter(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-2xl border-blue-200 bg-blue-50/60 text-blue-700 xl:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Capacity</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-10 w-full rounded-2xl border-blue-200 bg-blue-50/60 text-blue-700 xl:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Newest</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="capacity">Capacity</SelectItem>
                  <SelectItem value="utilized_capacity">Occupied</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="h-10 rounded-2xl border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" onClick={() => setSortAsc(!sortAsc)}>
                <BarChart3 className="mr-2 h-4 w-4" />
                {sortAsc ? "Asc" : "Desc"}
              </Button>

              <Button variant="ghost" className="h-10 rounded-2xl bg-orange-600 text-white hover:bg-orange-700" onClick={resetFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>

              <ExportMenu
                onCSV={() => exportToCSV(exportRows, "warehouse_report", exportCols)}
                onPDF={() => exportToPDF(exportRows, "warehouse_report", "Warehouse Report", exportCols, {
                  subtitle: `${filteredWarehouses.length} warehouse records`,
                  summary: [
                    { label: "Warehouses", value: String(stats.total) },
                    { label: "Capacity", value: formatNumber(stats.storageCapacity) },
                    { label: "Occupied", value: formatNumber(stats.occupiedSpace) },
                    { label: "Utilization", value: `${stats.utilization}%` },
                    { label: "Health", value: `${stats.avgHealth}%` },
                    { label: "Critical", value: String(stats.criticalWarehouses) },
                  ],
                })}
              />

              <Button onClick={openCreate} className="h-10 rounded-2xl bg-blue-600 px-5 text-white shadow-md shadow-blue-900/20 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Add Warehouse
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {isLoading ? (
              <div className="rounded-3xl border bg-card py-12 text-center text-muted-foreground xl:col-span-3">Loading warehouses...</div>
            ) : pagedWarehouses.length === 0 ? (
              <div className="rounded-3xl border bg-card py-16 text-center text-muted-foreground xl:col-span-3">
                <Store className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="font-medium">No warehouses found</p>
                <p className="text-sm">Create or adjust filters to view storage locations.</p>
              </div>
            ) : (
              pagedWarehouses.map((warehouse) => {
                const capacityValue = safeNumber(warehouse.capacity);
                const occupied = safeNumber(warehouse.utilized_capacity);
                const percent = getUtilization(warehouse);
                const health = getHealthScore(warehouse);
                const Icon = getWarehouseIcon(warehouse.warehouse_type);
                return (
                  <div key={warehouse.id} className="overflow-hidden rounded-3xl border bg-card p-4 shadow-sm transition hover:shadow-md">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold">{warehouse.name}</p>
                          <p className="text-xs text-muted-foreground">{warehouse.code || "No code"} · {warehouse.warehouse_type || "main"}</p>
                          {isPendingSync(warehouse) && (
                            <Badge variant="outline" className="mt-1 rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30">
                              <UploadCloud className="mr-1 h-3 w-3" /> Pending Sync
                            </Badge>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(warehouse.status)}
                    </div>

                    <div className="mb-4 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-teal-500/10 p-3">
                        <p className="text-xs text-muted-foreground">Used</p>
                        <p className="font-bold text-teal-700">{percent}%</p>
                      </div>
                      <div className="rounded-2xl bg-sky-500/10 p-3">
                        <p className="text-xs text-muted-foreground">Free</p>
                        <p className="font-bold text-sky-700">{formatNumber(getFreeSpace(warehouse))}</p>
                      </div>
                      <div className="rounded-2xl bg-violet-500/10 p-3">
                        <p className="text-xs text-muted-foreground">Health</p>
                        <p className={`font-bold ${getHealthColor(health)}`}>{health}%</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                        <span>Space usage</span>
                        <span>{formatNumber(occupied)} / {formatNumber(capacityValue)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${getUtilizationTone(percent)}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="truncate">{warehouse.manager || "No manager assigned"}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /><span className="truncate">{warehouse.city || warehouse.address || "No location added"}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /><span className="truncate">{warehouse.phone || "No phone"}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /><span className="truncate">{warehouse.email || "No email"}</span></div>
                    </div>

                    {warehouse.notes && <div className="mt-4 rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">{warehouse.notes}</div>}

                    <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                      <Button size="sm" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={() => setViewWarehouse(warehouse)}><Eye className="mr-2 h-4 w-4" />View</Button>
                      <Button size="sm" className="rounded-xl bg-amber-500 text-white hover:bg-amber-600" onClick={() => openEdit(warehouse)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                      <Button size="sm" className="rounded-xl bg-rose-600 text-white hover:bg-rose-700" onClick={() => setArchiveTarget(warehouse)}><Trash2 className="mr-2 h-4 w-4" />Archive</Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border bg-card shadow-sm px-4 py-3">
              <p className="text-xs text-muted-foreground">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredWarehouses.length)} of {filteredWarehouses.length}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Badge variant="outline" className="rounded-full">Page {currentPage} / {totalPages}</Badge>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="border-b p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><FileText className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-black">Warehouse Directory</h3>
                  <p className="text-xs text-muted-foreground">Compact administration list with utilization and health.</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                  <div className="col-span-3">Warehouse</div>
                  <div className="col-span-2">Manager</div>
                  <div className="col-span-2">Contact</div>
                  <div className="col-span-2">Space Usage</div>
                  <div className="col-span-1">Health</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>
                {filteredWarehouses.map((warehouse) => {
                  const percent = getUtilization(warehouse);
                  const health = getHealthScore(warehouse);
                  return (
                    <div key={warehouse.id} className="grid grid-cols-12 items-center gap-4 border-b px-5 py-4 last:border-b-0 hover:bg-muted/30">
                      <div className="col-span-3">
                        <p className="font-semibold">{warehouse.name}</p>
                        <p className="text-xs text-muted-foreground">{warehouse.code || "-"} · {warehouse.warehouse_type || "main"}</p>
                        <p className="text-xs text-muted-foreground">{warehouse.city || ""}</p>
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground">{warehouse.manager || "-"}</div>
                      <div className="col-span-2 text-sm text-muted-foreground"><p>{warehouse.phone || "-"}</p><p className="truncate text-xs">{warehouse.email || ""}</p></div>
                      <div className="col-span-2 text-sm text-muted-foreground"><p>{formatNumber(safeNumber(warehouse.utilized_capacity))} / {formatNumber(safeNumber(warehouse.capacity))}</p><p className="text-xs">{percent}% occupied</p></div>
                      <div className={`col-span-1 text-sm font-bold ${getHealthColor(health)}`}>{health}%</div>
                      <div className="col-span-1">{getStatusBadge(warehouse.status)}</div>
                      <div className="col-span-1 flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewWarehouse(warehouse)}><Eye className="h-4 w-4 text-[#0b3d5c]" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(warehouse)}><Pencil className="h-4 w-4 text-sky-600" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={!!viewWarehouse} onOpenChange={() => setViewWarehouse(null)}>
          <DialogContent className="max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Warehouse className="h-5 w-5" />{viewWarehouse?.name}</DialogTitle>
              <DialogDescription>{viewWarehouse?.code || "No code"} · {viewWarehouse?.warehouse_type || "main"} · Created {formatDate(viewWarehouse?.created_at)}</DialogDescription>
            </DialogHeader>
            {viewWarehouse && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Capacity</p><p className="font-bold font-data">{formatNumber(safeNumber(viewWarehouse.capacity))}</p></div>
                  <div className="rounded-2xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Occupied</p><p className="font-bold font-data">{formatNumber(safeNumber(viewWarehouse.utilized_capacity))}</p></div>
                  <div className="rounded-2xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Free</p><p className="font-bold font-data">{formatNumber(getFreeSpace(viewWarehouse))}</p></div>
                  <div className="rounded-2xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Health</p><p className={`font-bold ${getHealthColor(getHealthScore(viewWarehouse))}`}>{getHealthScore(viewWarehouse)}%</p></div>
                </div>
                <div className="rounded-3xl border bg-card p-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Utilization</span>
                    <span className="font-data">{getUtilization(viewWarehouse)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${getUtilizationTone(getUtilization(viewWarehouse))}`} style={{ width: `${Math.min(getUtilization(viewWarehouse), 100)}%` }} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-2xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Manager</p><p className="font-semibold">{viewWarehouse.manager || "No manager assigned"}</p><p className="mt-2 text-muted-foreground">{viewWarehouse.phone || "No phone"}</p><p className="text-muted-foreground">{viewWarehouse.email || "No email"}</p></div>
                  <div className="rounded-2xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Location</p><p className="font-semibold">{viewWarehouse.city || "No city"}</p><p className="mt-2 text-muted-foreground">{viewWarehouse.address || "No address"}</p><div className="mt-2">{getStatusBadge(viewWarehouse.status)}</div></div>
                </div>
                {viewWarehouse.notes && <div className="rounded-2xl border bg-muted/20 p-4 text-sm"><p className="text-xs text-muted-foreground mb-1">Notes</p>{viewWarehouse.notes}</div>}
              </div>
            )}
            <DialogFooter>
              <Button className="rounded-2xl bg-slate-700 text-white hover:bg-slate-800" onClick={() => setViewWarehouse(null)}>Close</Button>
              <Button className="rounded-2xl bg-indigo-700 text-white shadow-md shadow-indigo-900/20 hover:bg-indigo-800" onClick={() => { if (viewWarehouse) { openEdit(viewWarehouse); setViewWarehouse(null); } }}>Edit Warehouse</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl rounded-3xl border-blue-200 bg-blue-50">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
              <DialogDescription>{editing ? "Update warehouse storage, contact, and operational details." : "Create a warehouse, cold room, reserve location, or distribution center."}</DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <div><label className="text-xs font-medium text-muted-foreground">Warehouse Name *</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" value={name} onChange={(event) => setName(event.target.value)} placeholder="Main Warehouse" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Code</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" value={code} onChange={(event) => setCode(event.target.value)} placeholder="WH-001" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Warehouse Type</label><Select value={warehouseType} onValueChange={setWarehouseType}><SelectTrigger className="rounded-2xl border-cyan-200 bg-white/90 text-cyan-800"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="main">Main</SelectItem><SelectItem value="cold room">Cold Room</SelectItem><SelectItem value="reserve">Reserve</SelectItem><SelectItem value="distribution">Distribution</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs font-medium text-muted-foreground">Manager</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" value={manager} onChange={(event) => setManager(event.target.value)} placeholder="Warehouse manager" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Phone</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250..." /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Email</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="warehouse@shopcore.com" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">City</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Kigali" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Address</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street / industrial zone" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Storage Capacity</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Example: 20,000 units" /><p className="mt-1 text-xs text-muted-foreground">Maximum space this warehouse can hold.</p></div>
              <div><label className="text-xs font-medium text-muted-foreground">Current Occupied Space</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" type="number" value={utilizedCapacity} onChange={(event) => setUtilizedCapacity(event.target.value)} placeholder="Example: 8,500 units occupied" /><p className="mt-1 text-xs text-muted-foreground">Space already used by stock or storage.</p></div>
              <div><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={status} onValueChange={setStatus}><SelectTrigger className="rounded-2xl border-cyan-200 bg-white/90 text-cyan-800"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs font-medium text-muted-foreground">Notes</label><Input className="rounded-2xl border-blue-200 bg-white/90 placeholder:text-blue-500/70 focus-visible:ring-blue-500/20" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Internal notes" /></div>
              <div className="rounded-2xl border bg-muted/30 p-4 md:col-span-2"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b3d5c]/10 text-[#0b3d5c]"><Clock className="h-5 w-5" /></div><div><p className="font-medium">Capacity planning standard</p><p className="mt-1 text-xs text-muted-foreground">Keep utilization below 90% to avoid receiving delays, picking congestion, and poor stock organization.</p></div></div></div>
            </div>
            <DialogFooter>
              <Button className="rounded-2xl bg-slate-700 text-white hover:bg-slate-800" onClick={closeDialog}>Cancel</Button>
              <Button className="rounded-2xl bg-indigo-700 text-white shadow-md shadow-indigo-900/20 hover:bg-indigo-800" onClick={handleSave} disabled={createWarehouse.isPending || updateWarehouse.isPending}>{createWarehouse.isPending || updateWarehouse.isPending ? "Saving..." : editing ? "Update Warehouse" : "Save Warehouse"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTarget} onOpenChange={() => setArchiveTarget(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-600" />Archive Warehouse</DialogTitle>
              <DialogDescription>Are you sure you want to archive "{deleteTarget?.name}"? It will be marked inactive and hidden from active warehouse operations.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button className="rounded-2xl bg-slate-700 text-white hover:bg-slate-800" onClick={() => setArchiveTarget(null)}>Cancel</Button>
              <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => deleteTarget && archiveWarehouse.mutate(deleteTarget)} disabled={archiveWarehouse.isPending}>{archiveWarehouse.isPending ? "Archiving..." : "Archive"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}
