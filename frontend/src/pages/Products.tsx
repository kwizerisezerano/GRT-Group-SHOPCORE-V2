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
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
  SlidersHorizontal,
  RotateCcw,
  Wifi,
  WifiOff,
  Database,
  UploadCloud,
  PackageCheck,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Activity,
  RefreshCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/*
 * Categories and brands come from the backend (useCategories/useBrands ->
 * /api/categories, /api/brands), not from a hardcoded list. Requirement F5:
 * the frontend must hold no business data of its own.
 *
 * `units` remains a fixed vocabulary rather than tenant data - pcs, kg, box
 * are units of measure, not records a business creates - so it stays a
 * constant, defined here next to its only consumer.
 */
const MEASUREMENT_UNITS = [
  "pcs",
  "kg",
  "g",
  "l",
  "ml",
  "box",
  "pack",
  "carton",
  "dozen",
  "bottle",
  "bag",
  "roll",
  "metre",
] as const;
import {
  useProducts,
  useProductMutations,
  useCategories,
  useBrands,
  type DbProduct,
} from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import warehouseBg from "@/assets/bg-warehouse.jpg";
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

const NAVY = "#2563EB";
const PAGE_SIZE = 24;

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  inactive: "bg-muted text-muted-foreground border-muted",
  low_stock: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  out_of_stock: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  pending: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  pending_update: "bg-blue-500/10 text-blue-600 border-blue-500/30",
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
  const { data: products = [], isLoading } = useProducts();
  const { create, update } = useProductMutations();
  const queryClient = useQueryClient();
  // Tenant catalogue master data, used to seed the filter/select options.
  const { data: categoryRecords } = useCategories();
  const { data: brandRecords } = useBrands();

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
    const values = new Set<string>(MEASUREMENT_UNITS);
    visibleProducts.forEach((p) => p.unit && values.add(p.unit));
    return [...values].filter(Boolean).sort();
  }, [visibleProducts]);

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
    { key: "cost_price" as const, label: "Cost Price" },
    { key: "selling_price" as const, label: "Selling Price" },
    { key: "stock" as const, label: "Stock" },
    { key: "unit" as const, label: "Unit" },
    { key: "status" as const, label: "Status" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "inventory_value" as const, label: "Inventory Value" },
    { key: "retail_value" as const, label: "Retail Value" },
    { key: "potential_profit" as const, label: "Potential Profit" },
    { key: "margin" as const, label: "Margin" },
    { key: "markup" as const, label: "Markup" },
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

        <DropdownMenuItem onClick={() => openEdit(product)}>
          <Pencil className="w-3.5 h-3.5 mr-2" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-destructive"
          onClick={() => setDeleteProduct(product)}
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isLoading) {
    return (
      <PageShell title="Products" description="Loading...">
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageBackground image={warehouseBg} opacity={0.035}>
      <PageShell
        title="Products"
        description="Manage catalog quality, pricing control, replenishment readiness, barcode coverage, stock health, offline product changes, and POS selling readiness."
      >
        <div className="space-y-5">
          {(offlineModeActive || stats.pendingSync > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? (
                      <WifiOff className="h-5 w-5" />
                    ) : (
                      <Database className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive
                        ? "Products are using cached offline data"
                        : "Product changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending product records: {stats.pendingSync}. POS,
                      Dashboard, Reports, and Stock Overview will refresh after
                      sync.
                    </p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {[
              {
                label: "Catalog",
                value: stats.total.toLocaleString(),
                helper: "Total products",
                icon: Package,
                card: "border-blue-200 bg-blue-600 text-white",
                chip: "bg-white/20 text-white",
              },
              {
                label: "Selling",
                value: stats.active.toLocaleString(),
                helper: "Active products",
                icon: CheckCircle2,
                card: "border-emerald-200 bg-emerald-600 text-white",
                chip: "bg-white/20 text-white",
              },
              {
                label: "Reorder",
                value: stats.lowStock.toLocaleString(),
                helper: "Below reorder level",
                icon: AlertTriangle,
                card: "border-amber-200 bg-amber-600 text-white",
                chip: "bg-white/20 text-white",
              },
              {
                label: "Stockout",
                value: stats.outOfStock.toLocaleString(),
                helper: "Out of stock",
                icon: XCircle,
                card: "border-rose-200 bg-rose-600 text-white",
                chip: "bg-white/20 text-white",
              },
              {
                label: "Cost Value",
                value: compactCurrency(stats.inventoryValue),
                helper: "Inventory capital",
                icon: Wallet,
                card: "border-violet-200 bg-violet-600 text-white",
                chip: "bg-white/20 text-white",
              },
              {
                label: "Margin",
                value: `${stats.avgMargin.toFixed(1)}%`,
                helper: "Average margin",
                icon: TrendingUp,
                card: "border-cyan-200 bg-cyan-600 text-white",
                chip: "bg-white/20 text-white",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`rounded-2xl border p-4 shadow-sm ${item.card}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.chip}`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-4 break-words text-2xl font-black font-data">
                    {item.value}
                  </p>
                  <p className="text-xs text-white/80">{item.helper}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-950">
                    Catalog Control
                  </h3>
                  <p className="text-xs text-blue-700/80">
                    Barcode, pricing, SKU quality, and POS readiness
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-semibold text-blue-950">
                      Average catalog health
                    </span>
                    <span className="font-data font-black text-blue-700">
                      {stats.avgHealth}%
                    </span>
                  </div>
                  <Progress value={stats.avgHealth} />
                  <p className="mt-2 text-xs text-blue-700/80">
                    Measures SKU, barcode, price, cost, stock, margin, and
                    offline readiness.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="rounded-2xl bg-amber-600 p-3 text-left text-white shadow-sm"
                  >
                    <p className="text-xs text-white/80">Missing Prices</p>
                    <p className="font-data text-xl font-black">
                      {stats.missingPrices}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="rounded-2xl bg-violet-600 p-3 text-left text-white shadow-sm"
                  >
                    <p className="text-xs text-white/80">No Barcode</p>
                    <p className="font-data text-xl font-black">
                      {stats.noBarcode}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="rounded-2xl bg-rose-600 p-3 text-left text-white shadow-sm"
                  >
                    <p className="text-xs text-white/80">Loss Risk</p>
                    <p className="font-data text-xl font-black">
                      {stats.lossMakers}
                    </p>
                  </button>
                  <div className="rounded-2xl bg-cyan-600 p-3 text-white shadow-sm">
                    <p className="text-xs text-white/80">Total Units</p>
                    <p className="font-data text-xl font-black">
                      {stats.totalUnits.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-950">
                    Pricing & Margin Control
                  </h3>
                  <p className="text-xs text-emerald-700/80">
                    Cost, retail value, markup, and profit protection
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-sm">
                  <p className="text-xs text-white/80">Cost Value</p>
                  <p className="font-data font-black break-words">
                    {compactCurrency(stats.inventoryValue)}
                  </p>
                </div>
                <div className="rounded-2xl bg-violet-600 p-3 text-white shadow-sm">
                  <p className="text-xs text-white/80">Retail Value</p>
                  <p className="font-data font-black break-words">
                    {compactCurrency(stats.retailValue)}
                  </p>
                </div>
                <div className="col-span-2 rounded-2xl bg-emerald-600 p-4 text-white shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-white/80">Potential Profit</p>
                      <p className="font-data text-2xl font-black">
                        {compactCurrency(stats.potentialProfit)}
                      </p>
                    </div>
                    <Badge className="rounded-full bg-white/20 text-white hover:bg-white/20">
                      {stats.avgMargin.toFixed(1)}% margin
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-950">
                    Operations Board
                  </h3>
                  <p className="text-xs text-orange-700/80">
                    Replenishment, stockout, sync, and selling readiness
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("low_stock");
                    setPage(1);
                  }}
                  className="rounded-2xl bg-amber-600 p-3 text-left text-white shadow-sm"
                >
                  <p className="text-xs text-white/80">Low Stock</p>
                  <p className="font-data text-xl font-black">
                    {stats.lowStock}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("out_of_stock");
                    setPage(1);
                  }}
                  className="rounded-2xl bg-rose-600 p-3 text-left text-white shadow-sm"
                >
                  <p className="text-xs text-white/80">Out of Stock</p>
                  <p className="font-data text-xl font-black">
                    {stats.outOfStock}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncFilter("pending");
                    setPage(1);
                  }}
                  className="rounded-2xl bg-cyan-600 p-3 text-left text-white shadow-sm"
                >
                  <p className="text-xs text-white/80">Pending Sync</p>
                  <p className="font-data text-xl font-black">
                    {stats.pendingSync}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCatFilter("all");
                    setBrandFilter("all");
                    setStatusFilter("active");
                    setPage(1);
                  }}
                  className="rounded-2xl bg-emerald-600 p-3 text-left text-white shadow-sm"
                >
                  <p className="text-xs text-white/80">Active</p>
                  <p className="font-data text-xl font-black">{stats.active}</p>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <Badge className="mb-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-600">
                    Replenishment Planning
                  </Badge>
                  <h3 className="text-lg font-black text-indigo-950">
                    Products requiring stock action
                  </h3>
                  <p className="text-sm text-indigo-700/80">
                    Built from reorder levels, current stock, and stockout
                    exposure.
                  </p>
                </div>
                <Button
                  className="rounded-2xl bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    setStatusFilter("low_stock");
                    setPage(1);
                  }}
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Review Queue
                </Button>
              </div>

              {visibleProducts
                .filter(
                  (product) =>
                    getStockStatus(product) === "low_stock" ||
                    getProductStock(product) <= 0,
                )
                .slice(0, 4).length === 0 ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-600 p-5 text-white">
                  <p className="font-black">Replenishment is clear</p>
                  <p className="mt-1 text-sm text-white/80">
                    No product is currently below reorder level or out of stock.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {visibleProducts
                    .filter(
                      (product) =>
                        getStockStatus(product) === "low_stock" ||
                        getProductStock(product) <= 0,
                    )
                    .slice(0, 4)
                    .map((product) => (
                      <div
                        key={product.id}
                        className="rounded-3xl border border-white/70 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-950">
                              {product.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              SKU {product.sku || "—"} · Min{" "}
                              {getProductMinStock(product)}
                            </p>
                          </div>
                          <Badge
                            className={`rounded-full ${getProductStock(product) <= 0 ? "bg-rose-600 hover:bg-rose-600" : "bg-amber-600 hover:bg-amber-600"} text-white`}
                          >
                            {getProductStock(product) <= 0
                              ? "Stockout"
                              : "Reorder"}
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-2xl bg-blue-50 p-2 text-blue-700">
                            <p>Stock</p>
                            <p className="font-data font-black">
                              {getProductStock(product)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 p-2 text-amber-700">
                            <p>Needed</p>
                            <p className="font-data font-black">
                              {Math.max(
                                0,
                                getProductMinStock(product) -
                                  getProductStock(product),
                              )}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700">
                            <p>Value</p>
                            <p className="font-data font-black">
                              {compactCurrency(getRetailValue(product))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="xl:col-span-5 rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black text-rose-950">
                    Product Control Exceptions
                  </h3>
                  <p className="text-xs text-rose-700/80">
                    Pricing, catalog, and cashier-readiness issues.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  {
                    label: "Loss-risk products",
                    value: stats.lossMakers,
                    helper: "Selling below cost",
                    color: "bg-rose-600",
                    action: () => setSearch(""),
                  },
                  {
                    label: "Missing price controls",
                    value: stats.missingPrices,
                    helper: "Cost or selling price missing",
                    color: "bg-orange-600",
                    action: () => setSearch(""),
                  },
                  {
                    label: "No barcode",
                    value: stats.noBarcode,
                    helper: "Slows cashier scanning",
                    color: "bg-violet-600",
                    action: () => setSearch(""),
                  },
                  {
                    label: "Pending offline records",
                    value: stats.pendingSync,
                    helper: "Waiting for sync",
                    color: "bg-cyan-600",
                    action: () => setSyncFilter("pending"),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      setPage(1);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.helper}
                      </p>
                    </div>
                    <span
                      className={`flex h-10 min-w-10 items-center justify-center rounded-2xl px-3 font-data font-black text-white ${item.color}`}
                    >
                      {item.value}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-col gap-4 border-b p-4 lg:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">
                      Products
                    </h2>
                    <Badge variant="outline" className="rounded-full">
                      {offlineModeActive ? (
                        <WifiOff className="mr-1 h-3 w-3 text-amber-600" />
                      ) : (
                        <Wifi className="mr-1 h-3 w-3 text-emerald-600" />
                      )}
                      {offlineModeActive ? "Offline cache" : "Live online"}
                    </Badge>
                    {stats.pendingSync > 0 && (
                      <Badge className="rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/10">
                        <UploadCloud className="mr-1 h-3 w-3" />
                        {stats.pendingSync} pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Showing{" "}
                    {filtered.length === 0
                      ? 0
                      : (currentPage - 1) * PAGE_SIZE + 1}{" "}
                    to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length} products
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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

                  <Button
                    className="rounded-2xl h-10 bg-cyan-600 hover:bg-cyan-700"
                    onClick={refreshProductsEverywhere}
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>

                  <div className="flex rounded-2xl border bg-muted/40 p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      className={
                        viewMode === "grid"
                          ? "rounded-xl h-8 px-3 bg-blue-600 hover:bg-blue-700"
                          : "rounded-xl h-8 px-3"
                      }
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid3X3 className="w-4 h-4 mr-1.5" />
                      Grid
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={viewMode === "list" ? "default" : "ghost"}
                      className={
                        viewMode === "list"
                          ? "rounded-xl h-8 px-3 bg-violet-600 hover:bg-violet-700"
                          : "rounded-xl h-8 px-3"
                      }
                      onClick={() => setViewMode("list")}
                    >
                      <List className="w-4 h-4 mr-1.5" />
                      List
                    </Button>
                  </div>

                  <Button
                    className="rounded-2xl h-10 bg-blue-600 hover:bg-blue-700"
                    onClick={openCreate}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search products by name, SKU, category, brand, or barcode..."
                    className="h-11 rounded-2xl pl-10 placeholder:text-blue-500/80"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select
                    value={catFilter}
                    onValueChange={(v) => {
                      setCatFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[170px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={brandFilter}
                    onValueChange={(v) => {
                      setBrandFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[150px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {uniqueBrands.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[150px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="low_stock">Low Stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending Sync</SelectItem>
                      <SelectItem value="pending_update">
                        Pending Update
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={syncFilter}
                    onValueChange={(v) => {
                      setSyncFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[135px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Sync" />
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
                      const [key, direction] = v.split(":") as [
                        SortKey,
                        "asc" | "desc",
                      ];
                      setSortKey(key);
                      setSortAsc(direction === "asc");
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[150px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at:desc">Newest</SelectItem>
                      <SelectItem value="name:asc">Name A-Z</SelectItem>
                      <SelectItem value="name:desc">Name Z-A</SelectItem>
                      <SelectItem value="stock:asc">Low Stock First</SelectItem>
                      <SelectItem value="stock:desc">
                        High Stock First
                      </SelectItem>
                      <SelectItem value="selling_price:desc">
                        Highest Price
                      </SelectItem>
                      <SelectItem value="selling_price:asc">
                        Lowest Price
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Button className="h-11 rounded-2xl bg-amber-600 hover:bg-amber-700">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filter
                  </Button>

                  <Button
                    className="h-11 rounded-2xl bg-slate-700 hover:bg-slate-800"
                    onClick={resetFilters}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 lg:p-5">
              {paged.length === 0 ? (
                <div className="rounded-3xl border border-blue-200 bg-blue-50 px-6 py-16 text-center text-blue-900">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-sm">
                    <Boxes className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-black">
                    No products match this view
                  </p>
                  <p className="mx-auto mt-2 max-w-lg text-sm text-blue-700/80">
                    Adjust filters, scan a barcode, or create a new product to
                    keep the catalog ready for POS, inventory control, and
                    replenishment planning.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button
                      className="rounded-2xl bg-blue-600 hover:bg-blue-700"
                      onClick={openCreate}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Product
                    </Button>
                    <Button
                      className="rounded-2xl bg-slate-700 hover:bg-slate-800"
                      onClick={resetFilters}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset Filters
                    </Button>
                  </div>
                </div>
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
                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-sm">
                              <Package className="w-9 h-9" />
                            </div>
                          )}

                          <div className="absolute left-2 top-2 flex flex-col gap-1">
                            {pending && (
                              <Badge className="rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/10 text-[10px]">
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
                              className="truncate text-sm font-bold text-slate-950 cursor-pointer"
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left font-medium">SKU</th>
                        <th className="px-4 py-3 text-left font-medium">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Cost
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Price
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Margin
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Stock
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Sync
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {paged.map((product) => {
                        const status = getStockStatus(product);
                        const pending = isOfflineRecord(product);

                        return (
                          <tr key={product.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
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

                            <td className="px-4 py-3 font-data text-xs">
                              {product.sku || "—"}
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                variant="secondary"
                                className="rounded-full text-xs font-normal"
                              >
                                {product.category || "Uncategorized"}
                              </Badge>
                            </td>

                            <td className="px-4 py-3 font-data">
                              {formatCurrency(getProductCost(product))}
                            </td>

                            <td className="px-4 py-3 font-data font-semibold">
                              {formatCurrency(getProductPrice(product))}
                            </td>

                            <td
                              className={`px-4 py-3 font-data ${getMargin(product) < 0 ? "text-rose-600" : ""}`}
                            >
                              {getMargin(product).toFixed(1)}%
                            </td>

                            <td className="px-4 py-3 font-data">
                              {getProductStock(product).toLocaleString()}{" "}
                              {product.unit}
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`rounded-full text-xs ${
                                  statusColors[status] || statusColors.inactive
                                }`}
                              >
                                {statusLabels[status] || status}
                              </Badge>
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`rounded-full text-xs ${
                                  pending
                                    ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                }`}
                              >
                                {pending ? "Pending" : "Synced"}
                              </Badge>
                            </td>

                            <td className="px-4 py-3 text-right">
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
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t px-4 lg:px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages} · {filtered.length} products
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (n) =>
                      n === 1 ||
                      n === totalPages ||
                      Math.abs(n - currentPage) <= 1,
                  )
                  .map((n, index, arr) => {
                    const previous = arr[index - 1];
                    const showDots = previous && n - previous > 1;

                    return (
                      <div key={n} className="flex items-center gap-1">
                        {showDots && (
                          <span className="px-2 text-xs text-muted-foreground">
                            ...
                          </span>
                        )}

                        <Button
                          variant={n === currentPage ? "default" : "outline"}
                          size="icon"
                          className="h-9 w-9 rounded-xl text-xs"
                          style={
                            n === currentPage ? { background: NAVY } : undefined
                          }
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </Button>
                      </div>
                    );
                  })}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

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
                <Select
                  value={form.category || ""}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Brand
                </label>
                <Select
                  value={form.brand || ""}
                  onValueChange={(v) => setForm({ ...form, brand: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueBrands.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Selling Price (RWF)
                </label>
                <Input
                  type="number"
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
                <Select
                  value={form.unit || "pcs"}
                  onValueChange={(v) => setForm({ ...form, unit: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueUnits.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                className="bg-blue-600 hover:bg-blue-700"
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
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
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
