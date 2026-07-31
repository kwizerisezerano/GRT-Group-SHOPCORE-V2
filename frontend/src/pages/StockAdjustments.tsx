import { useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ScanBarcode,
  Layers3,
  Package,
  Activity,
  WifiOff,
  Database,
  UploadCloud,
  RotateCcw,
  Grid3X3,
  List,
  Boxes,
  Gauge,
  FileWarning,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCachedProducts,
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedProducts,
  saveCachedTable,
  saveOfflineStockMovement,
  savePending,
  patchCachedProductStock,
  saveOfflineStockBatch,
  clearPending,
  removeCachedRecord,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
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
import { useProducts, useStockMovements } from "@/hooks/useSupabaseData";
import { toast } from "sonner";
import warehouseBg from "@/assets/bg-warehouse.jpg";

const NAVY = "#2563EB";

const ACTION_SURFACES = {
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  orange: "border-orange-200 bg-orange-50 text-orange-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-900",
};

interface StockMovement {
  id: string;
  tenant_id: string;
  user_id: string | null;
  product_id: string | null;
  product_name: string | null;
  movement_type: string | null;
  quantity_change: number | null;
  stock_before: number | null;
  stock_after: number | null;
  reference: string | null;
  reference_id: string | null;
  notes: string | null;
  unit_cost?: number | null;
  selling_price?: number | null;
  created_at: string;
  created_offline_at?: string;
  updated_offline_at?: string;
  sync_status?: string;
  offline_id?: string;

  operation?: "create" | "update" | "delete";
  updated_at?: string;
}

const adjustmentTypes = [
  { value: "adjustment", label: "Manual Adjustment" },
  { value: "correction", label: "Stock Correction" },
  { value: "damage", label: "Damage" },
  { value: "wastage", label: "Wastage" },
  { value: "opening_stock", label: "Opening Stock" },
];

const PAGE_SIZE = 18;

function formatDateTime(value: any) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function movementRiskScore(movement: any) {
  const qty = safeNumber(movement?.quantity_change);
  const before = safeNumber(movement?.stock_before);
  const after = safeNumber(movement?.stock_after);
  const type = String(movement?.movement_type || "").toLowerCase();

  let score = 0;
  if (["damage", "wastage"].includes(type)) score += 30;
  if (type === "correction") score += 18;
  if (after < 0) score += 50;
  if (Math.abs(qty) >= 100) score += 15;
  if (!movement?.reference) score += 8;
  if (isPendingSync(movement)) score += 8;
  if (before >= 0 && after >= 0 && Math.abs(after - before) !== Math.abs(qty))
    score += 20;

  return Math.min(100, score);
}

function riskBadgeClass(score: number) {
  if (score >= 70) return "bg-rose-500/10 text-rose-600 border-rose-500/30";
  if (score >= 40)
    return "bg-orange-500/10 text-orange-600 border-orange-500/30";
  if (score >= 15) return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
}

function riskLabel(score: number) {
  if (score >= 70) return "Critical";
  if (score >= 40) return "High Risk";
  if (score >= 15) return "Review";
  return "Normal";
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function sortByCreatedAtDesc(records: any[]) {
  return [...(records || [])].sort((a, b) => {
    const aDate = new Date(
      a?.created_at || a?.created_offline_at || 0,
    ).getTime();
    const bDate = new Date(
      b?.created_at || b?.created_offline_at || 0,
    ).getTime();
    return bDate - aDate;
  });
}

function shouldSaveOffline(error: unknown) {
  return !isOnline() || isNetworkError(error);
}

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function safeNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getProductCost(product: any) {
  return safeNumber(
    product?.cost_price || product?.purchase_price || product?.unit_cost,
  );
}

function getProductSellingPrice(product: any) {
  return safeNumber(product?.selling_price || product?.price);
}

function money(value: any) {
  return `RWF ${safeNumber(value).toLocaleString()}`;
}

function getMovementCost(movement: any) {
  const directCost = safeNumber(movement?.unit_cost);
  if (directCost > 0) return directCost;

  const match = String(movement?.notes || "").match(/Cost Price:\s*([0-9.]+)/i);
  return match ? safeNumber(match[1]) : 0;
}

function buildAdjustmentNotes(
  baseNotes: string,
  unitCost: number,
  sellingPrice: number,
) {
  const noteParts = [];

  if (baseNotes.trim()) noteParts.push(baseNotes.trim());
  noteParts.push(`Cost Price: ${unitCost}`);
  noteParts.push(`Selling Price: ${sellingPrice}`);

  return noteParts.join(" | ");
}

function getProductStock(product: any) {
  return safeNumber(product?.stock_quantity ?? product?.stock ?? 0);
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

function isDeletedRecord(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function upsertRecord(records: any[] | undefined, nextRecord: any) {
  const list = Array.isArray(records) ? records : [];
  const found = list.some((record) => record?.id === nextRecord?.id);

  if (found) {
    return list.map((record) =>
      record?.id === nextRecord?.id ? { ...record, ...nextRecord } : record,
    );
  }

  return [nextRecord, ...list];
}

function replaceRecord(
  records: any[] | undefined,
  id: string,
  patch: any,
  fallbackRecord?: any,
) {
  const list = Array.isArray(records) ? records : [];
  const found = list.some((record) => String(record?.id) === String(id));

  if (!found && fallbackRecord) {
    return [{ ...fallbackRecord, ...patch }, ...list];
  }

  return list.map((record) =>
    String(record?.id) === String(id) ? { ...record, ...patch } : record,
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  message = "Operation timeout",
  timeoutMs = 10000,
): Promise<T> {
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

async function invalidateStockQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["products"] }),
    queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
    queryClient.invalidateQueries({ queryKey: ["stock_movements"] }),
    queryClient.invalidateQueries({ queryKey: ["stock_batches"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["reports"] }),
  ]).catch(() => undefined);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
  }
}

export default function StockAdjustments() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: movementRows = [], isLoading } = useStockMovements(5000);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "compact">("grid");
  const [page, setPage] = useState(1);
  const [manualSaving, setManualSaving] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [movementType, setMovementType] = useState("adjustment");
  const [quantityChange, setQuantityChange] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");

  const selectedProduct = products.find(
    (p) => String(p.id) === String(selectedProductId),
  );
  const stockBefore = selectedProduct ? getProductStock(selectedProduct) : 0;
  const change = Number(quantityChange || 0);
  const stockAfter = stockBefore + change;
  const currentUnitCost = selectedProduct ? getProductCost(selectedProduct) : 0;
  const currentSellingPrice = selectedProduct
    ? getProductSellingPrice(selectedProduct)
    : 0;
  const adjustmentUnitCost = unitCost.trim()
    ? safeNumber(unitCost)
    : currentUnitCost;
  const adjustmentSellingPrice = sellingPrice.trim()
    ? safeNumber(sellingPrice)
    : currentSellingPrice;
  const adjustmentNotes = buildAdjustmentNotes(
    notes,
    adjustmentUnitCost,
    adjustmentSellingPrice,
  );

  const offlineModeActive =
    !isOnline() || isOfflineMode() || !session?.access_token;

  const movements = useMemo(
    () => sortByCreatedAtDesc((movementRows || []) as StockMovement[]),
    [movementRows],
  );

  const adjustments = useMemo(
    () =>
      movements
        .filter((m) => !isDeletedRecord(m))
        .filter((m) =>
          [
            "adjustment",
            "damage",
            "wastage",
            "correction",
            "opening_stock",
          ].includes(m.movement_type || ""),
        ),
    [movements],
  );

  const filteredAdjustments = useMemo(() => {
    const q = search.toLowerCase().trim();

    return adjustments
      .filter((m) => {
        const matchesSearch =
          !q ||
          (m.product_name || "").toLowerCase().includes(q) ||
          (m.reference || "").toLowerCase().includes(q) ||
          (m.notes || "").toLowerCase().includes(q) ||
          String(m.quantity_change || "").includes(q) ||
          String(m.stock_before || "").includes(q) ||
          String(m.stock_after || "").includes(q);

        const matchesType =
          typeFilter === "all" || m.movement_type === typeFilter;
        const pending = isPendingSync(m);
        const matchesSync =
          syncFilter === "all" ||
          (syncFilter === "pending" && pending) ||
          (syncFilter === "synced" && !pending);

        return matchesSearch && matchesType && matchesSync;
      })
      .sort((a, b) => {
        const aRisk = movementRiskScore(a);
        const bRisk = movementRiskScore(b);
        if (aRisk !== bRisk) return bRisk - aRisk;

        const aDate = new Date(
          (a as any).created_at || (a as any).created_offline_at || 0,
        ).getTime();
        const bDate = new Date(
          (b as any).created_at || (b as any).created_offline_at || 0,
        ).getTime();
        return bDate - aDate;
      });
  }, [adjustments, search, typeFilter, syncFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAdjustments.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pagedAdjustments = filteredAdjustments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(() => {
    const now = new Date();

    const thisMonth = adjustments.filter((m) => {
      const d = new Date(
        (m as any).created_at || (m as any).created_offline_at || 0,
      );
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });

    const totalIncrease = adjustments
      .filter((m) => Number(m.quantity_change || 0) > 0)
      .reduce((sum, m) => sum + Number(m.quantity_change || 0), 0);

    const totalDecrease = adjustments
      .filter((m) => Number(m.quantity_change || 0) < 0)
      .reduce((sum, m) => sum + Math.abs(Number(m.quantity_change || 0)), 0);

    const damages = adjustments.filter(
      (m) => m.movement_type === "damage",
    ).length;
    const wastage = adjustments.filter(
      (m) => m.movement_type === "wastage",
    ).length;
    const corrections = adjustments.filter(
      (m) => m.movement_type === "correction",
    ).length;
    const openingStock = adjustments.filter(
      (m) => m.movement_type === "opening_stock",
    ).length;
    const pending = adjustments.filter(isPendingSync).length;
    const risky = adjustments.filter((m) => movementRiskScore(m) >= 15).length;
    const critical = adjustments.filter(
      (m) => movementRiskScore(m) >= 70,
    ).length;
    const netChange = totalIncrease - totalDecrease;
    const valueImpact = adjustments.reduce((sum, m) => {
      const qty = safeNumber(m.quantity_change);
      const cost = getMovementCost(m);
      return sum + qty * cost;
    }, 0);

    const adjustmentHealth =
      adjustments.length > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(100 - risky * 3 - critical * 10 - pending * 2),
            ),
          )
        : 100;

    return {
      thisMonth: thisMonth.length,
      totalIncrease,
      totalDecrease,
      netChange,
      valueImpact,
      damages,
      wastage,
      corrections,
      openingStock,
      pending,
      risky,
      critical,
      adjustmentHealth,
      totalAdjustments: adjustments.length,
      productsCount: products.length,
    };
  }, [adjustments, products]);

  const ensureOfflineOpeningBatch = async () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!selectedProduct) throw new Error("Please select a product");
    if (stockBefore <= 0) return null;

    const cachedBatches = await getCachedTable("stock_batches");
    const hasExistingBatch = cachedBatches.some(
      (batch: any) =>
        String(batch.product_id) === String(selectedProduct.id) &&
        String(batch.tenant_id) === String(tenantId) &&
        String(batch.status || "active") !== "deleted",
    );

    if (hasExistingBatch) return null;

    const now = new Date().toISOString();
    const openingBatch = {
      id: makeLocalId("offline-opening-batch"),
      tenant_id: tenantId,
      product_id: selectedProduct.id,
      batch_no: `OPENING-${String(selectedProduct.id).slice(0, 8)}`,
      source_type: "opening_stock",
      source_id: null,
      quantity_in: stockBefore,
      quantity_remaining: stockBefore,
      cost_price: currentUnitCost,
      selling_price: currentSellingPrice,
      status: "active",
      created_at: (selectedProduct as any).created_at || now,
      created_offline_at: now,
      operation: "create",
      sync_status: "pending",
    };

    await saveOfflineStockBatch(openingBatch);
    return openingBatch;
  };

  const createOfflineBatch = async () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!selectedProduct) throw new Error("Please select a product");
    if (change <= 0) return null;

    await ensureOfflineOpeningBatch();

    const now = new Date().toISOString();
    const batch = {
      id: makeLocalId("offline-stock-batch"),
      tenant_id: tenantId,
      product_id: selectedProduct.id,
      batch_no: `OFF-BATCH-${Date.now().toString().slice(-8)}`,
      source_type: "adjustment",
      source_id: null,
      quantity_in: change,
      quantity_remaining: change,
      cost_price: adjustmentUnitCost,
      selling_price: adjustmentSellingPrice,
      status: "active",
      created_at: now,
      created_offline_at: now,
      operation: "create",
      sync_status: "pending",
    };

    await saveOfflineStockBatch(batch);
    return batch;
  };

  const consumeOfflineBatchesForNegativeAdjustment = async () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!selectedProduct) throw new Error("Please select a product");
    if (change >= 0) return;

    await ensureOfflineOpeningBatch();

    let remainingToRemove = Math.abs(change);
    const cachedBatches = await getCachedTable("stock_batches");
    const nextBatches = [...cachedBatches]
      .sort(
        (a: any, b: any) =>
          new Date(a?.created_at || 0).getTime() -
          new Date(b?.created_at || 0).getTime(),
      )
      .map((batch: any) => {
        if (
          remainingToRemove <= 0 ||
          String(batch.product_id) !== String(selectedProduct.id) ||
          String(batch.tenant_id) !== String(tenantId) ||
          String(batch.status || "active") === "deleted" ||
          safeNumber(batch.quantity_remaining) <= 0
        ) {
          return batch;
        }

        const batchRemaining = safeNumber(batch.quantity_remaining);
        const removeQty = Math.min(batchRemaining, remainingToRemove);
        const nextRemaining = batchRemaining - removeQty;
        remainingToRemove -= removeQty;

        return {
          ...batch,
          quantity_remaining: nextRemaining,
          status: nextRemaining <= 0 ? "depleted" : "active",
          operation: String(batch.id || "").startsWith("offline-")
            ? batch.operation || "create"
            : "update",
          sync_status: "pending",
          updated_at: new Date().toISOString(),
          updated_offline_at: new Date().toISOString(),
        };
      });

    await saveCachedTable("stock_batches", nextBatches);

    for (const batch of nextBatches) {
      if (
        String(batch.product_id) === String(selectedProduct.id) &&
        String(batch.tenant_id) === String(tenantId) &&
        batch.sync_status === "pending"
      ) {
        await savePending("stock_batches", batch);
      }
    }
  };

  const saveOfflineAdjustment = async () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!selectedProduct) throw new Error("Please select a product");

    const timestamp = new Date().toISOString();
    const offlineUserId = user?.id || "offline-user";

    const batch = await withTimeout(
      createOfflineBatch(),
      "Offline stock batch save timeout",
    );

    await withTimeout(
      consumeOfflineBatchesForNegativeAdjustment(),
      "Offline batch consumption timeout",
    );

    const movement: StockMovement = {
      id: makeLocalId("offline-stock-movement"),
      tenant_id: tenantId,
      user_id: offlineUserId,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      movement_type: movementType,
      quantity_change: change,
      stock_before: stockBefore,
      stock_after: stockAfter,
      reference: reference.trim() || "Direct Stock Adjustment",
      reference_id: batch?.id || null,
      notes: batch
        ? `${adjustmentNotes} | Batch: ${batch.batch_no}`
        : adjustmentNotes,
      created_at: timestamp,
      created_offline_at: timestamp,
      updated_offline_at: timestamp,
      operation: "create",
      sync_status: "pending",
    };

    await withTimeout(
      saveOfflineStockMovement(movement),
      "Offline stock movement save timeout",
    );

    const productPatch = {
      stock: stockAfter,
      stock_quantity: stockAfter,
      status: stockAfter <= 0 ? "out_of_stock" : "active",
      cost_price: adjustmentUnitCost,
      selling_price: adjustmentSellingPrice,
      updated_at: timestamp,
      updated_offline_at: timestamp,
      sync_status: "pending",
    };

    const cachedProducts = await withTimeout(
      getCachedProducts(),
      "Offline products cache read timeout",
    );

    if (
      cachedProducts.some(
        (product: any) => String(product.id) === String(selectedProduct.id),
      )
    ) {
      await withTimeout(
        patchCachedProductStock(selectedProduct.id, change, {
          cost_price: adjustmentUnitCost,
          selling_price: adjustmentSellingPrice,
          sync_status: "pending",
          updated_offline_at: timestamp,
        }),
        "Offline product stock patch timeout",
      );
    } else {
      await withTimeout(
        saveCachedProducts([
          { ...selectedProduct, ...productPatch },
          ...cachedProducts,
        ]),
        "Offline products cache save timeout",
      );
    }

    queryClient.setQueriesData({ queryKey: ["products"] }, (oldData: any) =>
      replaceRecord(oldData, selectedProduct.id, productPatch, selectedProduct),
    );
    queryClient.setQueriesData(
      { queryKey: ["stock-movements"] },
      (oldData: any) => upsertRecord(oldData, movement),
    );
    queryClient.setQueriesData(
      { queryKey: ["stock_movements"] },
      (oldData: any) => upsertRecord(oldData, movement),
    );

    return movement;
  };

  const ensureOnlineOpeningBatch = async () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!selectedProduct) throw new Error("Please select a product");
    if (stockBefore <= 0) return null;

    const { data: existingBatches, error: existingError } = await (
      supabase as any
    )
      .from("stock_batches")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("product_id", selectedProduct.id)
      .limit(1);

    if (existingError) throw existingError;
    if (existingBatches?.length) return null;

    const openingPayload = {
      tenant_id: tenantId,
      product_id: selectedProduct.id,
      batch_no: `OPENING-${String(selectedProduct.id).slice(0, 8)}`,
      source_type: "opening_stock",
      source_id: null,
      quantity_in: stockBefore,
      quantity_remaining: stockBefore,
      cost_price: currentUnitCost,
      selling_price: currentSellingPrice,
      status: "active",
      created_at:
        (selectedProduct as any).created_at || new Date().toISOString(),
    };

    const { data, error } = await (supabase as any)
      .from("stock_batches")
      .insert(openingPayload)
      .select()
      .single();

    if (error) throw error;

    const cachedBatches = await getCachedTable("stock_batches");
    await saveCachedTable("stock_batches", [data, ...cachedBatches]);

    return data;
  };

  const createOnlineBatch = async () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!selectedProduct) throw new Error("Please select a product");
    if (change <= 0) return null;

    await ensureOnlineOpeningBatch();

    const batchPayload = {
      tenant_id: tenantId,
      product_id: selectedProduct.id,
      batch_no: `BATCH-${Date.now().toString().slice(-8)}`,
      source_type: "adjustment",
      source_id: null,
      quantity_in: change,
      quantity_remaining: change,
      cost_price: adjustmentUnitCost,
      selling_price: adjustmentSellingPrice,
      status: "active",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase as any)
      .from("stock_batches")
      .insert(batchPayload)
      .select()
      .single();

    if (error) throw error;

    const cachedBatches = await getCachedTable("stock_batches");
    await saveCachedTable("stock_batches", [data, ...cachedBatches]);

    return data;
  };

  const consumeBatchesForNegativeAdjustment = async () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!selectedProduct) throw new Error("Please select a product");
    if (change >= 0) return;

    let remainingToRemove = Math.abs(change);

    const { data: batches, error } = await (supabase as any)
      .from("stock_batches")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", selectedProduct.id)
      .gt("quantity_remaining", 0)
      .order("created_at", { ascending: true });

    if (error) throw error;

    for (const batch of batches || []) {
      if (remainingToRemove <= 0) break;

      const batchRemaining = Number(batch.quantity_remaining || 0);
      const removeQty = Math.min(batchRemaining, remainingToRemove);
      const nextRemaining = batchRemaining - removeQty;

      const { error: batchUpdateError } = await (supabase as any)
        .from("stock_batches")
        .update({
          quantity_remaining: nextRemaining,
          status: nextRemaining <= 0 ? "depleted" : "active",
        })
        .eq("id", batch.id)
        .eq("tenant_id", tenantId);

      if (batchUpdateError) throw batchUpdateError;

      remainingToRemove -= removeQty;
    }
  };

  const performAdjustmentSave = async () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!user?.id && !offlineModeActive) throw new Error("Not signed in");
    if (!selectedProduct) throw new Error("Please select a product");
    if (!quantityChange.trim()) throw new Error("Quantity change is required");
    if (Number.isNaN(change))
      throw new Error("Quantity change must be a number");
    if (change === 0) throw new Error("Quantity change cannot be zero");
    if (stockAfter < 0) throw new Error("Stock cannot go below zero");

    if (offlineModeActive) {
      return await withTimeout(
        saveOfflineAdjustment(),
        "Offline stock adjustment save timeout",
        12000,
      );
    }

    try {
      const batch = await withTimeout(
        createOnlineBatch(),
        "Online stock batch save timeout",
        12000,
      );
      await withTimeout(
        consumeBatchesForNegativeAdjustment(),
        "Online batch consumption timeout",
        12000,
      );
      const { error: productError } = await withTimeout<any>(
        Promise.resolve(
          (supabase as any)
            .from("products")
            .update({
              stock: stockAfter,
              status: stockAfter <= 0 ? "out_of_stock" : "active",
              cost_price: adjustmentUnitCost,
              selling_price: adjustmentSellingPrice,
              updated_at: new Date().toISOString(),
            })
            .eq("id", selectedProduct.id)
            .eq("tenant_id", tenantId),
        ),
        "Online product stock update timeout",
        12000,
      );

      if (productError) throw productError;

      const movementPayload = {
        tenant_id: tenantId,
        user_id: user?.id || null,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        movement_type: movementType,
        quantity_change: change,
        stock_before: stockBefore,
        stock_after: stockAfter,
        reference: reference.trim() || "Direct Stock Adjustment",
        reference_id: batch?.id || null,
        notes: batch
          ? `${adjustmentNotes} | Batch: ${batch.batch_no}`
          : adjustmentNotes,
        created_at: new Date().toISOString(),
      };
      const { data, error: movementError } = await withTimeout<any>(
        Promise.resolve(
          (supabase as any)
            .from("stock_movements")
            .insert(movementPayload)
            .select()
            .single(),
        ),
        "Online stock movement save timeout",
        12000,
      );

      if (movementError) throw movementError;

      const productPatch = {
        stock: stockAfter,
        stock_quantity: stockAfter,
        status: stockAfter <= 0 ? "out_of_stock" : "active",
        cost_price: adjustmentUnitCost,
        purchase_price: adjustmentUnitCost,
        unit_cost: adjustmentUnitCost,
        selling_price: adjustmentSellingPrice,
        price: adjustmentSellingPrice,
        updated_at: new Date().toISOString(),
        updated_offline_at: new Date().toISOString(),
      };
      const cachedProducts = await withTimeout(
        getCachedProducts(),
        "Products cache read timeout",
        8000,
      );

      await withTimeout(
        saveCachedProducts(
          cachedProducts.some(
            (product: any) => String(product.id) === String(selectedProduct.id),
          )
            ? cachedProducts.map((product: any) =>
                String(product.id) === String(selectedProduct.id)
                  ? { ...product, ...productPatch }
                  : product,
              )
            : [{ ...selectedProduct, ...productPatch }, ...cachedProducts],
        ),
        "Products cache save timeout",
        8000,
      );

      queryClient.setQueriesData({ queryKey: ["products"] }, (oldData: any) =>
        replaceRecord(
          oldData,
          selectedProduct.id,
          productPatch,
          selectedProduct,
        ),
      );
      queryClient.setQueriesData(
        { queryKey: ["stock-movements"] },
        (oldData: any) => upsertRecord(oldData, data),
      );
      queryClient.setQueriesData(
        { queryKey: ["stock_movements"] },
        (oldData: any) => upsertRecord(oldData, data),
      );
      return data;
    } catch (error) {
      if (
        shouldSaveOffline(error) ||
        String((error as any)?.message || "")
          .toLowerCase()
          .includes("timeout")
      ) {
        const offlineRecord = await withTimeout(
          saveOfflineAdjustment(),
          "Offline fallback stock adjustment save timeout",
          12000,
        );
        return offlineRecord;
      }

      throw error;
    }
  };

  const handleSaveAdjustment = async () => {
    if (manualSaving) return;

    setManualSaving(true);

    try {
      const data = await withTimeout(
        performAdjustmentSave(),
        "Stock adjustment save timeout. The record was not completed.",
        30000,
      );

      toast.success(
        data?.sync_status === "pending"
          ? "Stock adjustment saved offline. It will sync when internet returns."
          : "Stock updated successfully",
      );

      closeDialog();

      void invalidateStockQueries(queryClient);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update stock");
    } finally {
      setManualSaving(false);
    }
  };

  const deleteAdjustment = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("No active workspace");

      if (
        offlineModeActive ||
        String(id).startsWith("offline-stock-movement-")
      ) {
        await withTimeout(
          clearPending("stock_movements", id),
          "Offline pending adjustment delete timeout",
        );
        await withTimeout(
          removeCachedRecord("stock_movements", id),
          "Offline cached adjustment delete timeout",
        );

        return { sync_status: "removed" };
      }

      const { error } = await (supabase as any)
        .from("stock_movements")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: async (data: any) => {
      await invalidateStockQueries(queryClient);
      toast.success(
        data?.sync_status === "removed"
          ? "Adjustment removed locally"
          : "Adjustment deleted",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportRows = filteredAdjustments.map((item) => {
    const quantity = safeNumber(item.quantity_change);
    const risk = movementRiskScore(item);

    return {
      product: item.product_name || "",
      type: item.movement_type || "",
      quantity,
      stock_before: safeNumber(item.stock_before),
      stock_after: safeNumber(item.stock_after),
      reference: item.reference || "",
      notes: item.notes || "",
      risk: riskLabel(risk),
      sync_status: isPendingSync(item) ? "Pending" : "Synced",
      created_at: formatDateTime(
        (item as any).created_at || (item as any).created_offline_at,
      ),
    };
  });

  const exportCols = [
    { key: "product" as const, label: "Product" },
    { key: "type" as const, label: "Type" },
    { key: "quantity" as const, label: "Quantity" },
    { key: "stock_before" as const, label: "Stock Before" },
    { key: "stock_after" as const, label: "Stock After" },
    { key: "reference" as const, label: "Reference" },
    { key: "risk" as const, label: "Risk" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "created_at" as const, label: "Created" },
  ];

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setSyncFilter("all");
    setPage(1);
  };

  const openCreate = () => {
    setSelectedProductId("");
    setMovementType("adjustment");
    setQuantityChange("");
    setReference("");
    setNotes("");
    setUnitCost("");
    setSellingPrice("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedProductId("");
    setMovementType("adjustment");
    setQuantityChange("");
    setReference("");
    setNotes("");
    setUnitCost("");
    setSellingPrice("");
  };

  const handleScan = (code: string) => {
    const product = products.find(
      (p) =>
        String(p.barcode || "") === String(code) ||
        String(p.sku || "") === String(code),
    );

    if (!product) {
      toast.error(`No product found for code: ${code}`);
      return;
    }

    setSelectedProductId(product.id);
    setUnitCost(String(getProductCost(product)));
    setSellingPrice(String(getProductSellingPrice(product)));
    setScannerOpen(false);
    toast.success(`Selected ${product.name}`);
  };

  const typeBadgeClass = (type: string | null) => {
    switch (type) {
      case "damage":
        return "bg-rose-500/10 text-rose-600 border-rose-500/30";
      case "wastage":
        return "bg-orange-500/10 text-orange-600 border-orange-500/30";
      case "correction":
        return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      case "opening_stock":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
      default:
        return "bg-blue-600/10 text-blue-600 border-blue-500/30";
    }
  };

  const topSummaryCards = [
    {
      label: "This Month",
      value: stats.thisMonth,
      helper: "Current month activity",
      icon: ClipboardList,
      wrapper: "bg-blue-600 text-white border-blue-500",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Stock Added",
      value: stats.totalIncrease,
      helper: "Total units increased",
      icon: TrendingUp,
      wrapper: "bg-emerald-600 text-white border-emerald-500",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Stock Reduced",
      value: stats.totalDecrease,
      helper: "Total units reduced",
      icon: TrendingDown,
      wrapper: "bg-orange-600 text-white border-orange-500",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Damage Cases",
      value: stats.damages,
      helper: "Damaged stock records",
      icon: AlertTriangle,
      wrapper: "bg-rose-600 text-white border-rose-500",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
  ];

  const operationCards = [
    {
      label: "All Records",
      value: stats.totalAdjustments,
      helper: "Full adjustment history",
      icon: ClipboardList,
      card: "border-blue-200 bg-blue-50 text-blue-900",
      iconBg: "bg-blue-600",
      action: () => {
        setTypeFilter("all");
        setSyncFilter("all");
        setPage(1);
      },
    },
    {
      label: "Stock Added",
      value: compactNumber(stats.totalIncrease),
      helper: "Positive quantity changes",
      icon: TrendingUp,
      card: "border-emerald-200 bg-emerald-50 text-emerald-900",
      iconBg: "bg-emerald-600",
      action: () => {
        setTypeFilter("all");
        setSyncFilter("all");
        setPage(1);
      },
    },
    {
      label: "Stock Reduced",
      value: compactNumber(stats.totalDecrease),
      helper: "Negative quantity changes",
      icon: TrendingDown,
      card: "border-orange-200 bg-orange-50 text-orange-900",
      iconBg: "bg-orange-600",
      action: () => {
        setTypeFilter("all");
        setSyncFilter("all");
        setPage(1);
      },
    },
    {
      label: "Damages",
      value: stats.damages,
      helper: "Damaged stock records",
      icon: AlertTriangle,
      card: "border-rose-200 bg-rose-50 text-rose-900",
      iconBg: "bg-rose-600",
      action: () => {
        setTypeFilter("damage");
        setPage(1);
      },
    },
    {
      label: "Corrections",
      value: stats.corrections,
      helper: "Stock correction records",
      icon: ShieldCheck,
      card: "border-violet-200 bg-violet-50 text-violet-900",
      iconBg: "bg-violet-600",
      action: () => {
        setTypeFilter("correction");
        setPage(1);
      },
    },
    {
      label: "Pending Sync",
      value: stats.pending,
      helper: "Offline records waiting",
      icon: UploadCloud,
      card: "border-cyan-200 bg-cyan-50 text-cyan-900",
      iconBg: "bg-cyan-600",
      action: () => {
        setSyncFilter("pending");
        setPage(1);
      },
    },
  ];

  return (
    <PageBackground image={warehouseBg} opacity={0.04}>
      <PageShell
        title="Stock Adjustments"
        description="Manage stock corrections, damages, wastage, opening balances, batch impact, audit review, and product availability."
      >
        {(offlineModeActive || stats.pending > 0) && (
          <div className="mb-6 rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
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
                      ? "Stock adjustments are using offline mode"
                      : "Stock adjustments waiting to sync"}
                  </p>
                  <p className="text-sm opacity-90">
                    Pending adjustment records: {stats.pending}. Product stock,
                    batches, and stock movements are updated locally first.
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

        <div className="rounded-3xl border bg-card shadow-sm overflow-hidden mb-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.45fr]">
            <div className="relative overflow-hidden border-b xl:border-b-0 xl:border-r bg-gradient-to-br from-white via-slate-50 to-blue-50/40 p-6 lg:p-7">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-600/10 blur-2xl" />
              <div className="absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-emerald-500/10 blur-2xl" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-600 mb-5">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Inventory Control
                </div>

                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex items-center justify-center shadow-sm">
                      <Layers3 className="w-8 h-8" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white" />
                  </div>

                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-950">
                      Stock Adjustments
                    </h1>

                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                      Add, reduce, correct, or record damaged stock with full
                      movement history, batch impact, offline readiness, and
                      audit risk visibility.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Activity className="w-3.5 h-3.5 text-blue-600" />
                      Total Records
                    </div>
                    <p className="text-sm font-semibold mt-1">
                      {stats.totalAdjustments}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      Products
                    </div>
                    <p className="text-sm font-semibold mt-1">
                      {stats.productsCount}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Gauge className="w-3.5 h-3.5 text-violet-600" />
                      Audit Health
                    </div>
                    <p className="text-sm font-semibold mt-1">
                      {stats.adjustmentHealth}% Ready
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-slate-50/70 p-6 lg:p-7">
              {topSummaryCards.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-3xl border ${item.wrapper} p-5 shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={`w-11 h-11 rounded-2xl ${item.iconBox} flex items-center justify-center`}
                    >
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="h-2 w-2 rounded-full bg-current opacity-30" />
                  </div>

                  <p className="text-sm font-medium opacity-90">{item.label}</p>

                  <p
                    className={`font-bold font-data mt-1 leading-tight tracking-tight ${item.valueColor} ${
                      String(item.value).length > 10
                        ? "text-base xl:text-lg break-words max-w-full"
                        : "text-2xl"
                    }`}
                  >
                    {item.value}
                  </p>

                  <div className="mt-4 inline-flex rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-medium text-white/90">
                    {item.helper}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mb-6">
          {operationCards.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className={`rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.card}`}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm ${item.iconBg}`}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold opacity-80">{item.label}</p>
              <p className="mt-1 font-data text-2xl font-black">{item.value}</p>
              <p className="mt-1 text-[11px] opacity-70">{item.helper}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-6">
          <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50/80 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Adjustment Health</h3>
                <p className="text-xs text-muted-foreground">
                  Audit readiness and sync quality
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>Health Score</span>
                  <span className="font-data">{stats.adjustmentHealth}%</span>
                </div>
                <Progress value={stats.adjustmentHealth} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-700">
                  <p className="text-xs">Critical</p>
                  <p className="font-data font-bold">{stats.critical}</p>
                </div>
                <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-700">
                  <p className="text-xs">Review</p>
                  <p className="font-data font-bold">{stats.risky}</p>
                </div>
                <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-700">
                  <p className="text-xs">Pending</p>
                  <p className="font-data font-bold">{stats.pending}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border border-emerald-200 bg-emerald-50/80 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Stock Impact</h3>
                <p className="text-xs text-muted-foreground">
                  Net effect of all adjustments
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">Net Change</p>
                <p
                  className={`font-data font-bold ${stats.netChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {stats.netChange >= 0 ? "+" : ""}
                  {stats.netChange}
                </p>
              </div>
              <div className="rounded-2xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">Value Impact</p>
                <p
                  className={`font-data font-bold ${stats.valueImpact >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {money(stats.valueImpact)}
                </p>
              </div>
              <div className="rounded-2xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">Corrections</p>
                <p className="font-data font-bold">{stats.corrections}</p>
              </div>
              <div className="rounded-2xl border bg-white/80 p-3">
                <p className="text-xs text-muted-foreground">Opening Stock</p>
                <p className="font-data font-bold">{stats.openingStock}</p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-3xl border border-orange-200 bg-orange-50/80 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-sm">
                <FileWarning className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Loss Control</h3>
                <p className="text-xs text-muted-foreground">
                  Damage and wastage monitoring
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-rose-500/10 p-4 text-rose-700">
                <p className="text-xs">Damage Cases</p>
                <p className="font-data text-xl font-bold">{stats.damages}</p>
              </div>
              <div className="rounded-2xl bg-orange-500/10 p-4 text-orange-700">
                <p className="text-xs">Wastage Cases</p>
                <p className="font-data text-xl font-bold">{stats.wastage}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-card shadow-sm p-4 mb-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-muted rounded-2xl">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search product, reference, quantity, stock before/after, or notes..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full xl:w-48 h-11 rounded-2xl">
                <SelectValue placeholder="Adjustment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {adjustmentTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={syncFilter}
              onValueChange={(value) => {
                setSyncFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full xl:w-40 h-11 rounded-2xl">
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
                { key: "grid" as const, icon: Grid3X3, label: "Grid" },
                { key: "list" as const, icon: List, label: "List" },
              ].map((mode) => (
                <Button
                  key={mode.key}
                  type="button"
                  size="sm"
                  variant={viewMode === mode.key ? "default" : "ghost"}
                  className={`h-9 rounded-xl ${viewMode === mode.key ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}
                  onClick={() => setViewMode(mode.key)}
                >
                  <mode.icon className="w-4 h-4 mr-1" />
                  {mode.label}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              className="h-11 rounded-2xl text-blue-700"
              onClick={resetFilters}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>

            <ExportMenu
              onCSV={() =>
                exportToCSV(exportRows, "stock-adjustments", exportCols)
              }
              onPDF={() =>
                exportToPDF(
                  exportRows,
                  "stock-adjustments",
                  "Stock Adjustments Report",
                  exportCols,
                  {
                    subtitle: `${filteredAdjustments.length} stock adjustment records`,
                    summary: [
                      { label: "This Month", value: String(stats.thisMonth) },
                      {
                        label: "Stock Added",
                        value: String(stats.totalIncrease),
                      },
                      {
                        label: "Stock Reduced",
                        value: String(stats.totalDecrease),
                      },
                      { label: "Damage Cases", value: String(stats.damages) },
                      { label: "Pending Sync", value: String(stats.pending) },
                    ],
                  },
                )
              }
            />

            <Button
              onClick={openCreate}
              className="h-11 rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Adjustment
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border bg-card text-center py-12 text-muted-foreground">
            Loading adjustments...
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="rounded-3xl border border-blue-200 bg-blue-50/70 px-6 py-16 text-center text-blue-900 shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-sm">
              <ClipboardList className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">Stock control ledger is ready</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-blue-800/80">
              No stock adjustment matches the current filters. Create an
              adjustment to record opening stock, corrections, damage, wastage,
              or physical stock count differences.
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                onClick={openCreate}
                className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Adjustment
              </Button>
            </div>
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Product</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Qty</th>
                    <th className="px-4 py-3 text-left font-medium">Stock</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Risk</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pagedAdjustments.map((item) => {
                    const quantity = safeNumber(item.quantity_change);
                    const risk = movementRiskScore(item);

                    return (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                              <Package className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-[240px]">
                                {item.product_name || "-"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                                {item.notes || "No notes"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${typeBadgeClass(item.movement_type)}`}
                          >
                            {item.movement_type || "adjustment"}
                          </Badge>
                        </td>
                        <td
                          className={`px-4 py-3 font-data font-bold ${quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {quantity >= 0 ? "+" : ""}
                          {quantity}
                        </td>
                        <td className="px-4 py-3 font-data">
                          {item.stock_before ?? 0} → {item.stock_after ?? 0}
                        </td>
                        <td className="px-4 py-3 truncate max-w-[180px]">
                          {item.reference || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${riskBadgeClass(risk)}`}
                          >
                            {riskLabel(risk)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(
                            (item as any).created_at ||
                              (item as any).created_offline_at,
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-destructive hover:text-destructive"
                            onClick={() => deleteAdjustment.mutate(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {pagedAdjustments.map((item) => {
              const quantity = safeNumber(item.quantity_change);
              const risk = movementRiskScore(item);

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-lg transition-all p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base truncate">
                        {item.product_name || "-"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(
                          (item as any).created_at ||
                            (item as any).created_offline_at,
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        variant="outline"
                        className={`rounded-full ${typeBadgeClass(item.movement_type)}`}
                      >
                        {item.movement_type || "adjustment"}
                      </Badge>
                      {isPendingSync(item) && (
                        <Badge
                          variant="outline"
                          className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30"
                        >
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-2xl border bg-white/80 p-3">
                      <p className="text-[11px] text-muted-foreground">
                        Quantity
                      </p>
                      <p
                        className={`font-data font-bold text-lg mt-1 ${quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {quantity >= 0 ? "+" : ""}
                        {quantity}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-white/80 p-3">
                      <p className="text-[11px] text-muted-foreground">
                        Stock Change
                      </p>
                      <p className="font-data font-semibold text-sm mt-1">
                        {item.stock_before ?? 0} → {item.stock_after ?? 0}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-white/80 p-3">
                      <p className="text-[11px] text-muted-foreground">Risk</p>
                      <Badge
                        variant="outline"
                        className={`mt-1 rounded-full ${riskBadgeClass(risk)}`}
                      >
                        {riskLabel(risk)}
                      </Badge>
                    </div>

                    <div className="rounded-2xl border bg-white/80 p-3">
                      <p className="text-[11px] text-muted-foreground">
                        Value Impact
                      </p>
                      <p
                        className={`font-data font-semibold text-sm mt-1 ${quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {money(quantity * getMovementCost(item))}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white/70 p-3 mb-4">
                    <p className="text-[11px] text-muted-foreground">
                      Reference
                    </p>
                    <p className="text-sm font-medium truncate">
                      {item.reference || "-"}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-destructive hover:text-destructive"
                    onClick={() => deleteAdjustment.mutate(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-3xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages} · {filteredAdjustments.length}{" "}
              records
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                ‹
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(0, 8)
                .map((n) => (
                  <Button
                    key={n}
                    variant={n === currentPage ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9 rounded-xl text-xs"
                    style={n === currentPage ? { background: NAVY } : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ))}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                ›
              </Button>
            </div>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>New Stock Adjustment</DialogTitle>
              <DialogDescription>
                Select a product and enter a positive number to add stock or a
                negative number to reduce stock.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Product *
                </label>

                <div className="flex gap-2">
                  <Select
                    value={selectedProductId}
                    onValueChange={(value) => {
                      setSelectedProductId(value);
                      const product = products.find((p) => p.id === value);
                      setUnitCost(String(getProductCost(product)));
                      setSellingPrice(String(getProductSellingPrice(product)));
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.sku} · Stock: {getProductStock(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Adjustment Type
                </label>
                <Select value={movementType} onValueChange={setMovementType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adjustmentTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Quantity Change *
                </label>
                <Input
                  type="number"
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(e.target.value)}
                  placeholder="Example: 10 or -5"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Cost Price
                </label>
                <Input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={String(currentUnitCost || 0)}
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Selling Price
                </label>
                <Input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder={String(currentSellingPrice || 0)}
                  className="rounded-xl"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Reference
                </label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Direct Stock Adjustment"
                  className="rounded-xl"
                />
              </div>

              <div className="col-span-2 rounded-2xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Adjustment Preview</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Current Stock
                    </p>
                    <p className="font-data font-semibold">{stockBefore}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Change</p>
                    <p className="font-data font-semibold">
                      {change >= 0 ? "+" : ""}
                      {change}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">New Stock</p>
                    <p
                      className={`font-data font-semibold ${stockAfter < 0 ? "text-destructive" : ""}`}
                    >
                      {stockAfter}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="font-data font-semibold">
                      {money(adjustmentUnitCost)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Selling</p>
                    <p className="font-data font-semibold">
                      {money(adjustmentSellingPrice)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Notes
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for adjustment"
                  className="rounded-xl"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleSaveAdjustment();
                }}
                disabled={
                  manualSaving || !selectedProductId || !quantityChange.trim()
                }
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {manualSaving ? "Saving..." : "Save Adjustment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleScan}
        />
      </PageShell>
    </PageBackground>
  );
}
