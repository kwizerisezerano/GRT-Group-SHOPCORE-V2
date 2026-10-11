import { useMemo, useState } from "react";
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  Layers3,
  BarChart3,
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
  Grid3X3,
  List,
  Download,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
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
import { useProducts, useCategories, useCategoryMutations } from "@/hooks/useSupabaseData";
import {
  PageContainer,
  PageToolbar,
  ToolbarButton,
  PrimaryAction,
  StatGrid,
  SectionCard,
  SearchField,
  FilterSelect,
  FilterChips,
  ViewToggle,
  TablePagination,  EmptyState,
  LoadingState,
  type StatItem,
} from "@/components/patterns";


const CONTROL_COLOR = "hsl(var(--primary))";
const PAGE_SIZE = 18;

interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
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
type SortKey = "created_at" | "name" | "usage" | "health";

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
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

function getCategoryDate(category: any) {
  return (
    category?.updated_offline_at ||
    category?.updated_at ||
    category?.created_offline_at ||
    category?.created_at ||
    new Date().toISOString()
  );
}

function sortByCreatedAtDesc<T extends AnyRecord>(records: T[]): T[] {
  return [...(records || [])].sort((a, b) => {
    const aDate = new Date(getCategoryDate(a)).getTime();
    const bDate = new Date(getCategoryDate(b)).getTime();
    return bDate - aDate;
  });
}

function normalizeName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeKey(name: string) {
  return normalizeName(name).toLowerCase();
}

function dedupeCategories(categories: Category[]): Category[] {
  const map = new Map<string, Category>();

  for (const category of categories || []) {
    const key = String(
      category.id ||
      category.offline_id ||
      normalizeKey(category.name) ||
      Math.random()
    );

    const existing = map.get(key);

    if (!existing) {
      map.set(key, category);
      continue;
    }

    const existingTime = new Date(getCategoryDate(existing)).getTime();
    const incomingTime = new Date(getCategoryDate(category)).getTime();

    map.set(
      key,
      incomingTime >= existingTime
        ? { ...existing, ...category }
        : { ...category, ...existing }
    );
  }

  return sortByCreatedAtDesc<Category>(
    Array.from(map.values()).filter(
      (category): category is Category => !isPendingDelete(category)
    )
  );
}

function toCategory(row: AnyRecord): Category | null {
  const name = normalizeName(String(row?.name || ""));
  if (!name) return null;
  const now = nowIso();
  return {
    id: String(row?.id || row?.offline_id || makeLocalId("offline-category")),
    tenant_id: String(row?.tenant_id || "offline"),
    name,
    description: row?.description ?? null,
    created_at: String(row?.created_at || row?.created_offline_at || now),
    updated_at: row?.updated_at ?? null,
    sync_status: row?.sync_status,
    offline_id: row?.offline_id,
    operation: row?.operation,
    created_offline_at: row?.created_offline_at,
    updated_offline_at: row?.updated_offline_at,
    status: row?.status,
  };
}

function toCategoryList(rows: unknown): Category[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => toCategory(row as AnyRecord)).filter((row): row is Category => !!row);
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

function getCategoryUsage(categoryName: string, products: any[]) {
  const key = normalizeKey(categoryName);
  return products.filter((product) => normalizeKey(product.category || "") === key).length;
}

function getCategoryStockValue(categoryName: string, products: any[]) {
  const key = normalizeKey(categoryName);
  return products
    .filter((product) => normalizeKey(product.category || "") === key)
    .reduce(
      (sum, product) =>
        sum +
        Math.max(0, safeNumber(product.stock ?? product.stock_quantity)) *
          safeNumber(product.selling_price ?? product.price),
      0
    );
}

function getCategoryHealth(category: Category, products: any[], duplicateNames: Set<string>) {
  let score = 100;

  if (!category.name) score -= 30;
  if (!category.description) score -= 15;
  if (duplicateNames.has(normalizeKey(category.name))) score -= 25;
  if (getCategoryUsage(category.name, products) === 0) score -= 10;
  if (isPendingSync(category)) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function healthLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Review";
  return "Critical";
}

function compactCurrency(value: number) {
  if (Math.abs(value) < 1_000_000) return new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 }).format(value);
  return `RF ${new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}
function makeLocalId(prefix: string) {
  try { return `${prefix}-${crypto.randomUUID()}`; } catch { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function nowIso() { return new Date().toISOString(); }

function cleanCategoryPayload(row: any) {
  const clean = { ...row };
  delete clean.offline_id; delete clean.sync_status; delete clean.operation; delete clean.created_offline_at; delete clean.updated_offline_at;
  Object.keys(clean).forEach((key) => clean[key] === undefined && delete clean[key]);
  return clean;
}


export default function Categories() {
  const { user, tenantId, session } = useAuth();
  const { can } = usePermissions();
  const canCreate = can("categories.create");
  const canUpdate = can("categories.update");
  const canDelete = can("categories.delete");
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: categoryRows = [], isLoading } = useCategories();
  const categoryMutations = useCategoryMutations();

  const categories = useMemo(
    () => dedupeCategories((categoryRows || []) as Category[]),
    [categoryRows]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewCategory, setViewCategory] = useState<Category | null>(null);
  const [deleteCategoryRow, setDeleteCategoryRow] = useState<Category | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
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
    categories.forEach((category) => {
      const key = normalizeKey(category.name);
      if (key) map.set(key, (map.get(key) || 0) + 1);
    });

    return new Set([...map.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();

    const list = categories.filter((c) => {
      const usage = getCategoryUsage(c.name, products);
      const pending = isPendingSync(c);
      const duplicate = duplicateNames.has(normalizeKey(c.name));

      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        String(usage).includes(q);

      const matchesSmart =
        smartFilter === "all" ||
        (smartFilter === "used" && usage > 0) ||
        (smartFilter === "empty" && usage === 0) ||
        (smartFilter === "described" && !!c.description) ||
        (smartFilter === "missing_description" && !c.description) ||
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
        const av = new Date(getCategoryDate(a)).getTime();
        const bv = new Date(getCategoryDate(b)).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "usage") {
        const av = getCategoryUsage(a.name, products);
        const bv = getCategoryUsage(b.name, products);
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "health") {
        const av = getCategoryHealth(a, products, duplicateNames);
        const bv = getCategoryHealth(b, products, duplicateNames);
        return sortAsc ? av - bv : bv - av;
      }

      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });

    return list;
  }, [categories, products, search, smartFilter, syncFilter, sortKey, sortAsc, duplicateNames]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filteredCategories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const total = categories.length;
    const withDescription = categories.filter((c) => !!c.description).length;
    const pending = categories.filter(isPendingSync).length;
    const used = categories.filter((c) => getCategoryUsage(c.name, products) > 0).length;
    const empty = total - used;
    const duplicates = categories.filter((c) => duplicateNames.has(normalizeKey(c.name))).length;
    const totalUsage = categories.reduce((sum, c) => sum + getCategoryUsage(c.name, products), 0);
    const totalValue = categories.reduce((sum, c) => sum + getCategoryStockValue(c.name, products), 0);
    const avgHealth = total
      ? Math.round(categories.reduce((sum, c) => sum + getCategoryHealth(c, products, duplicateNames), 0) / total)
      : 0;
    const latest = categories[0]?.name || "-";

    const topCategory = [...categories]
      .sort((a, b) => getCategoryUsage(b.name, products) - getCategoryUsage(a.name, products))[0];

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
      avgHealth,
      latest,
      topCategory: topCategory?.name || "—",
      filtered: filteredCategories.length,
    };
  }, [categories, products, duplicateNames, filteredCategories.length]);

  const smartCards = [
    { key: "all" as SmartFilter, label: "All", value: stats.total, icon: Tags },
    { key: "used" as SmartFilter, label: "Used", value: stats.used, icon: PackageCheck },
    { key: "empty" as SmartFilter, label: "Empty", value: stats.empty, icon: PackageX },
    { key: "described" as SmartFilter, label: "Described", value: stats.withDescription, icon: FileText },
    { key: "missing_description" as SmartFilter, label: "No Desc.", value: stats.total - stats.withDescription, icon: AlertTriangle },
    { key: "duplicate" as SmartFilter, label: "Duplicates", value: stats.duplicates, icon: Copy },
    { key: "pending" as SmartFilter, label: "Pending", value: stats.pending, icon: UploadCloud },
  ];

  const exportRows = filteredCategories.map((c) => ({
    name: c.name,
    description: c.description || "",
    usage: getCategoryUsage(c.name, products),
    stock_value: compactCurrency(getCategoryStockValue(c.name, products)),
    health: `${getCategoryHealth(c, products, duplicateNames)}%`,
    sync_status: isPendingSync(c) ? "Pending" : "Synced",
    created_at: formatDate(c.created_at || c.created_offline_at),
  }));

  const exportCols = [
    { key: "name" as const, label: "Category" },
    { key: "description" as const, label: "Description" },
    { key: "usage" as const, label: "Products" },
    { key: "stock_value" as const, label: "Stock Value" },
    { key: "health" as const, label: "Health" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "created_at" as const, label: "Created" },
  ];

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const saveCategoriesCache = async (rows: Category[]) => {
    const cleaned = dedupeCategories(rows);
    await saveCachedTable("categories", cleaned);
    queryClient.setQueryData(["categories"], cleaned);
    await refreshQueries();
    return cleaned;
  };

  const saveCategoryOffline = async (payload: Partial<Category>, mode: "create" | "update", target?: Category) => {
    const now = nowIso();
    const cached = await getCachedTable("categories");
    const cachedRows = Array.isArray(cached) ? toCategoryList(cached) : categories;
    const isOfflineTarget = !!target && (String(target.id || "").startsWith("offline-") || !!target.offline_id);
    const row: Category = {
      ...(target || {}), ...payload, id: target?.id || makeLocalId("offline-category"), tenant_id: target?.tenant_id || tenantId || "offline", created_at: target?.created_at || now, updated_at: now, status: (payload as any).status || target?.status || "active", operation: isOfflineTarget || mode === "create" ? "create" : "update", sync_status: isOfflineTarget || mode === "create" ? "pending" : "pending_update", created_offline_at: target?.created_offline_at || (mode === "create" ? now : undefined), updated_offline_at: now,
    } as Category;
    await saveCategoriesCache([row, ...cachedRows]);
    await savePending("categories", row as any);
    toast.success(mode === "create" ? "Category saved offline. It will sync later." : "Category update saved offline. It will sync later.");
    return row;
  };

  const archiveCategoryOffline = async (category: Category) => {
    const cached = await getCachedTable("categories");
    const cachedRows = Array.isArray(cached) ? toCategoryList(cached) : categories;
    const archived = { ...category, status: "deleted", operation: "delete", sync_status: "pending_delete", updated_offline_at: nowIso() } as Category;
    await savePending("categories", archived as any);
    await saveCategoriesCache(cachedRows.map((row) => String(row.id) === String(category.id) ? archived : row));
    toast.success("Category archive saved offline. It will sync later.");
  };


  const createCategory = {
    isPending: categoryMutations.create.isPending,
    mutate: () => {
      const normalized = normalizeName(name);

      if (!normalized) {
        toast.error("Category name is required");
        return;
      }

      const duplicate = categories.some((c) => normalizeKey(c.name) === normalizeKey(normalized));
      if (duplicate) {
        toast.error("A category with this name already exists");
        return;
      }

      if (offlineModeActive) {
        saveCategoryOffline({ name: normalized, description: description.trim() || null, status: "active" } as any, "create").then(() => closeDialog());
        return;
      }

      categoryMutations.create.mutate(
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
          onError: (error: any) => toast.error(error?.message || "Failed to save category"),
        }
      );
    },
  };

  const updateCategory = {
    isPending: categoryMutations.update.isPending,
    mutate: () => {
      if (!editing) {
        toast.error("No category selected");
        return;
      }

      const normalized = normalizeName(name);

      if (!normalized) {
        toast.error("Category name is required");
        return;
      }

      const duplicate = categories.some(
        (c) => c.id !== editing.id && normalizeKey(c.name) === normalizeKey(normalized)
      );

      if (duplicate) {
        toast.error("A category with this name already exists");
        return;
      }

      if (offlineModeActive || String(editing.id || "").startsWith("offline-") || !!editing.offline_id) {
        saveCategoryOffline({ name: normalized, description: description.trim() || null, status: editing.status || "active" } as any, "update", editing).then(() => closeDialog());
        return;
      }

      categoryMutations.update.mutate(
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
          onError: (error: any) => toast.error(error?.message || "Failed to update category"),
        }
      );
    },
  };

  const deleteCategory = {
    isPending: categoryMutations.remove.isPending,
    mutate: (category: Category) => {
      if (getCategoryUsage(category.name, products) > 0) {
        toast.error("This category is used by products. Reassign those products before deleting.");
        return;
      }

      if (offlineModeActive || String(category.id || "").startsWith("offline-") || !!category.offline_id) {
        archiveCategoryOffline(category).then(() => setDeleteCategoryRow(null));
        return;
      }

      categoryMutations.update.mutate({ id: category.id, status: "deleted" } as any, {
        onSuccess: () => {
          refreshQueries();
          setDeleteCategoryRow(null);
        },
        onError: (error: any) => toast.error(error?.message || "Failed to archive category"),
      });
    },
  };

  const bulkCreateCategories = async () => {
    const names = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [categoryName, categoryDescription] = line.split("|").map((part) => part?.trim());
        return { name: normalizeName(categoryName), description: categoryDescription || "" };
      })
      .filter((row) => row.name);

    if (!names.length) {
      toast.error("Add at least one category name.");
      return;
    }

    const existing = new Set(categories.map((c) => normalizeKey(c.name)));
    const uniqueRows = names.filter((row) => !existing.has(normalizeKey(row.name)));

    if (!uniqueRows.length) {
      toast.error("All pasted categories already exist.");
      return;
    }

    try {
      for (const row of uniqueRows) {
        await categoryMutations.create.mutateAsync({
          name: row.name,
          description: row.description || null,
          status: "active",
        } as any);
      }

      setBulkOpen(false);
      setBulkText("");
      await refreshQueries();
      toast.success(`${uniqueRows.length} categories imported.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to import categories");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description || "");
    setDialogOpen(true);
  };

  const duplicateCategory = (category: Category) => {
    setEditing(null);
    setName(`${category.name} Copy`);
    setDescription(category.description || "");
    setDialogOpen(true);
    toast.info("Category copied. Rename it before saving.");
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setName("");
    setDescription("");
  };

  const handleSave = () => {
    if (editing) updateCategory.mutate();
    else createCategory.mutate();
  };

  const resetFilters = () => {
    setSearch("");
    setSmartFilter("all");
    setSyncFilter("all");
    setSortKey("created_at");
    setSortAsc(false);
    setPage(1);
  };

  const CategoryMenu = ({ category }: { category: Category }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewCategory(category)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        {canUpdate && (
          <DropdownMenuItem onClick={() => openEdit(category)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {canCreate && (
          <DropdownMenuItem onClick={() => duplicateCategory(category)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setDeleteCategoryRow(category)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const CategoryCard = ({ category }: { category: Category }) => {
    const usage = getCategoryUsage(category.name, products);
    const value = getCategoryStockValue(category.name, products);
    const health = getCategoryHealth(category, products, duplicateNames);
    const pending = isPendingSync(category);
    const duplicate = duplicateNames.has(normalizeKey(category.name));

    return (
      <div className="rounded-3xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-white"
              style={{ background: CONTROL_COLOR }}
            >
              <Tags className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setViewCategory(category)}
                className="block max-w-[240px] truncate text-left font-bold hover:text-primary"
              >
                {category.name}
              </button>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {category.description || "No description"}
              </p>
            </div>
          </div>

          <CategoryMenu category={category} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className={pending ? "rounded-full bg-primary/10 text-muted-foreground border-primary/30" : "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
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
            <p className="text-[11px] text-muted-foreground">Created</p>
            <p className="mt-1 truncate text-sm font-medium">{formatDate(category.created_at).split(",")[0]}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Category Health</span>
            <span>{health}%</span>
          </div>
          <Progress value={health} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setViewCategory(category)}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            View
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(category)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>
    );
  };

  const statCards: StatItem[] = [
    { label: "Categories", value: stats.total, icon: Tags, tone: "indigo", helper: "category records" },
    {
      label: "Used",
      value: stats.used,
      icon: PackageCheck,
      tone: "emerald",
      helper: "linked to products",
    },
    {
      label: "Empty",
      value: stats.empty,
      icon: PackageX,
      tone: stats.empty > 0 ? "amber" : "sky",
      helper: "no products yet",
    },
    {
      label: "Stock Value",
      value: compactCurrency(stats.totalValue),
      icon: BarChart3,
      tone: "violet",
      helper: "retail category value",
    },
    {
      label: "Health",
      value: `${stats.avgHealth}%`,
      icon: Gauge,
      tone: stats.avgHealth >= 70 ? "teal" : "amber",
      helper: healthLabel(stats.avgHealth),
    },
  ];

  return (
    <PageShell
      title="Categories"
      description="Organize the product catalog, keep names clean, and track how each category performs."
    >
      <PageBackground image={warehouseBg} opacity={0}>
        <PageContainer>

          <PageToolbar>
            <ToolbarButton icon={RefreshCcw} onClick={refreshQueries}>
              Refresh
            </ToolbarButton>

            <ToolbarButton icon={Download} onClick={() => setBulkOpen(true)}>
              Bulk Import
            </ToolbarButton>

            <ToolbarButton icon={RotateCcw} onClick={resetFilters}>
              Reset Filters
            </ToolbarButton>

            <ExportMenu
              onCSV={() => exportToCSV(exportRows, "categories", exportCols)}
              onPDF={() =>
                exportToPDF(exportRows, "categories", "Categories Enterprise Report", exportCols, {
                  subtitle: `${filteredCategories.length} category records`,
                  summary: [
                    { label: "Categories", value: String(stats.total) },
                    { label: "Used", value: String(stats.used) },
                    { label: "Empty", value: String(stats.empty) },
                    { label: "Stock Value", value: compactCurrency(stats.totalValue) },
                    { label: "Pending Sync", value: String(stats.pending) },
                  ],
                })
              }
            />

            {canCreate && (
              <PrimaryAction icon={Plus} onClick={openCreate}>
                Add Category
              </PrimaryAction>
            )}
          </PageToolbar>


          <StatGrid items={statCards} columns={5} />

          <SectionCard
            icon={Tags}
            title="Category Directory"
            description="Search, filter and manage every product category in this workspace."
            actions={
              <ViewToggle<ViewMode>
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { key: "grid" as ViewMode, label: "Grid", icon: Grid3X3 },
                  { key: "list" as ViewMode, label: "List", icon: List },
                  { key: "compact" as ViewMode, label: "Compact", icon: Layers3 },
                ]}
              />
            }
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

            <div className="grid gap-3 xl:grid-cols-[1fr_170px_190px]">
              <SearchField
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="Search categories, descriptions, usage count..."
              />

              <FilterSelect
                value={syncFilter}
                onValueChange={(value) => {
                  setSyncFilter(value);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All Sync" },
                  { value: "synced", label: "Synced" },
                  { value: "pending", label: "Pending" },
                ]}
              />

              <FilterSelect
                value={`${sortKey}:${sortAsc ? "asc" : "desc"}`}
                onValueChange={(value) => {
                  const [key, direction] = value.split(":") as [SortKey, "asc" | "desc"];
                  setSortKey(key);
                  setSortAsc(direction === "asc");
                  setPage(1);
                }}
                options={[
                  { value: "created_at:desc", label: "Newest" },
                  { value: "name:asc", label: "Name A-Z" },
                  { value: "name:desc", label: "Name Z-A" },
                  { value: "usage:desc", label: "Most Used" },
                  { value: "usage:asc", label: "Least Used" },
                  { value: "health:desc", label: "Best Health" },
                  { value: "health:asc", label: "Needs Review" },
                ]}
              />
            </div>
              {isLoading ? (
                <LoadingState label="Loading categories..." variant="cards" />
              ) : filteredCategories.length === 0 ? (
                <EmptyState
                  icon={Tags}
                  title="No categories found"
                  description="Adjust the filters above, or add the first category for this workspace."
                />
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {paged.map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                </div>
              ) : viewMode === "list" ? (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="data-table" style={{ minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Products</th>
                        <th>Stock Value</th>
                        <th>Health</th>
                        <th>Sync</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((category) => {
                        const health = getCategoryHealth(category, products, duplicateNames);
                        return (
                          <tr key={category.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-xl text-white flex items-center justify-center shrink-0" style={{ background: CONTROL_COLOR }}>
                                  <Tags className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <button type="button" onClick={() => setViewCategory(category)} className="font-semibold hover:text-primary truncate block max-w-[240px]">
                                    {category.name}
                                  </button>
                                  <p className="text-xs text-muted-foreground">{formatDate(category.created_at).split(",")[0]}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-muted-foreground truncate max-w-[280px]">{category.description || "No description"}</td>
                            <td className="font-data">{getCategoryUsage(category.name, products)}</td>
                            <td className="font-data">{compactCurrency(getCategoryStockValue(category.name, products))}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${health}%` }} />
                                </div>
                                <span className="text-xs">{health}%</span>
                              </div>
                            </td>
                            <td>
                              <Badge variant="outline" className={isPendingSync(category) ? "rounded-full bg-primary/10 text-muted-foreground border-primary/30" : "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
                                {isPendingSync(category) ? "Pending" : "Synced"}
                              </Badge>
                            </td>
                            <td className="text-right">
                              <CategoryMenu category={category} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {paged.map((category) => (
                    <div key={category.id} className="rounded-2xl border bg-card p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl text-white flex items-center justify-center" style={{ background: CONTROL_COLOR }}>
                          <Tags className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{category.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{getCategoryUsage(category.name, products)} products · {compactCurrency(getCategoryStockValue(category.name, products))}</p>
                        </div>
                        <CategoryMenu category={category} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

            <TablePagination
              page={currentPage}
              perPage={PAGE_SIZE}
              total={filteredCategories.length}
              onPageChange={setPage}
              noun="categories"
            />
          </SectionCard>
        </PageContainer>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update this product category. Offline changes will sync later."
                  : "Create a new product category for this workspace."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Beverages"
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
                  This category will be saved locally and synced when internet returns.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={createCategory.isPending || updateCategory.isPending}
                style={{ background: CONTROL_COLOR }}
              >
                {editing ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>Bulk Import Categories</DialogTitle>
              <DialogDescription>
                Paste one category per line. Use “Category Name | Description” when you want to include a description.
              </DialogDescription>
            </DialogHeader>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Beverages | Drinks, water, juice, and soft drinks\nSnacks | Biscuits, chips, sweets\nElectronics"}
              className="min-h-[220px] w-full rounded-2xl border bg-background p-4 text-sm outline-none"
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button onClick={bulkCreateCategories} style={{ background: CONTROL_COLOR }}>
                Import Categories
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewCategory} onOpenChange={() => setViewCategory(null)}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{viewCategory?.name}</DialogTitle>
              <DialogDescription>Category details, usage, value, health, and sync status.</DialogDescription>
            </DialogHeader>

            {viewCategory && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 rounded-3xl border bg-muted/30 p-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-white" style={{ background: CONTROL_COLOR }}>
                    <Tags className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold">{viewCategory.name}</p>
                    <p className="text-sm text-muted-foreground">{viewCategory.description || "No description"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["Products", getCategoryUsage(viewCategory.name, products)],
                    ["Stock Value", compactCurrency(getCategoryStockValue(viewCategory.name, products))],
                    ["Health", `${getCategoryHealth(viewCategory, products, duplicateNames)}%`],
                    ["Created", formatDate(viewCategory.created_at).split(",")[0]],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-medium break-words">{String(value)}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Category Health</span>
                    <span>{getCategoryHealth(viewCategory, products, duplicateNames)}%</span>
                  </div>
                  <Progress value={getCategoryHealth(viewCategory, products, duplicateNames)} />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => viewCategory && duplicateCategory(viewCategory)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <Button
                style={{ background: CONTROL_COLOR }}
                onClick={() => {
                  if (viewCategory) openEdit(viewCategory);
                  setViewCategory(null);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteCategoryRow} onOpenChange={() => setDeleteCategoryRow(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Archive Category</DialogTitle>
              <DialogDescription>
                Are you sure you want to archive "{deleteCategoryRow?.name}"? Categories used by products cannot be archived until products are reassigned.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteCategoryRow(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteCategoryRow && deleteCategory.mutate(deleteCategoryRow)}
                disabled={deleteCategory.isPending}
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