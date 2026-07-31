import { useMemo, useState } from "react";
import {
  Ruler,
  Plus,
  Pencil,
  Trash2,
  Search,
  Scale,
  CheckCircle2,
  Repeat,
  BarChart3,
  PackageCheck,
  Archive,
  WifiOff,
  Wifi,
  Database,
  UploadCloud,
  RotateCcw,
  RefreshCcw,
  Eye,
  Copy,
  MoreHorizontal,
  Gauge,
  AlertTriangle,
  FileText,
  PackageX,
  Grid3X3,
  List,
  Download,
  Activity,
  ShieldCheck,
  Box,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedTable, isOnline, saveCachedTable, savePending } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
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
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useProducts, useUnits, useUnitMutations } from "@/hooks/useSupabaseData";

const CONTROL_COLOR = "#2563EB";
const PAGE_SIZE = 18;

interface Unit {
  id: string;
  tenant_id: string;
  name: string;
  abbreviation: string | null;
  description?: string | null;
  created_at: string;
  updated_at?: string | null;
  sync_status?: string;
  offline_id?: string;
  operation?: "create" | "update" | "delete";
  created_offline_at?: string;
  updated_offline_at?: string;
  status?: string;
}

type AnyRecord = Record<string, any>;

type ViewMode = "grid" | "list" | "compact";
type SmartFilter =
  | "all"
  | "used"
  | "empty"
  | "described"
  | "missing_description"
  | "pending"
  | "duplicate";
type SortKey = "created_at" | "name" | "usage" | "health";

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeKey(name: string) {
  return normalizeName(name).toLowerCase();
}

function getUnitDate(unit: any) {
  return (
    unit?.updated_offline_at ||
    unit?.updated_at ||
    unit?.created_offline_at ||
    unit?.created_at ||
    new Date().toISOString()
  );
}

function formatDate(value?: string | null) {
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
  const status = String(row?.sync_status || "").toLowerCase();
  return (
    status.includes("pending") ||
    String(row?.id || "").startsWith("offline-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at
  );
}

function isPendingDelete(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function sortByCreatedAtDesc<T extends AnyRecord>(records: T[]): T[] {
  return [...(records || [])].sort((a, b) => {
    const aDate = new Date(getUnitDate(a)).getTime();
    const bDate = new Date(getUnitDate(b)).getTime();
    return bDate - aDate;
  });
}

function dedupeUnits(units: Unit[]): Unit[] {
  const map = new Map<string, Unit>();

  for (const unit of units || []) {
    const key = String(unit.id || unit.offline_id || normalizeKey(unit.name) || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, unit);
      continue;
    }

    const existingTime = new Date(getUnitDate(existing)).getTime();
    const incomingTime = new Date(getUnitDate(unit)).getTime();

    map.set(key, incomingTime >= existingTime ? { ...existing, ...unit } : { ...unit, ...existing });
  }

  return sortByCreatedAtDesc<Unit>(Array.from(map.values()).filter((unit): unit is Unit => !isPendingDelete(unit)));
}

function getUnitUsage(unit: Unit, products: any[]) {
  const name = normalizeKey(unit.name);
  const abbr = normalizeKey(unit.abbreviation || "");

  return products.filter((product) => {
    const productUnit = normalizeKey(product.unit || product.unit_name || product.measurement_unit || "");
    return productUnit === name || (!!abbr && productUnit === abbr);
  }).length;
}

function getUnitStockValue(unit: Unit, products: any[]) {
  const name = normalizeKey(unit.name);
  const abbr = normalizeKey(unit.abbreviation || "");

  return products
    .filter((product) => {
      const productUnit = normalizeKey(product.unit || product.unit_name || product.measurement_unit || "");
      return productUnit === name || (!!abbr && productUnit === abbr);
    })
    .reduce(
      (sum, product) =>
        sum +
        Math.max(0, safeNumber(product.stock ?? product.stock_quantity)) *
          safeNumber(product.selling_price ?? product.price),
      0
    );
}

function getUnitHealth(unit: Unit, products: any[], duplicateNames: Set<string>, duplicateAbbr: Set<string>) {
  let score = 100;

  if (!unit.name) score -= 30;
  if (!unit.abbreviation) score -= 15;
  if (!unit.description) score -= 10;
  if (duplicateNames.has(normalizeKey(unit.name))) score -= 25;
  if (unit.abbreviation && duplicateAbbr.has(normalizeKey(unit.abbreviation))) score -= 20;
  if (getUnitUsage(unit, products) === 0) score -= 8;
  if (isPendingSync(unit)) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function healthLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Review";
  return "Critical";
}

function compactCurrency(value: number) {
  if (Math.abs(value) < 1_000_000) {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency: "RWF",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return `RF ${new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function makeLocalId(prefix: string) {
  try { return `${prefix}-${crypto.randomUUID()}`; } catch { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function nowIso() { return new Date().toISOString(); }

export default function Units() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: unitRows = [], isLoading } = useUnits();
  const unitMutations = useUnitMutations();

  const units = useMemo(
    () => dedupeUnits((unitRows || []) as Unit[]),
    [unitRows]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewUnit, setViewUnit] = useState<Unit | null>(null);
  const [deleteUnitRow, setDeleteUnitRow] = useState<Unit | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [search, setSearch] = useState("");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [description, setDescription] = useState("");
  const [bulkText, setBulkText] = useState("");

  const offlineModeActive = !isOnline() || isOfflineMode() || !session?.access_token;

  const duplicateNames = useMemo(() => {
    const map = new Map<string, number>();
    units.forEach((unit) => {
      const key = normalizeKey(unit.name);
      if (key) map.set(key, (map.get(key) || 0) + 1);
    });
    return new Set([...map.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [units]);

  const duplicateAbbr = useMemo(() => {
    const map = new Map<string, number>();
    units.forEach((unit) => {
      const key = normalizeKey(unit.abbreviation || "");
      if (key) map.set(key, (map.get(key) || 0) + 1);
    });
    return new Set([...map.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [units]);

  const filteredUnits = useMemo(() => {
    const q = search.toLowerCase().trim();

    const list = units.filter((unit) => {
      const usage = getUnitUsage(unit, products);
      const pending = isPendingSync(unit);
      const duplicate =
        duplicateNames.has(normalizeKey(unit.name)) ||
        (!!unit.abbreviation && duplicateAbbr.has(normalizeKey(unit.abbreviation)));

      const matchesSearch =
        !q ||
        unit.name.toLowerCase().includes(q) ||
        (unit.abbreviation || "").toLowerCase().includes(q) ||
        (unit.description || "").toLowerCase().includes(q) ||
        String(usage).includes(q);

      const matchesSmart =
        smartFilter === "all" ||
        (smartFilter === "used" && usage > 0) ||
        (smartFilter === "empty" && usage === 0) ||
        (smartFilter === "described" && !!unit.description) ||
        (smartFilter === "missing_description" && !unit.description) ||
        (smartFilter === "pending" && pending) ||
        (smartFilter === "duplicate" && duplicate);

      const matchesSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      return matchesSearch && matchesSmart && matchesSync;
    });

    list.sort((a, b) => {
      if (sortKey === "created_at") {
        const av = new Date(getUnitDate(a)).getTime();
        const bv = new Date(getUnitDate(b)).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "usage") {
        const av = getUnitUsage(a, products);
        const bv = getUnitUsage(b, products);
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "health") {
        const av = getUnitHealth(a, products, duplicateNames, duplicateAbbr);
        const bv = getUnitHealth(b, products, duplicateNames, duplicateAbbr);
        return sortAsc ? av - bv : bv - av;
      }

      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });

    return list;
  }, [
    units,
    products,
    search,
    smartFilter,
    syncFilter,
    sortKey,
    sortAsc,
    duplicateNames,
    duplicateAbbr,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filteredUnits.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const total = units.length;
    const withDescription = units.filter((u) => !!u.description).length;
    const withAbbreviation = units.filter((u) => !!u.abbreviation).length;
    const pending = units.filter(isPendingSync).length;
    const used = units.filter((u) => getUnitUsage(u, products) > 0).length;
    const empty = total - used;
    const duplicates = units.filter(
      (u) =>
        duplicateNames.has(normalizeKey(u.name)) ||
        (!!u.abbreviation && duplicateAbbr.has(normalizeKey(u.abbreviation)))
    ).length;
    const totalUsage = units.reduce((sum, u) => sum + getUnitUsage(u, products), 0);
    const totalValue = units.reduce((sum, u) => sum + getUnitStockValue(u, products), 0);
    const avgHealth = total
      ? Math.round(
          units.reduce((sum, u) => sum + getUnitHealth(u, products, duplicateNames, duplicateAbbr), 0) /
            total
        )
      : 0;

    const latest = units[0]?.abbreviation || units[0]?.name || "-";
    const topUnit = [...units].sort((a, b) => getUnitUsage(b, products) - getUnitUsage(a, products))[0];

    return {
      total,
      active: total,
      withDescription,
      withAbbreviation,
      pending,
      used,
      empty,
      duplicates,
      totalUsage,
      totalValue,
      avgHealth,
      latest,
      topUnit: topUnit?.name || "—",
      filtered: filteredUnits.length,
    };
  }, [units, products, duplicateNames, duplicateAbbr, filteredUnits.length]);

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: stats.total, icon: Ruler, color: "bg-slate-700 text-white" },
    { key: "used" as SmartFilter, label: "Used", value: stats.used, icon: PackageCheck, color: "bg-emerald-600 text-white" },
    { key: "empty" as SmartFilter, label: "Empty", value: stats.empty, icon: PackageX, color: "bg-rose-600 text-white" },
    { key: "described" as SmartFilter, label: "Described", value: stats.withDescription, icon: FileText, color: "bg-blue-600 text-white" },
    { key: "missing_description" as SmartFilter, label: "No Desc.", value: stats.total - stats.withDescription, icon: AlertTriangle, color: "bg-amber-600 text-white" },
    { key: "duplicate" as SmartFilter, label: "Duplicates", value: stats.duplicates, icon: Copy, color: "bg-orange-600 text-white" },
    { key: "pending" as SmartFilter, label: "Pending", value: stats.pending, icon: UploadCloud, color: "bg-violet-600 text-white" },
  ];

  const exportRows = filteredUnits.map((unit) => ({
    name: unit.name,
    abbreviation: unit.abbreviation || "",
    description: unit.description || "",
    usage: getUnitUsage(unit, products),
    stock_value: compactCurrency(getUnitStockValue(unit, products)),
    health: `${getUnitHealth(unit, products, duplicateNames, duplicateAbbr)}%`,
    sync_status: isPendingSync(unit) ? "Pending" : "Synced",
    created_at: formatDate(unit.created_at || unit.created_offline_at),
  }));

  const exportCols = [
    { key: "name" as const, label: "Unit" },
    { key: "abbreviation" as const, label: "Abbreviation" },
    { key: "description" as const, label: "Description" },
    { key: "usage" as const, label: "Products" },
    { key: "stock_value" as const, label: "Stock Value" },
    { key: "health" as const, label: "Health" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "created_at" as const, label: "Created" },
  ];

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["units"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const saveUnitsCache = async (rows: Unit[]) => {
    const cleaned = dedupeUnits(rows);
    await saveCachedTable("units", cleaned);
    queryClient.setQueryData(["units"], cleaned);
    await refreshQueries();
    return cleaned;
  };

  const saveUnitOffline = async (payload: Partial<Unit>, mode: "create" | "update", target?: Unit) => {
    const now = nowIso();
    const cached = await getCachedTable("units");
    const cachedRows = Array.isArray(cached) ? (cached as Unit[]) : units;
    const isOfflineTarget = !!target && (String(target.id || "").startsWith("offline-") || !!target.offline_id);

    const row: Unit = {
      ...(target || {}),
      ...payload,
      id: target?.id || makeLocalId("offline-unit"),
      tenant_id: target?.tenant_id || tenantId || "offline",
      name: payload.name || target?.name || "",
      abbreviation: payload.abbreviation ?? target?.abbreviation ?? null,
      description: payload.description ?? target?.description ?? null,
      created_at: target?.created_at || now,
      updated_at: now,
      status: payload.status || target?.status || "active",
      operation: isOfflineTarget || mode === "create" ? "create" : "update",
      sync_status: isOfflineTarget || mode === "create" ? "pending" : "pending_update",
      created_offline_at: target?.created_offline_at || (mode === "create" ? now : undefined),
      updated_offline_at: now,
    };

    await saveUnitsCache([row, ...cachedRows]);
    await savePending("units", row as any);
    toast.success(mode === "create" ? "Unit saved offline. It will sync later." : "Unit update saved offline. It will sync later.");
    return row;
  };

  const archiveUnitOffline = async (unit: Unit) => {
    const cached = await getCachedTable("units");
    const cachedRows = Array.isArray(cached) ? (cached as Unit[]) : units;
    const archived = { ...unit, status: "deleted", operation: "delete", sync_status: "pending_delete", updated_offline_at: nowIso() } as Unit;
    await savePending("units", archived as any);
    await saveUnitsCache(cachedRows.map((row) => String(row.id) === String(unit.id) ? archived : row));
    toast.success("Unit archive saved offline. It will sync later.");
  };

  const createUnit = {
    isPending: unitMutations.create.isPending,
    mutate: () => {
      const normalized = normalizeName(name);

      if (!normalized) {
        toast.error("Unit name is required");
        return;
      }

      const duplicate = units.some((u) => normalizeKey(u.name) === normalizeKey(normalized));
      if (duplicate) {
        toast.error("A unit with this name already exists");
        return;
      }

      const payload = {
        name: normalized,
        abbreviation: abbreviation.trim() || null,
        description: description.trim() || null,
        status: "active",
      } as Partial<Unit>;

      if (offlineModeActive) {
        saveUnitOffline(payload, "create").then(() => closeDialog());
        return;
      }

      unitMutations.create.mutate(payload as any, {
        onSuccess: () => {
          refreshQueries();
          closeDialog();
        },
        onError: (error: any) => toast.error(error?.message || "Failed to save unit"),
      });
    },
  };

  const updateUnit = {
    isPending: unitMutations.update.isPending,
    mutate: () => {
      if (!editing) {
        toast.error("No unit selected");
        return;
      }

      const normalized = normalizeName(name);

      if (!normalized) {
        toast.error("Unit name is required");
        return;
      }

      const duplicate = units.some(
        (u) => u.id !== editing.id && normalizeKey(u.name) === normalizeKey(normalized)
      );

      if (duplicate) {
        toast.error("A unit with this name already exists");
        return;
      }

      const payload = {
        name: normalized,
        abbreviation: abbreviation.trim() || null,
        description: description.trim() || null,
        status: editing.status || "active",
      } as Partial<Unit>;

      if (offlineModeActive || String(editing.id || "").startsWith("offline-") || !!editing.offline_id) {
        saveUnitOffline(payload, "update", editing).then(() => closeDialog());
        return;
      }

      unitMutations.update.mutate({ id: editing.id, ...payload } as any, {
        onSuccess: () => {
          refreshQueries();
          closeDialog();
        },
        onError: (error: any) => toast.error(error?.message || "Failed to update unit"),
      });
    },
  };

  const deleteUnit = {
    isPending: unitMutations.remove.isPending,
    mutate: (unit: Unit) => {
      if (getUnitUsage(unit, products) > 0) {
        toast.error("This unit is used by products. Reassign those products before deleting.");
        return;
      }

      if (offlineModeActive || String(unit.id || "").startsWith("offline-") || !!unit.offline_id) {
        archiveUnitOffline(unit).then(() => setDeleteUnitRow(null));
        return;
      }

      unitMutations.update.mutate({ id: unit.id, status: "deleted" } as any, {
        onSuccess: () => {
          refreshQueries();
          setDeleteUnitRow(null);
        },
        onError: (error: any) => toast.error(error?.message || "Failed to archive unit"),
      });
    },
  };

  const bulkCreateUnits = async () => {
    const rows = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [unitName, unitAbbreviation, unitDescription] = line.split("|").map((part) => part?.trim());
        return {
          name: normalizeName(unitName),
          abbreviation: unitAbbreviation || "",
          description: unitDescription || "",
        };
      })
      .filter((row) => row.name);

    if (!rows.length) {
      toast.error("Add at least one unit name.");
      return;
    }

    const existing = new Set(units.map((u) => normalizeKey(u.name)));
    const uniqueRows = rows.filter((row) => !existing.has(normalizeKey(row.name)));

    if (!uniqueRows.length) {
      toast.error("All pasted units already exist.");
      return;
    }

    try {
      if (offlineModeActive) {
        for (const row of uniqueRows) {
          await saveUnitOffline({
            name: row.name,
            abbreviation: row.abbreviation || null,
            description: row.description || null,
            status: "active",
          }, "create");
        }
      } else {
        for (const row of uniqueRows) {
          await unitMutations.create.mutateAsync({
            name: row.name,
            abbreviation: row.abbreviation || null,
            description: row.description || null,
            status: "active",
          } as any);
        }
      }

      setBulkOpen(false);
      setBulkText("");
      await refreshQueries();
      toast.success(`${uniqueRows.length} units imported.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to import units");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setAbbreviation("");
    setDescription("");
    setDialogOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setName(unit.name);
    setAbbreviation(unit.abbreviation || "");
    setDescription(unit.description || "");
    setDialogOpen(true);
  };

  const duplicateUnit = (unit: Unit) => {
    setEditing(null);
    setName(`${unit.name} Copy`);
    setAbbreviation("");
    setDescription(unit.description || "");
    setDialogOpen(true);
    toast.info("Unit copied. Rename it before saving.");
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setName("");
    setAbbreviation("");
    setDescription("");
  };

  const handleSave = () => {
    if (editing) updateUnit.mutate();
    else createUnit.mutate();
  };

  const resetFilters = () => {
    setSearch("");
    setSmartFilter("all");
    setSyncFilter("all");
    setSortKey("created_at");
    setSortAsc(false);
    setPage(1);
  };

  const UnitMenu = ({ unit }: { unit: Unit }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewUnit(unit)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => openEdit(unit)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => duplicateUnit(unit)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-destructive"
          onClick={() => setDeleteUnitRow(unit)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const UnitCard = ({ unit }: { unit: Unit }) => {
    const usage = getUnitUsage(unit, products);
    const value = getUnitStockValue(unit, products);
    const health = getUnitHealth(unit, products, duplicateNames, duplicateAbbr);
    const pending = isPendingSync(unit);
    const duplicate =
      duplicateNames.has(normalizeKey(unit.name)) ||
      (!!unit.abbreviation && duplicateAbbr.has(normalizeKey(unit.abbreviation)));

    return (
      <div className="rounded-3xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-white"
              style={{ background: CONTROL_COLOR }}
            >
              <Ruler className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setViewUnit(unit)}
                className="block max-w-[240px] truncate text-left font-bold hover:text-primary"
              >
                {unit.name}
              </button>
              <p className="mt-1 text-xs text-muted-foreground">
                {unit.abbreviation || "No abbreviation"}
              </p>
            </div>
          </div>

          <UnitMenu unit={unit} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className={pending ? "rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30" : "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
            {pending ? "Pending" : "Synced"}
          </Badge>
          {duplicate && (
            <Badge variant="outline" className="rounded-full bg-orange-500/10 text-orange-600 border-orange-500/30">
              Duplicate
            </Badge>
          )}
          <Badge variant="secondary" className="rounded-full">
            {usage} products
          </Badge>
        </div>

        <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">
          {unit.description || "No description"}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Stock Value</p>
            <p className="mt-1 truncate font-data text-sm font-bold">{compactCurrency(value)}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Created</p>
            <p className="mt-1 truncate text-sm font-medium">{formatDate(unit.created_at).split(",")[0]}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Unit Health</span>
            <span>{health}%</span>
          </div>
          <Progress value={health} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="sm" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={() => setViewUnit(unit)}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            View
          </Button>
          <Button size="sm" className="rounded-xl bg-amber-600 text-white hover:bg-amber-700" onClick={() => openEdit(unit)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>
    );
  };

  const kpis = [
    {
      label: "Units",
      value: stats.total,
      icon: Ruler,
      color: "bg-rose-600 text-white border-rose-500",
      helper: "unit records",
    },
    {
      label: "Used",
      value: stats.used,
      icon: PackageCheck,
      color: "bg-emerald-600 text-white border-emerald-500",
      helper: "linked products",
    },
    {
      label: "Stock Value",
      value: compactCurrency(stats.totalValue),
      icon: BarChart3,
      color: "bg-violet-600 text-white border-violet-500",
      helper: "retail unit value",
    },
    {
      label: "Health",
      value: `${stats.avgHealth}%`,
      icon: Gauge,
      color: stats.avgHealth >= 70 ? "bg-orange-600 text-white border-orange-500" : "bg-orange-600 text-white border-orange-500",
      helper: healthLabel(stats.avgHealth),
    },
  ];

  return (
    <PageShell
      title="Units of Measure"
      description="Manage unit standards, abbreviations, purchase/selling measurements, stock value, product usage, offline unit changes, and reporting readiness."
    >
      <PageBackground image={warehouseBg} opacity={0.035}>
        <div className="space-y-5">
          {(offlineModeActive || stats.pending > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "Units are using cached offline data" : "Unit changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending unit records: {stats.pending}. Products, POS, purchases, stock counts, and reports update after sync.
                    </p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border bg-card shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0"
                  style={{ background: CONTROL_COLOR }}
                >
                  <Ruler className="w-6 h-6" />
                </div>

                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/20 mb-3">
                    <Scale className="mr-1 h-3.5 w-3.5" />
                    Unit Operations Center
                  </Badge>

                  <h2 className="text-xl font-bold tracking-tight">Units of Measure Control</h2>

                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Define and audit product units used in inventory, purchases, sales, stock counts,
                    transfers, barcode labels, packaging levels, and reports. Keep measurement names,
                    abbreviations, and selling/purchase unit references consistent.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-4">
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Top Unit</p>
                      <p className="text-sm font-semibold truncate">{stats.topUnit}</p>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Latest</p>
                      <p className="text-sm font-semibold truncate">{stats.latest}</p>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Product Links</p>
                      <p className="text-sm font-semibold font-data">{stats.totalUsage}</p>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Filtered</p>
                      <p className="text-sm font-semibold font-data">{stats.filtered}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 gap-3">
              {kpis.map((item) => {
                const Icon = item.icon;
                const valueClass = String(item.value).length > 13 ? "text-base xl:text-lg break-words" : "text-2xl";

                return (
                  <div
                    key={item.label}
                    className={`rounded-2xl border bg-card shadow-sm p-3 ${item.color}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">{item.label}</p>
                        <p className={`${valueClass} font-bold font-data mt-1`}>
                          {item.value}
                        </p>
                        <p className="text-[11px] opacity-70 truncate">{item.helper}</p>
                      </div>

                      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
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
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="font-data text-lg font-black">{card.value}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl text-white flex items-center justify-center"
                  style={{ background: CONTROL_COLOR }}
                >
                  <ShieldCheck className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-semibold">Unit Health</h3>
                  <p className="text-xs text-muted-foreground">Completeness and structure signals</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Health Score", value: `${stats.avgHealth}%`, icon: Gauge, tone: "bg-blue-500/10 text-blue-700" },
                  { label: "Empty Units", value: stats.empty, icon: PackageX, tone: "bg-rose-500/10 text-rose-700" },
                  { label: "Missing Abbrev.", value: stats.total - stats.withAbbreviation, icon: Scale, tone: "bg-amber-500/10 text-amber-700" },
                  { label: "Duplicates", value: stats.duplicates, icon: Copy, tone: "bg-orange-500/10 text-orange-700" },
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

            <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-semibold">Unit Value</h3>
                  <p className="text-xs text-muted-foreground">Retail stock value by unit</p>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Total Unit Stock Value</p>
                <p className="text-2xl font-black font-data mt-1">{compactCurrency(stats.totalValue)}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Across {stats.totalUsage} linked product records
                </p>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span>Used units</span>
                  <span className="font-data">{stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0}%</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.used / stats.total) * 100 : 0} />
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border bg-card shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-semibold">Unit Workflow</h3>
                  <p className="text-xs text-muted-foreground">Best practices for accurate stock</p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl bg-blue-600 p-4 text-white">
                  <p className="text-sm font-bold">Selling unit control</p>
                  <p className="mt-1 text-xs text-white/80">
                    Keep POS units short and readable, such as PCS, KG, L, Box, and CTN.
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-600 p-4 text-white">
                  <p className="text-sm font-bold">Purchase packaging</p>
                  <p className="mt-1 text-xs text-white/80">
                    Track supplier packaging names consistently before adding pack-size conversion rules.
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-600 p-4 text-white">
                  <p className="text-sm font-bold">Conversion readiness</p>
                  <p className="mt-1 text-xs text-white/80">
                    Use clean abbreviations now so cartons, cases, boxes, and pieces can convert safely later.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-col gap-4 border-b p-4 lg:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">Units Directory</h2>
                    <Badge variant="outline" className="rounded-full">
                      {offlineModeActive ? (
                        <WifiOff className="mr-1 h-3 w-3 text-amber-600" />
                      ) : (
                        <Wifi className="mr-1 h-3 w-3 text-emerald-600" />
                      )}
                      {offlineModeActive ? "Offline cache" : "Live online"}
                    </Badge>
                    {stats.pending > 0 && (
                      <Badge className="rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/10">
                        <UploadCloud className="mr-1 h-3 w-3" />
                        {stats.pending} pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredUnits.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {Math.min(currentPage * PAGE_SIZE, filteredUnits.length)} of {filteredUnits.length} units
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ExportMenu
                    onCSV={() => exportToCSV(exportRows, "units", exportCols)}
                    onPDF={() =>
                      exportToPDF(exportRows, "units", "Units Enterprise Report", exportCols, {
                        subtitle: `${filteredUnits.length} unit records`,
                        summary: [
                          { label: "Units", value: String(stats.total) },
                          { label: "Used", value: String(stats.used) },
                          { label: "Empty", value: String(stats.empty) },
                          { label: "Stock Value", value: compactCurrency(stats.totalValue) },
                          { label: "Pending Sync", value: String(stats.pending) },
                        ],
                      })
                    }
                  />

                  <Button className="rounded-xl h-10 bg-amber-600 text-white hover:bg-amber-700" onClick={() => setBulkOpen(true)}>
                    <Download className="w-4 h-4 mr-2" />
                    Bulk Import
                  </Button>

                  <Button className="rounded-xl h-10 bg-cyan-600 text-white hover:bg-cyan-700" onClick={refreshQueries}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>

                  <div className="flex rounded-2xl border bg-muted/40 p-1">
                    {[
                      { key: "grid" as ViewMode, label: "Grid", icon: Grid3X3 },
                      { key: "list" as ViewMode, label: "List", icon: List },
                      { key: "compact" as ViewMode, label: "Compact", icon: Ruler },
                    ].map((mode) => (
                      <Button
                        key={mode.key}
                        type="button"
                        size="sm"
                        variant={viewMode === mode.key ? "default" : "ghost"}
                        className={`rounded-xl h-8 px-3 ${viewMode === mode.key ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}
                        onClick={() => setViewMode(mode.key)}
                      >
                        <mode.icon className="w-4 h-4 mr-1.5" />
                        {mode.label}
                      </Button>
                    ))}
                  </div>

                  <Button onClick={openCreate} className="h-9 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Unit
                  </Button>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search units, abbreviations, descriptions, product usage count..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 rounded-xl pl-10"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={syncFilter}
                    onChange={(e) => {
                      setSyncFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 rounded-xl border bg-background px-3 text-xs"
                  >
                    <option value="all">All Sync</option>
                    <option value="synced">Synced</option>
                    <option value="pending">Pending</option>
                  </select>

                  <select
                    value={`${sortKey}:${sortAsc ? "asc" : "desc"}`}
                    onChange={(e) => {
                      const [key, direction] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
                      setSortKey(key);
                      setSortAsc(direction === "asc");
                      setPage(1);
                    }}
                    className="h-10 rounded-xl border bg-background px-3 text-xs"
                  >
                    <option value="created_at:desc">Newest</option>
                    <option value="name:asc">Name A-Z</option>
                    <option value="name:desc">Name Z-A</option>
                    <option value="usage:desc">Most Used</option>
                    <option value="usage:asc">Least Used</option>
                    <option value="health:desc">Best Health</option>
                    <option value="health:asc">Needs Review</option>
                  </select>

                  <Button variant="ghost" className="h-10 rounded-xl text-blue-700" onClick={resetFilters}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 lg:p-5">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading units...</div>
              ) : filteredUnits.length === 0 ? (
                <div className="rounded-3xl border border-blue-200 bg-blue-50 text-center py-16 text-blue-800">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-sm">
                    <Ruler className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-bold">No units found</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-blue-700/80">
                    Create units such as Piece, Carton, Kilogram, Liter, Box, or Case to keep products,
                    purchases, stock counts, and reports consistent.
                  </p>
                  <Button onClick={openCreate} className="mt-5 rounded-2xl bg-blue-600 text-white hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Unit
                  </Button>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {paged.map((unit) => (
                    <UnitCard key={unit.id} unit={unit} />
                  ))}
                </div>
              ) : viewMode === "list" ? (
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[950px] text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Unit</th>
                        <th className="px-4 py-3 text-left font-medium">Abbreviation</th>
                        <th className="px-4 py-3 text-left font-medium">Description</th>
                        <th className="px-4 py-3 text-left font-medium">Products</th>
                        <th className="px-4 py-3 text-left font-medium">Stock Value</th>
                        <th className="px-4 py-3 text-left font-medium">Health</th>
                        <th className="px-4 py-3 text-left font-medium">Sync</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {paged.map((unit) => {
                        const health = getUnitHealth(unit, products, duplicateNames, duplicateAbbr);

                        return (
                          <tr key={unit.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-xl text-white flex items-center justify-center shrink-0" style={{ background: CONTROL_COLOR }}>
                                  <Ruler className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <button type="button" onClick={() => setViewUnit(unit)} className="font-semibold hover:text-primary truncate block max-w-[240px]">
                                    {unit.name}
                                  </button>
                                  <p className="text-xs text-muted-foreground">{formatDate(unit.created_at).split(",")[0]}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-data">{unit.abbreviation || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[280px]">{unit.description || "No description"}</td>
                            <td className="px-4 py-3 font-data">{getUnitUsage(unit, products)}</td>
                            <td className="px-4 py-3 font-data">{compactCurrency(getUnitStockValue(unit, products))}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${health}%` }} />
                                </div>
                                <span className="text-xs">{health}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={isPendingSync(unit) ? "rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30" : "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
                                {isPendingSync(unit) ? "Pending" : "Synced"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <UnitMenu unit={unit} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {paged.map((unit) => (
                    <div key={unit.id} className="rounded-2xl border bg-card p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl text-white flex items-center justify-center" style={{ background: CONTROL_COLOR }}>
                          <Ruler className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{unit.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{unit.abbreviation || "—"} · {getUnitUsage(unit, products)} products</p>
                        </div>
                        <UnitMenu unit={unit} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t px-4 lg:px-5 py-4">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages} · {filteredUnits.length} units
                </p>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
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
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                    ›
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Unit" : "Add Unit"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update this product unit. Offline changes will sync later."
                  : "Create a new product unit for this workspace."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Unit Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kilogram"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Abbreviation</label>
                <Input
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                  placeholder="e.g. KG"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="rounded-xl"
                />
              </div>

              {offlineModeActive && (
                <div className="rounded-2xl border bg-amber-500/10 p-3 text-sm text-amber-700">
                  This unit will be saved locally and synced when internet returns.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={createUnit.isPending || updateUnit.isPending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {editing ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>Bulk Import Units</DialogTitle>
              <DialogDescription>
                Paste one unit per line. Use “Unit Name | Abbreviation | Description”.
              </DialogDescription>
            </DialogHeader>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Kilogram | KG | Weight measurement\nPiece | PCS | Single item count\nCarton | CTN | Box/carton quantity"}
              className="min-h-[220px] w-full rounded-2xl border bg-background p-4 text-sm outline-none"
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)}>
                Cancel
              </Button>
              <Button onClick={bulkCreateUnits} className="bg-blue-600 text-white hover:bg-blue-700">
                Import Units
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewUnit} onOpenChange={() => setViewUnit(null)}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{viewUnit?.name}</DialogTitle>
              <DialogDescription>Unit details, usage, value, health, and sync status.</DialogDescription>
            </DialogHeader>

            {viewUnit && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 rounded-3xl border bg-muted/30 p-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-white" style={{ background: CONTROL_COLOR }}>
                    <Ruler className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold">{viewUnit.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {viewUnit.abbreviation || "No abbreviation"} · {viewUnit.description || "No description"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["Products", getUnitUsage(viewUnit, products)],
                    ["Stock Value", compactCurrency(getUnitStockValue(viewUnit, products))],
                    ["Health", `${getUnitHealth(viewUnit, products, duplicateNames, duplicateAbbr)}%`],
                    ["Created", formatDate(viewUnit.created_at).split(",")[0]],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-medium break-words">{String(value)}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Unit Health</span>
                    <span>{getUnitHealth(viewUnit, products, duplicateNames, duplicateAbbr)}%</span>
                  </div>
                  <Progress value={getUnitHealth(viewUnit, products, duplicateNames, duplicateAbbr)} />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => viewUnit && duplicateUnit(viewUnit)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <Button
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => {
                  if (viewUnit) openEdit(viewUnit);
                  setViewUnit(null);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteUnitRow} onOpenChange={() => setDeleteUnitRow(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Archive Unit</DialogTitle>
              <DialogDescription>
                Are you sure you want to archive "{deleteUnitRow?.name}"? Units used by products cannot be archived until products are reassigned.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteUnitRow(null)}>
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={() => deleteUnitRow && deleteUnit.mutate(deleteUnitRow)}
                disabled={deleteUnit.isPending}
              >
                Archive
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}