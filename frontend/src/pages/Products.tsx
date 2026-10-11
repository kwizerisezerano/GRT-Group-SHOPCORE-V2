import { useState, useMemo } from "react";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { formatCurrency } from "@/utils/currency";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PageSkeleton } from "@/components/skeletons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Eye,
  MoreHorizontal,
  ImagePlus,
  ScanBarcode,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  XCircle,
  Grid3X3,
  List,
  RotateCcw,
  TrendingUp,
  RefreshCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useProducts,
  useProductMutations,
  useCategories,
  useBrands,
  useUnits,
  type DbProduct,
} from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {
  PageContainer,
  PageToolbar,
  ToolbarButton,
  PrimaryAction,
  StatGrid,
  SectionCard,
  SearchField,
  FilterSelect,
  ViewToggle,
  TablePagination,  EmptyState,
  type StatItem,
} from "@/components/patterns";
import {
  getCachedProducts,
  isNetworkError,
  isOnline,
  saveCachedProducts,
  saveOfflineProduct,
  savePending,
  updateOfflineProduct,
  upsertCachedRecord,
  patchCachedRecord,
  removeCachedRecord,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

const NAVY = "hsl(var(--primary))";
const PAGE_SIZE = 24;

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  inactive: "bg-muted text-muted-foreground border-muted",
  low_stock: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  out_of_stock: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  pending: "bg-primary/10 text-muted-foreground border-primary/30",
  pending_update: "bg-primary/10 text-muted-foreground border-primary/30",
  pending_delete: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  pending: "Pending Sync",
  pending_update: "Pending Update",
  pending_delete: "Pending Delete",
};

type SortKey =
  | "name"
  | "sku"
  | "category"
  | "cost_price"
  | "selling_price"
  | "stock"
  | "status"
  | "created_at";

type ViewMode = "grid" | "list";

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

function isOfflineRecord(product: any) {
  return (
    String(product?.id || "").startsWith("offline-") ||
    !!product?.offline_id ||
    !!product?.created_offline_at ||
    !!product?.updated_offline_at ||
    String(product?.sync_status || "")
      .toLowerCase()
      .includes("pending")
  );
}

function isPendingDelete(product: any) {
  return (
    String(product?.operation || "").toLowerCase() === "delete" ||
    String(product?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(product?.status || "").toLowerCase() === "deleted"
  );
}

function getProductStock(product: any) {
  return Math.max(0, safeNumber(product?.stock ?? product?.stock_quantity));
}

function getProductMinStock(product: any) {
  return Math.max(
    0,
    safeNumber(
      product?.min_stock ?? product?.min_stock_level ?? product?.reorder_level,
    ),
  );
}

function getProductCost(product: any) {
  return safeNumber(product?.cost_price ?? product?.purchase_price);
}

function getProductPrice(product: any) {
  return safeNumber(product?.selling_price ?? product?.price);
}

function getStockStatus(product: DbProduct) {
  const syncStatus = String((product as any).sync_status || "").toLowerCase();

  if (syncStatus === "pending_delete") return "pending_delete";
  if (syncStatus === "pending_update") return "pending_update";
  if (syncStatus === "pending") return "pending";

  const status = String(product.status || "active").toLowerCase();
  if (status === "inactive") return "inactive";
  if (status === "deleted") return "pending_delete";

  const stock = getProductStock(product);
  const minStock = getProductMinStock(product);

  if (stock <= 0) return "out_of_stock";
  if (minStock > 0 && stock <= minStock) return "low_stock";

  return "active";
}

function normalizeProductPayload(
  form: Partial<DbProduct>,
  imageUrl: string | null,
) {
  const stock = Math.max(
    0,
    safeNumber(form.stock ?? (form as any).stock_quantity),
  );
  const minStock = Math.max(
    0,
    safeNumber(form.min_stock ?? (form as any).min_stock_level ?? 5),
  );
  const maxStock = Math.max(stock, safeNumber((form as any).max_stock || 1000));
  const costPrice = Math.max(0, safeNumber(form.cost_price));
  const sellingPrice = Math.max(0, safeNumber(form.selling_price));
  const computedStatus =
    stock <= 0
      ? "out_of_stock"
      : minStock > 0 && stock <= minStock
        ? "low_stock"
        : "active";

  return {
    name: String(form.name || "").trim(),
    sku: String(form.sku || "").trim(),
    barcode: form.barcode ? String(form.barcode).trim() : null,
    category: String(form.category || "").trim(),
    brand: form.brand ? String(form.brand).trim() : "",
    cost_price: costPrice,
    selling_price: sellingPrice,
    price: sellingPrice,
    stock,
    stock_quantity: stock,
    min_stock: minStock,
    min_stock_level: minStock,
    reorder_level: minStock,
    max_stock: maxStock,
    unit: form.unit || "pcs",
    description: form.description ? String(form.description).trim() : null,
    status: computedStatus,
    image_url: imageUrl,
  };
}

function dedupeProducts(products: DbProduct[]) {
  const map = new Map<string, DbProduct>();

  for (const product of products || []) {
    const key = String(
      product.id ||
        (product as any).offline_id ||
        product.sku ||
        product.barcode ||
        product.name ||
        Math.random(),
    );

    const existing = map.get(key);
    if (!existing) {
      map.set(key, product);
      continue;
    }

    const existingTime = new Date(
      (existing as any).updated_offline_at ||
        existing.updated_at ||
        existing.created_at ||
        0,
    ).getTime();

    const incomingTime = new Date(
      (product as any).updated_offline_at ||
        product.updated_at ||
        product.created_at ||
        0,
    ).getTime();

    map.set(
      key,
      incomingTime >= existingTime
        ? { ...existing, ...product }
        : { ...product, ...existing },
    );
  }

  return Array.from(map.values());
}

function productMatchesQuery(product: DbProduct, query: string) {
  if (!query) return true;

  const q = query.toLowerCase();

  return (
    String(product.name || "")
      .toLowerCase()
      .includes(q) ||
    String(product.sku || "")
      .toLowerCase()
      .includes(q) ||
    String(product.barcode || "")
      .toLowerCase()
      .includes(q) ||
    String(product.category || "")
      .toLowerCase()
      .includes(q) ||
    String(product.brand || "")
      .toLowerCase()
      .includes(q) ||
    String(product.description || "")
      .toLowerCase()
      .includes(q)
  );
}

function getMargin(product: DbProduct) {
  const price = getProductPrice(product);
  const cost = getProductCost(product);
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

function getInventoryValue(product: any) {
  return getProductStock(product) * getProductCost(product);
}

function getRetailValue(product: any) {
  return getProductStock(product) * getProductPrice(product);
}

function getPotentialProfit(product: any) {
  return getRetailValue(product) - getInventoryValue(product);
}

function getProductHealthScore(product: any) {
  let score = 100;
  if (!product?.name) score -= 20;
  if (!product?.sku) score -= 15;
  if (!product?.category) score -= 10;
  if (!product?.barcode) score -= 8;
  if (getProductPrice(product) <= 0) score -= 20;
  if (getProductCost(product) <= 0) score -= 15;
  if (getMargin(product as DbProduct) < 0) score -= 25;
  if (getProductStock(product) <= 0) score -= 15;
  if (getStockStatus(product as DbProduct) === "low_stock") score -= 8;
  if (isOfflineRecord(product)) score -= 5;
  return Math.max(0, Math.min(100, score));
}

function getMarkup(product: any) {
  const cost = getProductCost(product);
  const price = getProductPrice(product);
  if (cost <= 0) return 0;
  return ((price - cost) / cost) * 100;
}

function compactCurrency(value: number) {
  if (Math.abs(value) < 1000000) return formatCurrency(value);
  return `RF ${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
}

export default function Products() {
  const { user, tenantId, session } = useAuth();
  const { can } = usePermissions();
  const canCreate = can("products.create");
  const canUpdate = can("products.update");
  const canDelete = can("products.delete");
  const canViewCost = can("products.viewCost");
  const canSetPrice = can("products.setPrice");
  const { data: products = [], isLoading } = useProducts();
  const { create, update } = useProductMutations();
  const queryClient = useQueryClient();
  // Tenant catalogue master data, used to seed the filter/select options.
  const { data: categoryRecords } = useCategories();
  const { data: brandRecords } = useBrands();
  const { data: unitRecords } = useUnits();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<DbProduct | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<DbProduct | null>(null);
  const [viewProduct, setViewProduct] = useState<DbProduct | null>(null);
  const [form, setForm] = useState<Partial<DbProduct>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [productScannerOpen, setProductScannerOpen] = useState(false);

  const offlineModeActive =
    !isOnline() || isOfflineMode() || !session?.access_token;

  const visibleProducts = useMemo(
    () =>
      dedupeProducts(products as DbProduct[]).filter(
        (p) => !isPendingDelete(p),
      ),
    [products],
  );

  // Seeded from the tenant's own catalogue, then widened with anything the
  // existing products already use, so a value entered before the master
  // record existed still appears in the filter.
  const uniqueBrands = useMemo(() => {
    const values = new Set<string>(
      (brandRecords ?? []).map((b: any) => String(b?.name ?? "")).filter(Boolean),
    );
    visibleProducts.forEach((p) => p.brand && values.add(p.brand));
    return [...values].filter(Boolean).sort();
  }, [visibleProducts, brandRecords]);

  const uniqueCategories = useMemo(() => {
    const values = new Set<string>(
      (categoryRecords ?? []).map((c: any) => String(c?.name ?? "")).filter(Boolean),
    );
    visibleProducts.forEach((p) => p.category && values.add(p.category));
    return [...values].filter(Boolean).sort();
  }, [visibleProducts, categoryRecords]);

  const uniqueUnits = useMemo(() => {
    const values = new Set<string>(
      (unitRecords ?? []).map((u: any) => String(u?.name ?? "")).filter(Boolean),
    );
    visibleProducts.forEach((p) => p.unit && values.add(p.unit));
    return [...values].filter(Boolean).sort();
  }, [visibleProducts, unitRecords]);

  const filtered = useMemo(() => {
    const list = visibleProducts.filter((p) => {
      const matchSearch = productMatchesQuery(p, search);
      const syncStatus = String((p as any).sync_status || "").toLowerCase();
      const pending = isOfflineRecord(p);

      return (
        matchSearch &&
        (catFilter === "all" || p.category === catFilter) &&
        (brandFilter === "all" || p.brand === brandFilter) &&
        (statusFilter === "all" || getStockStatus(p) === statusFilter) &&
        (syncFilter === "all" ||
          (syncFilter === "pending" && pending) ||
          (syncFilter === "synced" && !pending && syncStatus !== "pending"))
      );
    });

    list.sort((a, b) => {
      if (sortKey === "created_at") {
        const av = new Date(
          (a as any).created_offline_at || a.created_at || a.updated_at || 0,
        ).getTime();
        const bv = new Date(
          (b as any).created_offline_at || b.created_at || b.updated_at || 0,
        ).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      const av = sortKey === "stock" ? getProductStock(a) : (a as any)[sortKey];
      const bv = sortKey === "stock" ? getProductStock(b) : (b as any)[sortKey];

      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      return sortAsc
        ? Number(av || 0) - Number(bv || 0)
        : Number(bv || 0) - Number(av || 0);
    });

    return list;
  }, [
    visibleProducts,
    search,
    catFilter,
    brandFilter,
    statusFilter,
    syncFilter,
    sortKey,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(() => {
    const inventoryValue = visibleProducts.reduce(
      (sum, p) => sum + getProductStock(p) * getProductCost(p),
      0,
    );

    const retailValue = visibleProducts.reduce(
      (sum, p) => sum + getProductStock(p) * getProductPrice(p),
      0,
    );

    const pendingSync = visibleProducts.filter(isOfflineRecord).length;
    const active = visibleProducts.filter(
      (p) => getStockStatus(p) === "active",
    ).length;
    const lowStock = visibleProducts.filter(
      (p) => getStockStatus(p) === "low_stock",
    ).length;
    const outOfStock = visibleProducts.filter(
      (p) => getProductStock(p) <= 0,
    ).length;
    const marginTotal = visibleProducts.reduce(
      (sum, p) => sum + getMargin(p),
      0,
    );
    const avgMargin = visibleProducts.length
      ? marginTotal / visibleProducts.length
      : 0;

    const potentialProfit = Math.max(0, retailValue - inventoryValue);
    const lossMakers = visibleProducts.filter((p) => getMargin(p) < 0).length;
    const missingPrices = visibleProducts.filter(
      (p) => getProductPrice(p) <= 0 || getProductCost(p) <= 0,
    ).length;
    const noBarcode = visibleProducts.filter((p) => !p.barcode).length;
    const avgHealth = visibleProducts.length
      ? Math.round(
          visibleProducts.reduce(
            (sum, p) => sum + getProductHealthScore(p),
            0,
          ) / visibleProducts.length,
        )
      : 0;
    const totalUnits = visibleProducts.reduce(
      (sum, p) => sum + getProductStock(p),
      0,
    );

    return {
      total: visibleProducts.length,
      active,
      lowStock,
      outOfStock,
      barcodeReady: visibleProducts.filter((p) => p.barcode).length,
      noBarcode,
      missingPrices,
      lossMakers,
      inventoryValue,
      retailValue,
      potentialProfit,
      pendingSync,
      avgMargin,
      avgHealth,
      totalUnits,
    };
  }, [visibleProducts]);

  const exportRows = filtered.map((product) => ({
    name: product.name || "",
    sku: product.sku || "",
    barcode: product.barcode || "",
    category: product.category || "",
    brand: product.brand || "",
    cost_price: formatCurrency(getProductCost(product)),
    selling_price: formatCurrency(getProductPrice(product)),
    stock: getProductStock(product),
    unit: product.unit || "",
    status: statusLabels[getStockStatus(product)] || getStockStatus(product),
    sync_status: isOfflineRecord(product) ? "Pending" : "Synced",
    inventory_value: formatCurrency(getInventoryValue(product)),
    retail_value: formatCurrency(getRetailValue(product)),
    potential_profit: formatCurrency(getPotentialProfit(product)),
    margin: `${getMargin(product).toFixed(1)}%`,
    markup: `${getMarkup(product).toFixed(1)}%`,
    health_score: `${getProductHealthScore(product)}%`,
  }));

  const exportCols = [
    { key: "name" as const, label: "Name" },
    { key: "sku" as const, label: "SKU" },
    { key: "barcode" as const, label: "Barcode" },
    { key: "category" as const, label: "Category" },
    { key: "brand" as const, label: "Brand" },
    ...(canViewCost ? [{ key: "cost_price" as const, label: "Cost Price" }] : []),
    { key: "selling_price" as const, label: "Selling Price" },
    { key: "stock" as const, label: "Stock" },
    { key: "unit" as const, label: "Unit" },
    { key: "status" as const, label: "Status" },
    { key: "sync_status" as const, label: "Sync" },
    ...(canViewCost ? [
      { key: "inventory_value" as const, label: "Inventory Value" },
      { key: "retail_value" as const, label: "Retail Value" },
      { key: "potential_profit" as const, label: "Potential Profit" },
      { key: "margin" as const, label: "Margin" },
      { key: "markup" as const, label: "Markup" }
    ] : []),
    { key: "health_score" as const, label: "Health Score" },
  ];

  const resetFilters = () => {
    setSearch("");
    setCatFilter("all");
    setBrandFilter("all");
    setStatusFilter("all");
    setSyncFilter("all");
    setPage(1);
  };

  const refreshProductsEverywhere = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["stock_batches"] }),
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const openCreate = () => {
    setEditProduct(null);
    setImageFile(null);
    setForm({
      status: "active",
      unit: "pcs",
      min_stock: 5,
      stock: 0,
      cost_price: 0,
      selling_price: 0,
      image_url: null,
      brand: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (product: DbProduct) => {
    setEditProduct(product);
    setImageFile(null);
    setForm({
      ...product,
      stock: getProductStock(product),
      stock_quantity: getProductStock(product),
      min_stock: getProductMinStock(product),
      min_stock_level: getProductMinStock(product),
      selling_price: getProductPrice(product),
      cost_price: getProductCost(product),
    });
    setDialogOpen(true);
  };

  const uploadProductImage = async () => {
    if (!imageFile) return form.image_url || null;

    if (offlineModeActive) {
      toast.warning(
        "Image upload needs internet. Product will keep the current image until online.",
      );
      return form.image_url || null;
    }

    setUploadingImage(true);

    try {
      const safeName = imageFile.name.replace(/\s+/g, "-").toLowerCase();
      const fileName = `${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(fileName, imageFile, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error: any) {
      console.error(error);
      if (isNetworkError(error)) {
        toast.warning(
          "Image upload failed because internet is unstable. Product will be saved without the new image.",
        );
      } else {
        toast.error(error?.message || "Failed to upload product image");
      }
      return form.image_url || null;
    } finally {
      setUploadingImage(false);
    }
  };

  const closeProductDialog = () => {
    setDialogOpen(false);
    setImageFile(null);
    setEditProduct(null);
  };

  const saveProductOfflineSafely = async (payload: any) => {
    if (!payload?.name?.trim()) { toast.error("Product name is required before offline save."); return; }
    if (!payload?.sku?.trim()) { toast.error("Product SKU is required before offline save."); return; }
    if (!payload?.category?.trim()) { toast.error("Product category is required before offline save."); return; }
    const now = new Date().toISOString();
    const cachedProducts = await getCachedProducts();

    if (editProduct) {
      const isOfflineProduct =
        String(editProduct.id || "").startsWith("offline-") ||
        !!(editProduct as any).offline_id;
      const offlineId = (editProduct as any).offline_id || editProduct.id;

      const updatedProduct: any = {
        ...editProduct,
        ...payload,
        id: editProduct.id,
        tenant_id: (editProduct as any).tenant_id || tenantId || null,
        user_id: (editProduct as any).user_id || user?.id || null,
        offline_id:
          (editProduct as any).offline_id ||
          (isOfflineProduct ? editProduct.id : undefined),
        sync_status: "pending_update",
        operation: isOfflineProduct ? "create" : "update",
        updated_at: now,
        updated_offline_at: now,
      };

      if (isOfflineProduct) {
        await updateOfflineProduct(offlineId, updatedProduct);
      } else {
        await savePending("products", updatedProduct);
        await patchCachedRecord("products", editProduct.id, updatedProduct);
      }

      await saveCachedProducts(
        cachedProducts.map((item: any) =>
          String(item.id) === String(editProduct.id) ||
          String(item.offline_id) === String(offlineId)
            ? { ...item, ...updatedProduct }
            : item,
        ),
      );

      toast.success(
        "Product changes saved offline. They will sync when internet returns.",
      );
    } else {
      const offlineProduct: any = {
        ...payload,
        id: makeLocalId("offline-product"),
        tenant_id: tenantId || null,
        user_id: user?.id || null,
        operation: "create",
        sync_status: "pending",
        created_at: now,
        updated_at: now,
        created_offline_at: now,
        updated_offline_at: now,
      };

      await saveOfflineProduct(offlineProduct);
      await upsertCachedRecord("products", offlineProduct);
      toast.success(
        "Product saved offline. It will sync when internet returns.",
      );
    }

    await refreshProductsEverywhere();
    closeProductDialog();
  };

  const handleSave = async () => {
    if (!String(form.name || "").trim() || !String(form.sku || "").trim() || !String(form.category || "").trim()) {
      toast.error("Product name, SKU, and category are required");
      return;
    }

    if (
      getProductPrice(form as DbProduct) < getProductCost(form as DbProduct)
    ) {
      toast.warning(
        "Selling price is below cost price. This product may create a loss.",
      );
    }

    const offlineImageUrl =
      typeof form.image_url === "string" ? form.image_url : null;

    if (offlineModeActive) {
      const payload = normalizeProductPayload(form, offlineImageUrl);
      await saveProductOfflineSafely(payload);
      return;
    }

    try {
      const imageUrl = await uploadProductImage();
      const payload = normalizeProductPayload(form, imageUrl);

      if (editProduct) {
        const isOfflineProduct =
          String(editProduct.id || "").startsWith("offline-") ||
          !!(editProduct as any).offline_id;

        if (isOfflineProduct) {
          await saveProductOfflineSafely(payload);
          return;
        }

        await update.mutateAsync({ id: editProduct.id, ...payload } as any);

        await patchCachedRecord("products", editProduct.id, {
          ...payload,
          sync_status: "synced",
          updated_at: new Date().toISOString(),
        });

        toast.success("Product updated successfully");
      } else {
        const created = await create.mutateAsync(payload as any);
        await upsertCachedRecord("products", created as any);
        toast.success("Product created successfully");
      }

      await refreshProductsEverywhere();
      closeProductDialog();
    } catch (error: any) {
      console.error("Product save failed:", error);

      if (isNetworkError(error) || !isOnline()) {
        const payload = normalizeProductPayload(form, offlineImageUrl);
        await saveProductOfflineSafely(payload);
        return;
      }

      toast.error(error?.message || "Failed to save product");
    }
  };

  const softDeleteProduct = async (product: DbProduct) => {
    const now = new Date().toISOString();
    const patch = { operation: "delete", sync_status: "pending_delete", status: "deleted", updated_offline_at: now } as any;
    await savePending("products", { ...product, ...patch });
    await patchCachedRecord("products", product.id, { ...product, ...patch });
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    const product = deleteProduct;
    setDeleteProduct(null);

    try {
      const isOfflineProduct = String(product.id || "").startsWith("offline-") || !!(product as any).offline_id;

      if (isOfflineProduct) {
        await removeCachedRecord("products", product.id);
        if ((product as any).offline_id) await removeCachedRecord("products", (product as any).offline_id);
        await refreshProductsEverywhere();
        toast.success("Offline product removed locally.");
        return;
      }

      const now = new Date().toISOString();
      const softDeletedProduct = { ...product, operation: "delete", sync_status: offlineModeActive ? "pending_delete" : "synced", status: offlineModeActive ? "deleted" : "inactive", updated_at: now, updated_offline_at: offlineModeActive ? now : undefined } as any;

      if (offlineModeActive) {
        await savePending("products", { ...product, operation: "delete", sync_status: "pending_delete", status: "deleted", updated_offline_at: now });
        await patchCachedRecord("products", product.id, softDeletedProduct);
        await refreshProductsEverywhere();
        toast.success("Product deletion saved offline. It will sync when internet returns.");
        return;
      }

      try {
        const { error } = await (supabase as any).from("products").update({ status: "inactive", updated_at: now }).eq("id", product.id).eq("tenant_id", tenantId);
        if (error) throw error;
        await patchCachedRecord("products", product.id, softDeletedProduct);
        await refreshProductsEverywhere();
        toast.success("Product archived. Sales history remains protected.");
      } catch (error: any) {
        const message = String(error?.message || error?.details || error?.code || "").toLowerCase();
        if (isNetworkError(error) || !isOnline()) {
          await softDeleteProduct(product);
          await refreshProductsEverywhere();
          toast.success("Network failed. Product deletion saved offline.");
          return;
        }
        if (message.includes("foreign key") || message.includes("sale_items_product_id_fkey") || error?.code === "23503" || error?.status === 409) {
          await patchCachedRecord("products", product.id, { ...softDeletedProduct, sync_status: "synced" });
          await refreshProductsEverywhere();
          toast.warning("This product is used in sales history, so it was archived instead of permanently deleted.");
          return;
        }
        throw error;
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to archive product");
    }
  };

  const ProductMenu = ({ product }: { product: DbProduct }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-xl"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewProduct(product)}>
          <Eye className="w-3.5 h-3.5 mr-2" />
          View
        </DropdownMenuItem>

        {canUpdate && (
          <DropdownMenuItem onClick={() => openEdit(product)}>
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Edit
          </DropdownMenuItem>
        )}

        {canDelete && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setDeleteProduct(product)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isLoading) {
    return (
      <PageShell title="Products">
        <PageSkeleton />
      </PageShell>
    );
  }

  // Each figure carries its own tone so the six icons stay tellable apart;
  // Reorder and Stockout keep the amber/rose warning colours their icons mean.
  const statCards: StatItem[] = [
    {
      label: "Catalog",
      value: stats.total.toLocaleString(),
      icon: Package,
      tone: "indigo",
      helper: "total products",
    },
    {
      label: "Selling",
      value: stats.active.toLocaleString(),
      icon: CheckCircle2,
      tone: "emerald",
      helper: "active products",
    },
    {
      label: "Reorder",
      value: stats.lowStock.toLocaleString(),
      icon: AlertTriangle,
      tone: "amber",
      helper: "below reorder level",
    },
    {
      label: "Stockout",
      value: stats.outOfStock.toLocaleString(),
      icon: XCircle,
      tone: "rose",
      helper: "out of stock",
    },
    ...(canViewCost
      ? ([
          {
            label: "Cost Value",
            value: compactCurrency(stats.inventoryValue),
            icon: Wallet,
            tone: "violet",
            helper: "inventory capital",
          },
          {
            label: "Margin",
            value: `${stats.avgMargin.toFixed(1)}%`,
            icon: TrendingUp,
            tone: "cyan",
            helper: "average margin",
          },
        ] as StatItem[])
      : []),
  ];


  return (
    <PageBackground image={warehouseBg} opacity={0}>
      <PageShell
        title="Products"
        description="Manage the product catalog, pricing, stock health and POS selling readiness."
      >
        <PageContainer>

          <PageToolbar>
            <ToolbarButton icon={RefreshCcw} onClick={refreshProductsEverywhere}>
              Refresh
            </ToolbarButton>

            <ToolbarButton icon={RotateCcw} onClick={resetFilters}>
              Reset Filters
            </ToolbarButton>

            <ExportMenu
              onCSV={() =>
                exportToCSV(exportRows, "products", exportCols)
              }
              onPDF={() =>
                exportToPDF(
                  exportRows,
                  "products",
                  "Products Enterprise Report",
                  exportCols,
                  {
                    subtitle: `${filtered.length} products`,
                    summary: [
                      { label: "Products", value: String(stats.total) },
                      {
                        label: "Inventory Value",
                        value: formatCurrency(stats.inventoryValue),
                      },
                      {
                        label: "Retail Value",
                        value: formatCurrency(stats.retailValue),
                      },
                      {
                        label: "Potential Profit",
                        value: formatCurrency(stats.potentialProfit),
                      },
                      {
                        label: "Low Stock",
                        value: String(stats.lowStock),
                      },
                      {
                        label: "Pending Sync",
                        value: String(stats.pendingSync),
                      },
                    ],
                  },
                )
              }
            />

            {canCreate && (
              <PrimaryAction icon={Plus} onClick={openCreate}>
                Add Product
              </PrimaryAction>
            )}
          </PageToolbar>


          <StatGrid items={statCards} columns={canViewCost ? 6 : 4} />

          <SectionCard
            icon={Boxes}
            title="Product Catalog"
            description="Search, filter and manage every product sold from this workspace."
            actions={
              <ViewToggle<ViewMode>
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { key: "grid" as ViewMode, label: "Grid", icon: Grid3X3 },
                  { key: "list" as ViewMode, label: "List", icon: List },
                ]}
              />
            }
          >
            <div className="grid gap-3">
              <SearchField
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="Search products by name, SKU, category, brand, or barcode..."
              />

              <div className="flex flex-wrap gap-3">
                <FilterSelect
                  className="w-[170px]"
                  value={catFilter}
                  onValueChange={(value) => {
                    setCatFilter(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All Categories" },
                    ...uniqueCategories.map((c) => ({ value: c, label: c })),
                  ]}
                />

                <FilterSelect
                  className="w-[150px]"
                  value={brandFilter}
                  onValueChange={(value) => {
                    setBrandFilter(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All Brands" },
                    ...uniqueBrands.map((b) => ({ value: b, label: b })),
                  ]}
                />

                <FilterSelect
                  className="w-[160px]"
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "active", label: "Active" },
                    { value: "low_stock", label: "Low Stock" },
                    { value: "out_of_stock", label: "Out of Stock" },
                    { value: "inactive", label: "Inactive" },
                    { value: "pending", label: "Pending Sync" },
                    { value: "pending_update", label: "Pending Update" },
                  ]}
                />

                <FilterSelect
                  className="w-[140px]"
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
                  className="w-[170px]"
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
                    { value: "stock:asc", label: "Low Stock First" },
                    { value: "stock:desc", label: "High Stock First" },
                    { value: "selling_price:desc", label: "Highest Price" },
                    { value: "selling_price:asc", label: "Lowest Price" },
                  ]}
                />
              </div>
            </div>
              {paged.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="No products match this view"
                  description="Adjust the search or filters above, or add a product to start building the catalog."
                  action={
                    canCreate ? (
                      <Button onClick={openCreate} className="rounded-xl">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product
                      </Button>
                    ) : undefined
                  }
                />
              ) : viewMode === "grid" ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                  {paged.map((product) => {
                    const status = getStockStatus(product);
                    const stock = getProductStock(product);
                    const price = getProductPrice(product);
                    const pending = isOfflineRecord(product);

                    return (
                      <div
                        key={product.id}
                        className="group rounded-2xl border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden"
                      >
                        <div
                          className="relative h-28 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center cursor-pointer"
                          onClick={() => setViewProduct(product)}
                        >
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-contain p-3"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-sm">
                              <Package className="w-9 h-9" />
                            </div>
                          )}

                          <div className="absolute left-2 top-2 flex flex-col gap-1">
                            {pending && (
                              <Badge className="rounded-full bg-primary/10 text-muted-foreground hover:bg-primary/10 text-[10px]">
                                Pending
                              </Badge>
                            )}
                            {getMargin(product) < 0 && (
                              <Badge className="rounded-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/10 text-[10px]">
                                Loss
                              </Badge>
                            )}
                          </div>

                          <div className="absolute right-2 top-2">
                            <ProductMenu product={product} />
                          </div>
                        </div>

                        <div className="p-3">
                          <div className="min-w-0">
                            <h3
                              className="truncate text-sm font-bold text-foreground cursor-pointer"
                              onClick={() => setViewProduct(product)}
                              title={product.name}
                            >
                              {product.name}
                            </h3>

                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {product.sku || "No SKU"} ·{" "}
                              {product.brand || "No brand"}
                            </p>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge
                              variant="secondary"
                              className="max-w-full truncate rounded-full px-2 py-0 text-[10px] font-normal"
                              title={product.category || "Uncategorized"}
                            >
                              {product.category || "Uncategorized"}
                            </Badge>

                            <Badge
                              variant="outline"
                              className={`rounded-full px-2 py-0 text-[10px] ${
                                statusColors[status] || statusColors.inactive
                              }`}
                            >
                              {statusLabels[status] || status}
                            </Badge>
                          </div>

                          <div className="mt-3 grid grid-cols-2 divide-x rounded-xl border bg-muted/20">
                            <div className="p-2">
                              <p className="text-[10px] text-muted-foreground">
                                Price
                              </p>
                              <p className="font-data text-sm font-bold truncate">
                                {formatCurrency(price)}
                              </p>
                            </div>

                            <div className="p-2 pl-3">
                              <p className="text-[10px] text-muted-foreground">
                                Stock
                              </p>
                              <p className="font-data text-sm font-bold truncate">
                                {stock.toLocaleString()} {product.unit}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Health</span>
                              <span>{getProductHealthScore(product)}%</span>
                            </div>
                            <Progress value={getProductHealthScore(product)} />
                          </div>

                          {canViewCost && (
                            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>
                                Cost {formatCurrency(getProductCost(product))}
                              </span>
                              <span
                                className={
                                  getMargin(product) < 0 ? "text-rose-600" : ""
                                }
                              >
                                {getMargin(product).toFixed(1)}% margin
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="data-table" style={{ minWidth: 980 }}>
                    <thead>
                      <tr>
                        <th>
                          Product
                        </th>
                        <th>SKU</th>
                        <th>
                          Category
                        </th>
                        {canViewCost && (
                          <>
                            <th>
                              Cost
                            </th>
                            <th>
                              Price
                            </th>
                            <th>
                              Margin
                            </th>
                          </>
                        )}
                        {!canViewCost && (
                          <th>
                            Price
                          </th>
                        )}
                        <th>
                          Stock
                        </th>
                        <th>
                          Status
                        </th>
                        <th>
                          Sync
                        </th>
                        <th className="text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paged.map((product) => {
                        const status = getStockStatus(product);
                        const pending = isOfflineRecord(product);

                        return (
                          <tr key={product.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                                  {product.image_url ? (
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      className="h-full w-full object-contain p-1"
                                    />
                                  ) : (
                                    <Package className="w-5 h-5 text-muted-foreground" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setViewProduct(product)}
                                    className="font-semibold hover:text-primary truncate block max-w-[240px]"
                                  >
                                    {product.name}
                                  </button>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {product.brand || "No brand"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="font-data text-xs">
                              {product.sku || "—"}
                            </td>

                            <td>
                              <Badge
                                variant="secondary"
                                className="rounded-full text-xs font-normal"
                              >
                                {product.category || "Uncategorized"}
                              </Badge>
                            </td>

                            {canViewCost && (
                              <td className="font-data">
                                {formatCurrency(getProductCost(product))}
                              </td>
                            )}

                            <td className="font-data font-semibold">
                              {formatCurrency(getProductPrice(product))}
                            </td>

                            {canViewCost && (
                              <td
                                className={`px-4 py-3 font-data ${getMargin(product) < 0 ? "text-rose-600" : ""}`}
                              >
                                {getMargin(product).toFixed(1)}%
                              </td>
                            )}

                            <td className="font-data">
                              {getProductStock(product).toLocaleString()}{" "}
                              {product.unit}
                            </td>

                            <td>
                              <Badge
                                variant="outline"
                                className={`rounded-full text-xs ${
                                  statusColors[status] || statusColors.inactive
                                }`}
                              >
                                {statusLabels[status] || status}
                              </Badge>
                            </td>

                            <td>
                              <Badge
                                variant="outline"
                                className={`rounded-full text-xs ${
                                  pending
                                    ? "bg-primary/10 text-muted-foreground border-primary/30"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                }`}
                              >
                                {pending ? "Pending" : "Synced"}
                              </Badge>
                            </td>

                            <td className="text-right">
                              <div className="flex justify-end">
                                <ProductMenu product={product} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            <TablePagination
              page={currentPage}
              perPage={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
              noun="products"
            />
          </SectionCard>
        </PageContainer>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle>
                {editProduct ? "Edit Product" : "Add New Product"}
              </DialogTitle>
              <DialogDescription>
                Supplier is optional. Add opening stock directly using Stock
                Quantity. Offline changes stay visible and sync later.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Product Name *
                </label>
                <Input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Blue Band"
                  className="rounded-xl"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Product Image
                </label>

                <div className="mt-1 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-2xl border bg-muted overflow-hidden flex items-center justify-center">
                    {imageFile ? (
                      <img
                        src={URL.createObjectURL(imageFile)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : form.image_url ? (
                      <img
                        src={form.image_url}
                        alt="Product"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImagePlus className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="rounded-xl"
                  />
                </div>

                {offlineModeActive && (
                  <p className="mt-1 text-xs text-amber-600">
                    Image upload will be skipped offline. Existing image will be
                    kept.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  SKU *
                </label>
                <Input
                  value={form.sku || ""}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. PROD-001"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Barcode / QR Code
                </label>

                <div className="flex gap-2">
                  <Input
                    value={form.barcode || ""}
                    onChange={(e) =>
                      setForm({ ...form, barcode: e.target.value })
                    }
                    placeholder="Scan or type barcode"
                    className="rounded-xl"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setProductScannerOpen(true)}
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Category *
                </label>
                <select
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.category || ""}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="" disabled hidden>Select category...</option>
                  {uniqueCategories
                    .filter((c) => c !== "Uncategorized")
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  <option value="Uncategorized">Uncategorized</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Brand
                </label>
                <select
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.brand || ""}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                >
                  <option value="" disabled hidden>Select brand...</option>
                  {uniqueBrands
                    .filter((b) => b !== "No Brand")
                    .map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  <option value="No Brand">No Brand</option>
                </select>
              </div>

              {canViewCost && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Cost Price (RWF)
                  </label>
                  <Input
                    type="number"
                    value={form.cost_price ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: Number(e.target.value) })
                    }
                    placeholder="0"
                    className="rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Selling Price (RWF)
                </label>
                <Input
                  type="number"
                  disabled={!canSetPrice}
                  value={form.selling_price ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, selling_price: Number(e.target.value) })
                  }
                  placeholder="0"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Stock Quantity
                </label>
                <Input
                  type="number"
                  value={form.stock ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, stock: Number(e.target.value) })
                  }
                  placeholder="0"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Reorder Level
                </label>
                <Input
                  type="number"
                  value={form.min_stock ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, min_stock: Number(e.target.value) })
                  }
                  placeholder="5"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Unit
                </label>
                <select
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.unit || ""}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  <option value="" disabled hidden>Select unit...</option>
                  {uniqueUnits
                    .filter((u) => u !== "No Unit")
                    .map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  <option value="No Unit">No Unit</option>
                </select>
              </div>

              <div />

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <Input
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Product description"
                  className="rounded-xl"
                />
              </div>

              {safeNumber(form.selling_price) < safeNumber(form.cost_price) && (
                <div className="col-span-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700">
                  Selling price is below cost price. This product may create a
                  loss.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeProductDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  create.isPending || update.isPending || uploadingImage
                }
                className="bg-primary hover:bg-primary"
              >
                {uploadingImage
                  ? "Uploading..."
                  : editProduct
                    ? "Save Changes"
                    : "Create Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewProduct} onOpenChange={() => setViewProduct(null)}>
          <DialogContent className="max-w-lg rounded-3xl">
            <DialogHeader>
              <DialogTitle>{viewProduct?.name}</DialogTitle>
              <DialogDescription>
                {viewProduct?.sku} · {viewProduct?.brand || "No brand"}
              </DialogDescription>
            </DialogHeader>

            {viewProduct && (
              <div className="space-y-4">
                <div className="w-full h-48 rounded-3xl bg-muted border overflow-hidden flex items-center justify-center">
                  {viewProduct.image_url ? (
                    <img
                      src={viewProduct.image_url}
                      alt={viewProduct.name}
                      className="w-full h-full object-contain p-4"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Category
                    </span>
                    {viewProduct.category}
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Unit
                    </span>
                    {viewProduct.unit}
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Cost Price
                    </span>
                    <span className="font-data">
                      {formatCurrency(getProductCost(viewProduct))}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Selling Price
                    </span>
                    <span className="font-data font-semibold">
                      {formatCurrency(getProductPrice(viewProduct))}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Stock
                    </span>
                    <span className="font-data">
                      {getProductStock(viewProduct)} {viewProduct.unit}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Reorder Level
                    </span>
                    <span className="font-data">
                      {getProductMinStock(viewProduct)}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Barcode
                    </span>
                    <span className="font-data">
                      {viewProduct.barcode || "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Status
                    </span>
                    <Badge
                      variant="outline"
                      className={statusColors[getStockStatus(viewProduct)]}
                    >
                      {statusLabels[getStockStatus(viewProduct)] ||
                        getStockStatus(viewProduct)}
                    </Badge>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Health Score
                    </span>
                    <span className="font-data">
                      {getProductHealthScore(viewProduct)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Sync Status
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        isOfflineRecord(viewProduct)
                          ? "bg-primary/10 text-muted-foreground border-primary/30"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      }
                    >
                      {isOfflineRecord(viewProduct) ? "Pending Sync" : "Synced"}
                    </Badge>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-xs block">
                      Margin
                    </span>
                    <span
                      className={`font-data ${getMargin(viewProduct) < 0 ? "text-rose-600" : ""}`}
                    >
                      {getMargin(viewProduct).toFixed(1)}%
                    </span>
                  </div>

                  {viewProduct.description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs block">
                        Description
                      </span>
                      {viewProduct.description}
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                style={{ background: NAVY }}
                onClick={() => {
                  setViewProduct(null);
                  if (viewProduct) openEdit(viewProduct);
                }}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!deleteProduct}
          onOpenChange={() => setDeleteProduct(null)}
        >
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Delete Product</DialogTitle>
              <DialogDescription>
                This product will be archived instead of permanently removed so sales and purchase history stay protected.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteProduct(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                Archive
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BarcodeScanner
          open={productScannerOpen}
          onClose={() => setProductScannerOpen(false)}
          onScan={(code) => {
            setForm({ ...form, barcode: code });
            setProductScannerOpen(false);
          }}
        />
      </PageShell>
    </PageBackground>
  );
}
