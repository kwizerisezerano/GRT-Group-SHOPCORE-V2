import { useMemo, useState } from "react";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Package,
  Factory,
  Building2,
  BarChart3,
  ShieldCheck,
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
  PackageCheck,
  PackageX,
  TrendingUp,
  Grid3X3,
  List,
  Download,
  Activity,
  Box,
  Archive,
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
import { useProducts, useBrands, useBrandMutations } from "@/hooks/useSupabaseData";

const CONTROL_COLOR = "#2563EB";
const PAGE_SIZE = 18;

interface Brand {
  id: string;
  tenant_id: string;
  name: string;
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
type SmartFilter = "all" | "used" | "empty" | "described" | "missing_description" | "pending" | "duplicate";
type SortKey = "created_at" | "name" | "usage" | "health" | "value";

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

function getBrandDate(brand: any) {
  return (
    brand?.updated_offline_at ||
    brand?.updated_at ||
    brand?.created_offline_at ||
    brand?.created_at ||
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

function sortByCreatedAtDesc<T extends AnyRecord>(records: T[]): T[] {
  return [...(records || [])].sort((a, b) => {
    const aDate = new Date(getBrandDate(a)).getTime();
    const bDate = new Date(getBrandDate(b)).getTime();
    return bDate - aDate;
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

function isPendingArchive(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function dedupeBrands(brands: Brand[]): Brand[] {
  const map = new Map<string, Brand>();

  for (const brand of brands || []) {
    const key = String(brand.id || brand.offline_id || normalizeKey(brand.name) || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, brand);
      continue;
    }

    const existingTime = new Date(getBrandDate(existing)).getTime();
    const incomingTime = new Date(getBrandDate(brand)).getTime();

    map.set(
      key,
      incomingTime >= existingTime ? { ...existing, ...brand } : { ...brand, ...existing }
    );
  }

  return sortByCreatedAtDesc<Brand>(
    Array.from(map.values()).filter((brand): brand is Brand => !isPendingArchive(brand))
  );
}

function getBrandUsage(brandName: string, products: any[]) {
  const key = normalizeKey(brandName);
  return products.filter((product) => normalizeKey(product.brand || "") === key).length;
}

function getBrandStockValue(brandName: string, products: any[]) {
  const key = normalizeKey(brandName);
  return products
    .filter((product) => normalizeKey(product.brand || "") === key)
    .reduce(
      (sum, product) =>
        sum +
        Math.max(0, safeNumber(product.stock ?? product.stock_quantity)) *
          safeNumber(product.selling_price ?? product.price),
      0
    );
}

function getBrandCostValue(brandName: string, products: any[]) {
  const key = normalizeKey(brandName);
  return products
    .filter((product) => normalizeKey(product.brand || "") === key)
    .reduce(
      (sum, product) =>
        sum +
        Math.max(0, safeNumber(product.stock ?? product.stock_quantity)) *
          safeNumber(product.cost_price ?? product.purchase_price),
      0
    );
}

function getBrandPotentialProfit(brandName: string, products: any[]) {
  return Math.max(0, getBrandStockValue(brandName, products) - getBrandCostValue(brandName, products));
}

function getBrandHealth(brand: Brand, products: any[], duplicateNames: Set<string>) {
  let score = 100;

  if (!brand.name) score -= 30;
  if (!brand.description) score -= 12;
  if (duplicateNames.has(normalizeKey(brand.name))) score -= 25;
  if (getBrandUsage(brand.name, products) === 0) score -= 10;
  if (isPendingSync(brand)) score -= 5;

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

function brandAvatarColor(name: string) {
  const palette = [
    "bg-violet-600",
    "bg-blue-600",
    "bg-emerald-600",
    "bg-orange-600",
    "bg-rose-600",
    "bg-cyan-600",
  ];

  const code = normalizeName(name).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[code % palette.length];
}

function brandInitial(name: string) {
  return normalizeName(name).charAt(0).toUpperCase() || "B";
}

function makeLocalId(prefix: string) {
  try { return `${prefix}-${crypto.randomUUID()}`; } catch { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function nowIso() {
  return new Date().toISOString();
}

export default function Brands() {
  const { tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: brandRows = [], isLoading } = useBrands();
  const brandMutations = useBrandMutations();

  const brands = useMemo(
    () => dedupeBrands((brandRows || []) as Brand[]),
    [brandRows]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewBrand, setViewBrand] = useState<Brand | null>(null);
  const [deleteBrandRow, setDeleteBrandRow] = useState<Brand | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [search, setSearch] = useState("");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bulkText, setBulkText] = useState("");

  const offlineModeActive = !isOnline() || isOfflineMode() || !session?.access_token;

  const duplicateNames = useMemo(() => {
    const map = new Map<string, number>();
    brands.forEach((brand) => {
      const key = normalizeKey(brand.name);
      if (key) map.set(key, (map.get(key) || 0) + 1);
    });
    return new Set([...map.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [brands]);

  const filteredBrands = useMemo(() => {
    const q = search.toLowerCase().trim();

    const list = brands.filter((brand) => {
      const usage = getBrandUsage(brand.name, products);
      const pending = isPendingSync(brand);
      const duplicate = duplicateNames.has(normalizeKey(brand.name));

      const matchesSearch =
        !q ||
        brand.name.toLowerCase().includes(q) ||
        (brand.description || "").toLowerCase().includes(q) ||
        String(usage).includes(q);

      const matchesSmart =
        smartFilter === "all" ||
        (smartFilter === "used" && usage > 0) ||
        (smartFilter === "empty" && usage === 0) ||
        (smartFilter === "described" && !!brand.description) ||
        (smartFilter === "missing_description" && !brand.description) ||
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
        const av = new Date(getBrandDate(a)).getTime();
        const bv = new Date(getBrandDate(b)).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "usage") {
        const av = getBrandUsage(a.name, products);
        const bv = getBrandUsage(b.name, products);
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "health") {
        const av = getBrandHealth(a, products, duplicateNames);
        const bv = getBrandHealth(b, products, duplicateNames);
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "value") {
        const av = getBrandStockValue(a.name, products);
        const bv = getBrandStockValue(b.name, products);
        return sortAsc ? av - bv : bv - av;
      }

      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });

    return list;
  }, [brands, products, search, smartFilter, syncFilter, sortKey, sortAsc, duplicateNames]);

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filteredBrands.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const total = brands.length;
    const withDescription = brands.filter((b) => !!b.description).length;
    const pending = brands.filter(isPendingSync).length;
    const used = brands.filter((b) => getBrandUsage(b.name, products) > 0).length;
    const empty = total - used;
    const duplicates = brands.filter((b) => duplicateNames.has(normalizeKey(b.name))).length;
    const totalUsage = brands.reduce((sum, b) => sum + getBrandUsage(b.name, products), 0);
    const totalValue = brands.reduce((sum, b) => sum + getBrandStockValue(b.name, products), 0);
    const potentialProfit = brands.reduce((sum, b) => sum + getBrandPotentialProfit(b.name, products), 0);
    const avgHealth = total
      ? Math.round(brands.reduce((sum, b) => sum + getBrandHealth(b, products, duplicateNames), 0) / total)
      : 0;
    const latest = brands[0]?.name || "-";
    const topBrand = [...brands].sort((a, b) => getBrandStockValue(b.name, products) - getBrandStockValue(a.name, products))[0];

    return {
      total,
      active: total,
      withDescription,
      pending,
      used,
      empty,
      duplicates,
      totalUsage,
      totalValue,
      potentialProfit,
      avgHealth,
      latest,
      topBrand: topBrand?.name || "—",
      filtered: filteredBrands.length,
    };
  }, [brands, products, duplicateNames, filteredBrands.length]);

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: stats.total, icon: Layers, color: "bg-slate-700 text-white" },
    { key: "used" as SmartFilter, label: "Used", value: stats.used, icon: PackageCheck, color: "bg-emerald-600 text-white" },
    { key: "empty" as SmartFilter, label: "Empty", value: stats.empty, icon: PackageX, color: "bg-rose-600 text-white" },
    { key: "described" as SmartFilter, label: "Described", value: stats.withDescription, icon: FileText, color: "bg-blue-600 text-white" },
    { key: "missing_description" as SmartFilter, label: "No Desc.", value: stats.total - stats.withDescription, icon: AlertTriangle, color: "bg-amber-600 text-white" },
    { key: "duplicate" as SmartFilter, label: "Duplicates", value: stats.duplicates, icon: Copy, color: "bg-orange-600 text-white" },
    { key: "pending" as SmartFilter, label: "Pending", value: stats.pending, icon: UploadCloud, color: "bg-violet-600 text-white" },
  ];

  const exportRows = filteredBrands.map((brand) => ({
    name: brand.name,
    description: brand.description || "",
    usage: getBrandUsage(brand.name, products),
    stock_value: compactCurrency(getBrandStockValue(brand.name, products)),
    potential_profit: compactCurrency(getBrandPotentialProfit(brand.name, products)),
    health: `${getBrandHealth(brand, products, duplicateNames)}%`,
    sync_status: isPendingSync(brand) ? "Pending" : "Synced",
    created_at: formatDate(brand.created_at || brand.created_offline_at),
  }));

  const exportCols = [
    { key: "name" as const, label: "Brand" },
    { key: "description" as const, label: "Description" },
    { key: "usage" as const, label: "Products" },
    { key: "stock_value" as const, label: "Stock Value" },
    { key: "potential_profit" as const, label: "Potential Profit" },
    { key: "health" as const, label: "Health" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "created_at" as const, label: "Created" },
  ];

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["brands"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const saveBrandsCache = async (rows: Brand[]) => {
    const cleaned = dedupeBrands(rows);
    await saveCachedTable("brands", cleaned);
    queryClient.setQueryData(["brands"], cleaned);
    await refreshQueries();
    return cleaned;
  };

  const saveBrandOffline = async (payload: Partial<Brand>, mode: "create" | "update", target?: Brand) => {
    const now = nowIso();
    const cached = await getCachedTable("brands");
    const cachedRows = Array.isArray(cached) ? (cached as Brand[]) : brands;
    const isOfflineTarget = !!target && (String(target.id || "").startsWith("offline-") || !!target.offline_id);
    const row: Brand = { ...(target || {}), ...payload, id: target?.id || makeLocalId("offline-brand"), tenant_id: target?.tenant_id || tenantId || "offline", created_at: target?.created_at || now, updated_at: now, status: payload.status || target?.status || "active", operation: isOfflineTarget || mode === "create" ? "create" : "update", sync_status: isOfflineTarget || mode === "create" ? "pending" : "pending_update", created_offline_at: target?.created_offline_at || (mode === "create" ? now : undefined), updated_offline_at: now } as Brand;
    await saveBrandsCache([row, ...cachedRows]);
    await savePending("brands", row as any);
    toast.success(mode === "create" ? "Brand saved offline. It will sync later." : "Brand update saved offline. It will sync later.");
    return row;
  };

  const archiveBrandOffline = async (brand: Brand) => {
    const cached = await getCachedTable("brands");
    const cachedRows = Array.isArray(cached) ? (cached as Brand[]) : brands;
    const archived = { ...brand, status: "deleted", operation: "delete", sync_status: "pending_delete", updated_offline_at: nowIso() } as Brand;
    await savePending("brands", archived as any);
    await saveBrandsCache(cachedRows.map((row: Brand) => String(row.id) === String(brand.id) ? archived : row));
    toast.success("Brand archive saved offline. It will sync later.");
  };

  const createBrand = {
    isPending: brandMutations.create.isPending,
    mutate: () => {
      const normalized = normalizeName(name);

      if (!normalized) {
        toast.error("Brand name is required");
        return;
      }

      const duplicate = brands.some((b) => normalizeKey(b.name) === normalizeKey(normalized));
      if (duplicate) {
        toast.error("A brand with this name already exists");
        return;
      }

      if (offlineModeActive) {
        saveBrandOffline({ name: normalized, description: description.trim() || null, status: "active" } as any, "create").then(() => closeDialog());
        return;
      }

      brandMutations.create.mutate(
        {
          name: normalized,
          description: description.trim() || null,
          status: "active",
        } as any,
        {
          onSuccess: () => {
            refreshQueries();
            closeDialog();
          },
          onError: (error: any) => toast.error(error?.message || "Failed to save brand"),
        }
      );
    },
  };

  const updateBrand = {
    isPending: brandMutations.update.isPending,
    mutate: () => {
      if (!editing) {
        toast.error("No brand selected");
        return;
      }

      const normalized = normalizeName(name);

      if (!normalized) {
        toast.error("Brand name is required");
        return;
      }

      const duplicate = brands.some(
        (b) => b.id !== editing.id && normalizeKey(b.name) === normalizeKey(normalized)
      );

      if (duplicate) {
        toast.error("A brand with this name already exists");
        return;
      }

      if (offlineModeActive || String(editing.id || "").startsWith("offline-") || !!editing.offline_id) {
        saveBrandOffline({ name: normalized, description: description.trim() || null, status: editing.status || "active" } as any, "update", editing).then(() => closeDialog());
        return;
      }

      brandMutations.update.mutate(
        {
          id: editing.id,
          name: normalized,
          description: description.trim() || null,
          status: editing.status || "active",
        } as any,
        {
          onSuccess: () => {
            refreshQueries();
            closeDialog();
          },
          onError: (error: any) => toast.error(error?.message || "Failed to update brand"),
        }
      );
    },
  };

  const deleteBrand = {
    isPending: brandMutations.remove.isPending,
    mutate: (brand: Brand) => {
      if (getBrandUsage(brand.name, products) > 0) {
        toast.error("This brand is used by products. Reassign those products before archiving.");
        return;
      }

      if (offlineModeActive || String(brand.id || "").startsWith("offline-") || !!brand.offline_id) {
        archiveBrandOffline(brand).then(() => setDeleteBrandRow(null));
        return;
      }

      brandMutations.update.mutate({ id: brand.id, status: "deleted" } as any, {
        onSuccess: () => {
          refreshQueries();
          setDeleteBrandRow(null);
        },
        onError: (error: any) => toast.error(error?.message || "Failed to archive brand"),
      });
    },
  };

  const bulkCreateBrands = async () => {
    const rows = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [brandName, brandDescription] = line.split("|").map((part) => part?.trim());
        return { name: normalizeName(brandName), description: brandDescription || "" };
      })
      .filter((row) => row.name);

    if (!rows.length) {
      toast.error("Add at least one brand name.");
      return;
    }

    const existing = new Set(brands.map((b) => normalizeKey(b.name)));
    const uniqueRows = rows.filter((row) => !existing.has(normalizeKey(row.name)));

    if (!uniqueRows.length) {
      toast.error("All pasted brands already exist.");
      return;
    }

    try {
      for (const row of uniqueRows) {
        if (offlineModeActive) {
          await saveBrandOffline({ name: row.name, description: row.description || null, status: "active" } as any, "create");
        } else {
          await brandMutations.create.mutateAsync({
            name: row.name,
            description: row.description || null,
            status: "active",
          } as any);
        }
      }

      setBulkOpen(false);
      setBulkText("");
      await refreshQueries();
      toast.success(`${uniqueRows.length} brands imported.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to import brands");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setDialogOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setName(brand.name);
    setDescription(brand.description || "");
    setDialogOpen(true);
  };

  const duplicateBrand = (brand: Brand) => {
    setEditing(null);
    setName(`${brand.name} Copy`);
    setDescription(brand.description || "");
    setDialogOpen(true);
    toast.info("Brand copied. Rename it before saving.");
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setName("");
    setDescription("");
  };

  const handleSave = () => {
    if (editing) updateBrand.mutate();
    else createBrand.mutate();
  };

  const resetFilters = () => {
    setSearch("");
    setSmartFilter("all");
    setSyncFilter("all");
    setSortKey("created_at");
    setSortAsc(false);
    setPage(1);
  };

  const BrandMenu = ({ brand }: { brand: Brand }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewBrand(brand)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => openEdit(brand)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => duplicateBrand(brand)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-destructive"
          onClick={() => setDeleteBrandRow(brand)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const BrandCard = ({ brand }: { brand: Brand }) => {
    const usage = getBrandUsage(brand.name, products);
    const value = getBrandStockValue(brand.name, products);
    const profit = getBrandPotentialProfit(brand.name, products);
    const health = getBrandHealth(brand, products, duplicateNames);
    const pending = isPendingSync(brand);
    const duplicate = duplicateNames.has(normalizeKey(brand.name));

    return (
      <div className="rounded-3xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-white font-bold shadow-sm ${brandAvatarColor(brand.name)}`}
            >
              {brandInitial(brand.name)}
            </div>

            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setViewBrand(brand)}
                className="block max-w-[240px] truncate text-left font-bold hover:text-primary"
              >
                {brand.name}
              </button>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {brand.description || "No description"}
              </p>
            </div>
          </div>

          <BrandMenu brand={brand} />
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

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Stock Value</p>
            <p className="mt-1 truncate font-data text-sm font-bold">{compactCurrency(value)}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground">Potential Profit</p>
            <p className="mt-1 truncate font-data text-sm font-bold">{compactCurrency(profit)}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Brand Health</span>
            <span>{health}%</span>
          </div>
          <Progress value={health} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="sm" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={() => setViewBrand(brand)}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            View
          </Button>
          <Button size="sm" className="rounded-xl bg-amber-600 text-white hover:bg-amber-700" onClick={() => openEdit(brand)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>
    );
  };

  const kpis = [
    {
      label: "Brands",
      value: stats.total,
      icon: Layers,
      color: "bg-rose-600 text-white border-rose-500",
      helper: "brand records",
    },
    {
      label: "Used",
      value: stats.used,
      icon: PackageCheck,
      color: "bg-emerald-600 text-white border-emerald-500",
      helper: "linked products",
    },
    {
      label: "Brand Value",
      value: compactCurrency(stats.totalValue),
      icon: BarChart3,
      color: "bg-violet-600 text-white border-violet-500",
      helper: "retail stock value",
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
      title="Brands"
      description="Manage brand quality, manufacturer records, stock value, profit potential, product grouping, offline brand changes, and reporting readiness."
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
                      {offlineModeActive ? "Brands are using cached offline data" : "Brand changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending brand records: {stats.pending}. Products, Dashboard, Reports, and inventory filters update after sync.
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
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Layers className="w-6 h-6" />
                </div>

                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-500/10 text-blue-700 border-blue-500/20 mb-3">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    Brand Operations Center
                  </Badge>

                  <h2 className="text-xl font-bold tracking-tight">Brand Control Center</h2>

                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Create, organize, audit, and improve brands with usage analytics, duplicate protection,
                    offline support, product value, potential profit, and reporting readiness.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-4">
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Top Brand</p>
                      <p className="text-sm font-semibold truncate">{stats.topBrand}</p>
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
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-2xl ${card.color}`}>
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
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-semibold">Brand Health</h3>
                  <p className="text-xs text-muted-foreground">Completeness and structure signals</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Health Score", value: `${stats.avgHealth}%`, icon: Gauge, tone: "bg-blue-500/10 text-blue-700" },
                  { label: "Empty Brands", value: stats.empty, icon: PackageX, tone: "bg-rose-500/10 text-rose-700" },
                  { label: "Missing Descriptions", value: stats.total - stats.withDescription, icon: FileText, tone: "bg-amber-500/10 text-amber-700" },
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
                  <h3 className="font-semibold">Brand Value</h3>
                  <p className="text-xs text-muted-foreground">Retail stock value and potential profit</p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Total Brand Stock Value</p>
                  <p className="text-2xl font-black font-data mt-1">{compactCurrency(stats.totalValue)}</p>
                </div>

                <div className="rounded-2xl bg-emerald-500/10 p-4 text-emerald-700">
                  <p className="text-xs">Potential Profit</p>
                  <p className="text-lg font-black font-data mt-1">{compactCurrency(stats.potentialProfit)}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span>Used brands</span>
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
                  <h3 className="font-semibold">Brand Workflow</h3>
                  <p className="text-xs text-muted-foreground">Best practices for strong reporting</p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">Use official brand names</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: Samsung, Apple, Coca-Cola, Nike.
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">Avoid duplicates</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Duplicates weaken stock reports and product search.
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
                    <h2 className="text-xl font-bold tracking-tight">Brand Directory</h2>
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
                    Showing {filteredBrands.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {Math.min(currentPage * PAGE_SIZE, filteredBrands.length)} of {filteredBrands.length} brands
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ExportMenu
                    onCSV={() => exportToCSV(exportRows, "brands", exportCols)}
                    onPDF={() =>
                      exportToPDF(exportRows, "brands", "Brands Enterprise Report", exportCols, {
                        subtitle: `${filteredBrands.length} brand records`,
                        summary: [
                          { label: "Brands", value: String(stats.total) },
                          { label: "Used", value: String(stats.used) },
                          { label: "Empty", value: String(stats.empty) },
                          { label: "Brand Value", value: compactCurrency(stats.totalValue) },
                          { label: "Potential Profit", value: compactCurrency(stats.potentialProfit) },
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
                      { key: "compact" as ViewMode, label: "Compact", icon: Layers },
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

                  <Button
                    onClick={openCreate}
                    className="h-9 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Brand
                  </Button>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search brands, descriptions, product usage count..."
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
                    <option value="value:desc">Highest Value</option>
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
                <div className="text-center py-12 text-muted-foreground">Loading brands...</div>
              ) : filteredBrands.length === 0 ? (
                <div className="rounded-3xl border bg-muted/20 text-center py-16 text-muted-foreground">
                  <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  No brands found
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {paged.map((brand) => (
                    <BrandCard key={brand.id} brand={brand} />
                  ))}
                </div>
              ) : viewMode === "list" ? (
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[950px] text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Brand</th>
                        <th className="px-4 py-3 text-left font-medium">Description</th>
                        <th className="px-4 py-3 text-left font-medium">Products</th>
                        <th className="px-4 py-3 text-left font-medium">Stock Value</th>
                        <th className="px-4 py-3 text-left font-medium">Health</th>
                        <th className="px-4 py-3 text-left font-medium">Sync</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {paged.map((brand) => {
                        const health = getBrandHealth(brand, products, duplicateNames);

                        return (
                          <tr key={brand.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`h-11 w-11 rounded-xl text-white flex items-center justify-center shrink-0 font-bold ${brandAvatarColor(brand.name)}`}>
                                  {brandInitial(brand.name)}
                                </div>
                                <div className="min-w-0">
                                  <button type="button" onClick={() => setViewBrand(brand)} className="font-semibold hover:text-primary truncate block max-w-[240px]">
                                    {brand.name}
                                  </button>
                                  <p className="text-xs text-muted-foreground">{formatDate(brand.created_at).split(",")[0]}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[280px]">{brand.description || "No description"}</td>
                            <td className="px-4 py-3 font-data">{getBrandUsage(brand.name, products)}</td>
                            <td className="px-4 py-3 font-data">{compactCurrency(getBrandStockValue(brand.name, products))}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${health}%` }} />
                                </div>
                                <span className="text-xs">{health}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={isPendingSync(brand) ? "rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30" : "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
                                {isPendingSync(brand) ? "Pending" : "Synced"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <BrandMenu brand={brand} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {paged.map((brand) => (
                    <div key={brand.id} className="rounded-2xl border bg-card p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`h-11 w-11 rounded-xl text-white flex items-center justify-center font-bold ${brandAvatarColor(brand.name)}`}>
                          {brandInitial(brand.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{brand.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{getBrandUsage(brand.name, products)} products · {compactCurrency(getBrandStockValue(brand.name, products))}</p>
                        </div>
                        <BrandMenu brand={brand} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t px-4 lg:px-5 py-4">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages} · {filteredBrands.length} brands
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
              <DialogTitle>{editing ? "Edit Brand" : "Add Brand"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update this product brand. Offline changes will sync later."
                  : "Create a new product brand for this workspace."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Brand Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Coca-Cola"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional brand description"
                  className="rounded-xl"
                />
              </div>

              {offlineModeActive && (
                <div className="rounded-2xl border bg-amber-500/10 p-3 text-sm text-amber-700">
                  This brand will be saved locally and synced when internet returns.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={createBrand.isPending || updateBrand.isPending}
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
              <DialogTitle>Bulk Import Brands</DialogTitle>
              <DialogDescription>
                Paste one brand per line. Use “Brand Name | Description” when you want to include a description.
              </DialogDescription>
            </DialogHeader>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Samsung | Electronics and appliances\nCoca-Cola | Beverages\nNike | Sportswear"}
              className="min-h-[220px] w-full rounded-2xl border bg-background p-4 text-sm outline-none"
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button onClick={bulkCreateBrands} className="bg-blue-600 text-white hover:bg-blue-700">
                Import Brands
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewBrand} onOpenChange={() => setViewBrand(null)}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{viewBrand?.name}</DialogTitle>
              <DialogDescription>Brand details, usage, value, profit, health, and sync status.</DialogDescription>
            </DialogHeader>

            {viewBrand && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 rounded-3xl border bg-muted/30 p-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-3xl text-white text-2xl font-black ${brandAvatarColor(viewBrand.name)}`}>
                    {brandInitial(viewBrand.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold">{viewBrand.name}</p>
                    <p className="text-sm text-muted-foreground">{viewBrand.description || "No description"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["Products", getBrandUsage(viewBrand.name, products)],
                    ["Stock Value", compactCurrency(getBrandStockValue(viewBrand.name, products))],
                    ["Profit Potential", compactCurrency(getBrandPotentialProfit(viewBrand.name, products))],
                    ["Health", `${getBrandHealth(viewBrand, products, duplicateNames)}%`],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-medium break-words">{String(value)}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Brand Health</span>
                    <span>{getBrandHealth(viewBrand, products, duplicateNames)}%</span>
                  </div>
                  <Progress value={getBrandHealth(viewBrand, products, duplicateNames)} />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => viewBrand && duplicateBrand(viewBrand)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <Button
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => {
                  if (viewBrand) openEdit(viewBrand);
                  setViewBrand(null);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteBrandRow} onOpenChange={() => setDeleteBrandRow(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Archive Brand</DialogTitle>
              <DialogDescription>
                Are you sure you want to archive "{deleteBrandRow?.name}"? Brands used by products cannot be archived until products are reassigned.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteBrandRow(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteBrandRow && deleteBrand.mutate(deleteBrandRow)}
                disabled={deleteBrand.isPending}
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
