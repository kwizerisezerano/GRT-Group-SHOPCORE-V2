import { useState, useRef, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import { usePurchases, usePurchaseMutations, useSuppliers, useProducts, type DbPurchase, type DbProduct } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedProducts, getCachedTable, isNetworkError, isOnline, saveCachedProducts, saveCachedTable, savePending } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ShoppingCart, Plus, Search, MoreHorizontal, Pencil, Trash2, FileText, CheckCircle2, Clock, XCircle, ScanBarcode, Package, Wallet, Truck, Layers3, ShieldCheck, CalendarDays, Building2, Receipt, Wifi, WifiOff, UploadCloud, Database, RotateCcw, Eye, AlertTriangle, Archive, Printer, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/utils/currency";
import warehouseBg from "@/assets/bg-warehouse.jpg";

const NAVY = "#0b3d5c";
const BTN_PRIMARY = "bg-blue-600 text-white hover:bg-blue-700 border-blue-600";
const BTN_SUCCESS = "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600";
const BTN_WARNING = "bg-orange-600 text-white hover:bg-orange-700 border-orange-600";
const BTN_INFO = "bg-cyan-600 text-white hover:bg-cyan-700 border-cyan-600";
const BTN_DANGER = "bg-rose-600 text-white hover:bg-rose-700 border-rose-600";
const BTN_PURPLE = "bg-violet-600 text-white hover:bg-violet-700 border-violet-600";

function safeNumber(value: any) { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function makeBatchNo(purchaseNo: string, sku: string, index: number) {
  return `${purchaseNo || "PO"}-${sku || "ITEM"}-${String(index + 1).padStart(2, "0")}`;
}

function getProductStock(product: any) { return Math.max(0, safeNumber(product?.stock ?? product?.stock_quantity)); }

function getProductMinStock(product: any) {
  return Math.max(0, safeNumber(product?.min_stock ?? product?.min_stock_level ?? (product as any)?.reorder_level));
}

function getProductCost(product: any) { return safeNumber(product?.cost_price ?? (product as any)?.purchase_price ?? (product as any)?.unit_cost); }

function getProductPrice(product: any) { return safeNumber((product as any)?.selling_price ?? (product as any)?.price ?? product?.sale_price); }

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

function dedupeByIdOrNo<T extends Record<string, any>>(rows: T[], noKey: string) {
  const map = new Map<string, T>();

  for (const row of rows || []) {
    const key = String(row.id || row.offline_id || row[noKey] || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      continue;
    }

    const existingTime = new Date(existing.updated_offline_at || existing.updated_at || existing.created_at || 0).getTime();
    const incomingTime = new Date(row.updated_offline_at || row.updated_at || row.created_at || 0).getTime();

    map.set(key, incomingTime >= existingTime ? { ...existing, ...row } : { ...row, ...existing });
  }

  return Array.from(map.values());
}

interface POItem {
  product_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  selling_price: number;
  total: number;
  received_qty?: number;
  batch_no?: string;
}

function ProductAutocomplete({
  value,
  products,
  onSelect,
  onChange,
}: {
  value: string;
  products: DbProduct[];
  onSelect: (p: DbProduct) => void;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = products
    .filter(
      (p) =>
        !isPendingDelete(p) &&
        ((p.name || "").toLowerCase().includes(query.toLowerCase()) ||
          (p.sku || "").toLowerCase().includes(query.toLowerCase()) ||
          (p.barcode || "").toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, 8);

  return (
    <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          ref={inputRef}
          placeholder="Search product..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.length > 0 && setOpen(true)}
          className="h-9 rounded-xl text-sm"
          autoComplete="off"
        />
      </PopoverTrigger>

      <PopoverContent
        className="p-1 w-[var(--radix-popover-trigger-width)]"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-muted transition-colors text-left"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(p);
              setQuery(p.name);
              setOpen(false);
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-muted border overflow-hidden flex items-center justify-center">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.sku || "No SKU"} · Stock {getProductStock(p)} · {formatCurrency(getProductCost(p))}
              </p>
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function escapePrintHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPrintBranding(purchase: any) {
  const safeLocalStorage = (key: string) => {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem(key) || "" : "";
    } catch {
      return "";
    }
  };

  return {
    businessName:
      purchase?.business_name ||
      purchase?.company_name ||
      purchase?.tenant_name ||
      safeLocalStorage("shopcore_business_name") ||
      safeLocalStorage("business_name") ||
      "ShopCore MSystem",
    logoUrl:
      purchase?.logo_url ||
      purchase?.business_logo ||
      purchase?.company_logo ||
      safeLocalStorage("shopcore_business_logo") ||
      safeLocalStorage("business_logo") ||
      "/shopcore-logo.png",
    tin:
      purchase?.business_tin ||
      purchase?.tin ||
      safeLocalStorage("shopcore_business_tin") ||
      safeLocalStorage("business_tin") ||
      "TIN: —",
    phone:
      purchase?.business_phone ||
      safeLocalStorage("shopcore_business_phone") ||
      safeLocalStorage("business_phone") ||
      "Phone: —",
    email:
      purchase?.business_email ||
      safeLocalStorage("shopcore_business_email") ||
      safeLocalStorage("business_email") ||
      "Email: —",
    address:
      purchase?.business_address ||
      safeLocalStorage("shopcore_business_address") ||
      safeLocalStorage("business_address") ||
      "Address: —",
  };
}

const statusConfig: Record<string, any> = {
  draft: {
    label: "Draft",
    icon: FileText,
    className: "bg-muted text-muted-foreground",
  },
  approved: { label: "Approved", icon: ShieldCheck, className: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30" },
  ordered: { label: "Ordered", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  partial: {
    label: "Partial",
    icon: Package,
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
  received: {
    label: "Received",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  },
  pending_sync: {
    label: "Pending Sync",
    icon: UploadCloud,
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
};

export default function Purchases() {
  const { user, tenantId, session } = useAuth();
  const qc = useQueryClient();

  const { data: purchases = [], isLoading } = usePurchases();
  const { create, update, remove } = usePurchaseMutations();
  const { data: suppliers = [] } = useSuppliers();
  const { data: products = [] } = useProducts();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DbPurchase | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewPurchase, setViewPurchase] = useState<DbPurchase | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    purchase_no: "",
    supplier_id: null as string | null,
    supplier_name: "No Supplier",
    status: "draft",
    date: new Date().toISOString().split("T")[0],
    expected_delivery: "",
    payment_method: "bank_transfer",
    branch: "Main Store",
    notes: null as string | null,
    shipping: 0,
    discount: 0,
    paid: 0,
  });

  const [items, setItems] = useState<POItem[]>([]);

  const offlineModeActive = !isOnline() || isOfflineMode();
  const canUseOnlineSupabase = isOnline() && !!session?.access_token && !isOfflineMode();

  const cleanPurchases = useMemo(
    () => dedupeByIdOrNo(purchases as any[], "purchase_no").filter((p) => !isPendingDelete(p)),
    [purchases]
  ) as DbPurchase[];

  const cleanProducts = useMemo(
    () => dedupeByIdOrNo(products as any[], "sku").filter((p) => !isPendingDelete(p)),
    [products]
  ) as DbProduct[];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return cleanPurchases
      .filter((p: any) => {
        const matchSearch =
          !q ||
          (p.purchase_no || "").toLowerCase().includes(q) ||
          (p.supplier_name || "No Supplier").toLowerCase().includes(q) ||
          (p.branch || "").toLowerCase().includes(q) ||
          (p.payment_method || "").toLowerCase().includes(q);

        const matchStatus = statusFilter === "all" || p.status === statusFilter;
        const pending = isPendingSync(p);
        const matchSync =
          syncFilter === "all" ||
          (syncFilter === "pending" && pending) ||
          (syncFilter === "synced" && !pending);

        return matchSearch && matchStatus && matchSync;
      })
      .sort((a: any, b: any) => {
        const at = new Date(a.date || a.created_offline_at || a.created_at || 0).getTime();
        const bt = new Date(b.date || b.created_offline_at || b.created_at || 0).getTime();
        return bt - at;
      });
  }, [cleanPurchases, search, statusFilter, syncFilter]);

  const stats = useMemo(() => {
    const draftCount = cleanPurchases.filter((p) => p.status === "draft").length;
    const pendingCount = cleanPurchases.filter((p) => p.status === "ordered").length;
    const approvedCount = cleanPurchases.filter((p) => p.status === "approved").length;
    const receivedCount = cleanPurchases.filter((p) => p.status === "received").length;
    const totalDue = cleanPurchases.reduce((a, p) => a + safeNumber(p.due), 0);
    const totalValue = cleanPurchases.reduce((a, p) => a + safeNumber(p.total), 0);
    const cancelledCount = cleanPurchases.filter((p) => p.status === "cancelled").length;
    const pendingSync = cleanPurchases.filter(isPendingSync).length;

    return {
      draftCount,
      pendingCount,
      approvedCount,
      receivedCount,
      totalDue,
      totalValue,
      cancelledCount,
      suppliersCount: suppliers.length,
      pendingSync,
    };
  }, [cleanPurchases, suppliers]);

  const topSummaryCards = [
    {
      label: "Draft POs",
      value: stats.draftCount,
      helper: "Not yet ordered",
      icon: FileText,
      wrapper: "bg-blue-600 text-white border-blue-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Pending POs",
      value: stats.pendingCount,
      helper: "Awaiting receiving",
      icon: Clock,
      wrapper: "bg-orange-600 text-white border-orange-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Received",
      value: stats.receivedCount,
      helper: "Stock completed",
      icon: CheckCircle2,
      wrapper: "bg-emerald-600 text-white border-emerald-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Due Payments",
      value: formatCurrency(stats.totalDue),
      helper: "Outstanding balance",
      icon: Wallet,
      wrapper: "bg-rose-600 text-white border-rose-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
  ];

  const nextPONumber = () =>
    `PO-${String((cleanPurchases.length ?? 0) + 1).padStart(5, "0")}`;

  const refreshPurchaseRelatedQueries = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["purchases"] }),
      qc.invalidateQueries({ queryKey: ["purchase_items"] }),
      qc.invalidateQueries({ queryKey: ["products"] }),
      qc.invalidateQueries({ queryKey: ["stock_batches"] }),
      qc.invalidateQueries({ queryKey: ["stock_movements"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      purchase_no: nextPONumber(),
      supplier_id: null,
      supplier_name: "No Supplier",
      status: "draft",
      date: new Date().toISOString().split("T")[0],
      expected_delivery: "",
      payment_method: "bank_transfer",
      branch: "Main Store",
      notes: "",
      shipping: 0,
      discount: 0,
      paid: 0,
    });
    setItems([]);
    setDialogOpen(true);
  };

  const normalizeItemsFromPurchase = (p: any): POItem[] => {
    const raw = Array.isArray(p?.line_items)
      ? p.line_items
      : Array.isArray(p?.purchase_items)
        ? p.purchase_items
        : Array.isArray(p?.items_data)
          ? p.items_data
          : Array.isArray(p?.items)
            ? p.items
            : Array.isArray(p?.products)
              ? p.products
              : Array.isArray((p as any)?.purchase_items_data)
                ? (p as any).purchase_items_data
                : [];

    return raw.map((item: any, index: number) => ({
      product_id: item.product_id || null,
      product_name: item.product_name || item.name || "",
      sku: item.sku || "",
      quantity: safeNumber(item.quantity || item.qty),
      unit_cost: safeNumber(item.unit_cost || item.cost_price),
      selling_price: safeNumber(item.selling_price || item.price),
      total: safeNumber(item.total || safeNumber(item.quantity || item.qty) * safeNumber(item.unit_cost || item.cost_price)),
      received_qty: safeNumber(item.received_qty),
      batch_no: item.batch_no || makeBatchNo(p?.purchase_no, item.sku || "", index),
    }));
  };

  const openEdit = async (p: DbPurchase) => {
    setEditing(p);
    setForm({
      purchase_no: p.purchase_no,
      supplier_id: p.supplier_id || null,
      supplier_name: p.supplier_name || "No Supplier",
      status: p.status,
      date: p.date || new Date().toISOString().split("T")[0],
      expected_delivery: p.expected_delivery ?? "",
      payment_method: p.payment_method || "bank_transfer",
      branch: p.branch || "Main Store",
      notes: p.notes,
      shipping: safeNumber(p.shipping),
      discount: safeNumber(p.discount),
      paid: safeNumber((p as any).paid),
    });

    const localItems = normalizeItemsFromPurchase(p);
    if (localItems.length > 0 || !canUseOnlineSupabase || String(p.id || "").startsWith("offline-")) {
      setItems(localItems);
      setDialogOpen(true);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from("purchase_items")
        .select("product_id, product_name, sku, quantity, unit_cost, total, received_qty")
        .eq("purchase_id", p.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;

      setItems(
        (data || []).map((item: any, index: number) => ({
          product_id: item.product_id || null,
          product_name: item.product_name || "",
          sku: item.sku || "",
          quantity: safeNumber(item.quantity),
          unit_cost: safeNumber(item.unit_cost),
          selling_price: getProductPrice(cleanProducts.find((product) => product.id === item.product_id)),
          total: safeNumber(item.total),
          received_qty: safeNumber(item.received_qty),
          batch_no: makeBatchNo(p.purchase_no, item.sku || "", index),
        }))
      );
    } catch (error: any) {
      toast.warning(error?.message || "Could not load purchase items; using local data.");
      setItems(localItems);
    }

    setDialogOpen(true);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        product_id: null,
        product_name: "",
        sku: "",
        quantity: 1,
        unit_cost: 0,
        selling_price: 0,
        total: 0,
      },
    ]);
  };

  const updateItem = (
    index: number,
    field: keyof POItem,
    value: string | number
  ) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;

    if (field === "quantity" || field === "unit_cost") {
      updated[index].total =
        safeNumber(updated[index].quantity) * safeNumber(updated[index].unit_cost);
    }

    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleScan = (code: string) => {
    const product = cleanProducts.find((p) => p.barcode === code || p.sku === code);

    if (product) {
      setItems([
        ...items,
        {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          quantity: 1,
          unit_cost: getProductCost(product),
          selling_price: getProductPrice(product),
          total: getProductCost(product),
        },
      ]);
      toast.success(`Added: ${product.name}`);
    } else {
      toast.error(`No product found for code: ${code}`);
    }
  };

  const subtotal = items.reduce((a, i) => a + safeNumber(i.total), 0);
  const tax = subtotal * 0.16;
  const total = Math.max(0, subtotal + tax + safeNumber(form.shipping) - safeNumber(form.discount));
  const due = Math.max(0, total - safeNumber(form.paid));

  const buildPurchaseLineItems = () =>
    items.map((item, index) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku || "",
      quantity: safeNumber(item.quantity),
      unit_cost: safeNumber(item.unit_cost),
      selling_price: safeNumber(item.selling_price),
      total: safeNumber(item.total),
      received_qty: form.status === "received" ? safeNumber(item.quantity) : safeNumber(item.received_qty),
      batch_no: item.batch_no || makeBatchNo(form.purchase_no, item.sku || "", index),
    }));

  const buildPurchasePayload = () => {
    const purchaseLineItems = buildPurchaseLineItems();

    return {
      purchase_no: form.purchase_no,
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name || "No Supplier",
      status: form.status,
      date: form.date,
      expected_delivery: form.expected_delivery || null,
      subtotal,
      tax,
      discount: safeNumber(form.discount),
      shipping: safeNumber(form.shipping),
      total,
      paid: safeNumber(form.paid),
      due,
      payment_method: form.payment_method,
      branch: form.branch,
      notes: form.notes,
      items_count: items.length,
      line_items: purchaseLineItems,
    };
  };

  const saveLineItems = async (purchaseId: string) => {
    if (!tenantId || !user?.id || items.length === 0) return;

    await (supabase as any)
      .from("purchase_items")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("purchase_id", purchaseId);

    const lineRows = items.map((item) => ({
      purchase_id: purchaseId,
      purchase_no: form.purchase_no,
      user_id: user.id,
      tenant_id: tenantId,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku || "",
      quantity: safeNumber(item.quantity),
      unit_cost: safeNumber(item.unit_cost),
      total: safeNumber(item.total),
      received_qty: form.status === "received" ? safeNumber(item.quantity) : safeNumber(item.received_qty),
    }));

    const { error } = await (supabase as any).from("purchase_items").insert(lineRows);

    if (error) throw error;

    const cachedPurchaseItems = (await getCachedTable("purchase_items")) as any[];
    await saveCachedTable("purchase_items", [
      ...lineRows,
      ...(Array.isArray(cachedPurchaseItems)
        ? cachedPurchaseItems.filter((row: any) => String(row.purchase_id || "") !== String(purchaseId))
        : []),
    ]);
  };

  const applyPurchaseToLocalStock = async (
    purchaseId: string,
    purchaseNo: string,
    purchaseItems: POItem[],
    options: { queueSync: boolean; markProductsPending: boolean }
  ) => {
    if (!tenantId || !user?.id) throw new Error("No active workspace");

    const cachedProducts = await getCachedProducts();
    const cachedMovements = await getCachedTable("stock_movements");
    const cachedBatches = await getCachedTable("stock_batches");
    const now = new Date().toISOString();

    const movementRows: any[] = [];
    const batchRows: any[] = [];
    const lineMap = new Map<string, POItem[]>();

    for (const item of purchaseItems) {
      if (!item.product_id || safeNumber(item.quantity) <= 0) continue;
      const list = lineMap.get(String(item.product_id)) || [];
      list.push(item);
      lineMap.set(String(item.product_id), list);
    }

    const updatedProducts = cachedProducts.map((product: any) => {
      const matchedItems = lineMap.get(String(product.id)) || [];
      const qty = matchedItems.reduce((sum, item) => sum + safeNumber(item.quantity), 0);
      if (qty <= 0) return product;

      const currentStock = getProductStock(product);
      const newStock = currentStock + qty;
      const minStock = getProductMinStock(product);

      for (const purchaseItem of matchedItems) {
        const itemQty = safeNumber(purchaseItem.quantity);
        const batchNo = purchaseItem.batch_no || makeBatchNo(purchaseNo, purchaseItem.sku, batchRows.length);

        const batch = {
          id: makeLocalId("offline-stock-batch"),
          tenant_id: tenantId,
          product_id: product.id,
          batch_no: batchNo,
          source_type: "purchase",
          source_id: purchaseId,
          quantity_in: itemQty,
          quantity_remaining: itemQty,
          cost_price: safeNumber(purchaseItem.unit_cost),
          selling_price: safeNumber(purchaseItem.selling_price || (product as any).selling_price),
          status: "active",
          created_at: now,
          operation: "create",
          sync_status: "pending",
        };

        batchRows.push(batch);

        const stockBefore = currentStock + matchedItems
          .slice(0, matchedItems.indexOf(purchaseItem))
          .reduce((sum, previous) => sum + safeNumber(previous.quantity), 0);

        movementRows.push({
          id: makeLocalId("offline-stock-movement"),
          tenant_id: tenantId,
          user_id: user.id,
          product_id: product.id,
          product_name: purchaseItem.product_name || product.name,
          movement_type: "purchase_received",
          quantity_change: itemQty,
          stock_before: stockBefore,
          stock_after: stockBefore + itemQty,
          reference: purchaseNo || "Purchase Received",
          reference_id: purchaseId,
          notes: `Received from ${form.supplier_name || "No Supplier"} | Batch: ${batchNo}`,
          created_at: now,
          operation: "create",
          sync_status: "pending",
        });
      }

      return {
        ...product,
        stock: newStock,
        stock_quantity: newStock,
        cost_price: matchedItems[matchedItems.length - 1]?.unit_cost || product.cost_price,
        selling_price: matchedItems[matchedItems.length - 1]?.selling_price || (product as any).selling_price,
        price: matchedItems[matchedItems.length - 1]?.selling_price || (product as any).price,
        status: newStock <= 0 ? "out_of_stock" : newStock <= minStock ? "low_stock" : "active",
        updated_at: now,
        updated_offline_at: now,
        ...(options.markProductsPending ? { sync_status: "pending_update" } : {}),
      };
    });

    await saveCachedProducts(updatedProducts);
    await saveCachedTable("stock_batches", [
      ...batchRows,
      ...(Array.isArray(cachedBatches) ? cachedBatches : []),
    ]);
    await saveCachedTable("stock_movements", [
      ...movementRows,
      ...(Array.isArray(cachedMovements) ? cachedMovements : []),
    ]);

    if (options.queueSync) {
      for (const batch of batchRows) {
        await savePending("stock_batches", batch);
      }

      for (const movement of movementRows) {
        await savePending("stock_movements", movement);
      }

      for (const product of updatedProducts) {
        if (product.updated_offline_at === now) {
          await savePending("products", {
            id: product.id,
            operation: "update",
            stock: product.stock,
            stock_quantity: product.stock_quantity,
            cost_price: product.cost_price,
            selling_price: (product as any).selling_price,
            price: (product as any).price,
            status: product.status,
            sync_status: "pending_update",
            updated_offline_at: now,
          });
        }
      }
    }

    qc.setQueriesData({ queryKey: ["products"] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((product: any) => {
        const replacement = updatedProducts.find((p: any) => String(p.id) === String(product.id));
        return replacement ? { ...product, ...replacement } : product;
      });
    });
  };

  const savePurchaseOffline = async (payload: any, options: { forceId?: string; receiveNow?: boolean } = {}) => {
    if (!tenantId || !user?.id) throw new Error("No active workspace");

    const now = new Date().toISOString();
    const isExisting = Boolean(editing || options.forceId);
    const id = options.forceId || editing?.id || makeLocalId("offline-purchase");
    const operation = String(id).startsWith("offline-") ? "create" : isExisting ? "update" : "create";

    const offlinePurchase: any = {
      ...(editing || {}),
      ...payload,
      id,
      tenant_id: tenantId,
      user_id: user.id,
      operation,
      sync_status: operation === "create" ? "pending" : "pending_update",
      created_at: (editing as any)?.created_at || now,
      updated_at: now,
      created_offline_at: (editing as any)?.created_offline_at || (operation === "create" ? now : undefined),
      updated_offline_at: now,
    };

    if (options.receiveNow || payload.status === "received") {
      offlinePurchase.status = "received";
      offlinePurchase.line_items = (payload.line_items || []).map((item: any) => ({
        ...item,
        received_qty: safeNumber(item.quantity),
      }));
      await applyPurchaseToLocalStock(id, payload.purchase_no, offlinePurchase.line_items, {
        queueSync: true,
        markProductsPending: true,
      });
    }

    const cachedPurchases = await getCachedTable("purchases");
    const nextPurchases = dedupeByIdOrNo(
      [
        offlinePurchase,
        ...(Array.isArray(cachedPurchases) ? cachedPurchases : []),
      ],
      "purchase_no"
    );

    await saveCachedTable("purchases", nextPurchases);
    await savePending("purchases", offlinePurchase);

    qc.setQueriesData({ queryKey: ["purchases"] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return dedupeByIdOrNo([offlinePurchase, ...old], "purchase_no");
    });

    await refreshPurchaseRelatedQueries();
    return offlinePurchase;
  };

  const receivePurchaseDirectly = async (purchase: DbPurchase | string, localItems: POItem[] = items) => {
    if (!tenantId || !user?.id) throw new Error("No active workspace");

    const purchaseId = typeof purchase === "string" ? purchase : purchase.id;
    const purchaseNo = typeof purchase === "string" ? form.purchase_no : purchase.purchase_no || form.purchase_no;
    const purchaseData = typeof purchase === "string" ? editing : purchase;

    const fallbackItems = localItems.length > 0 ? localItems : normalizeItemsFromPurchase(purchaseData);

    if (!canUseOnlineSupabase || String(purchaseId).startsWith("offline-")) {
      const payload = {
        ...(purchaseData || {}),
        ...buildPurchasePayload(),
        id: purchaseId,
        purchase_no: purchaseNo,
        status: "received",
        line_items: fallbackItems.map((item, index) => ({
          ...item,
          received_qty: safeNumber(item.quantity),
          batch_no: item.batch_no || makeBatchNo(purchaseNo, item.sku, index),
        })),
      };

      await savePurchaseOffline(payload, { forceId: purchaseId, receiveNow: true });
      toast.success("Purchase received offline. Stock updated locally and will sync later.");
      return;
    }

    let purchaseItems = fallbackItems;

    if (purchaseItems.length === 0) {
      const { data, error: itemError } = await (supabase as any)
        .from("purchase_items")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("purchase_id", purchaseId);

      if (itemError) throw itemError;

      purchaseItems = (data || []).map((item: any, index: number) => ({
        product_id: item.product_id || null,
        product_name: item.product_name || "",
        sku: item.sku || "",
        quantity: safeNumber(item.quantity),
        unit_cost: safeNumber(item.unit_cost),
        selling_price: getProductPrice(cleanProducts.find((product) => product.id === item.product_id)),
        total: safeNumber(item.total),
        received_qty: safeNumber(item.received_qty),
        batch_no: makeBatchNo(purchaseNo, item.sku || "", index),
      }));
    }

    for (const item of purchaseItems) {
      if (!item.product_id) continue;

      const product = cleanProducts.find((p) => p.id === item.product_id);
      const currentStock = getProductStock(product);
      const qty = safeNumber(item.quantity);
      const newStock = currentStock + qty;
      const minStock = getProductMinStock(product);
      const itemCost = safeNumber(item.unit_cost || product?.cost_price);
      const itemSellingPrice = safeNumber(item.selling_price || (product as any)?.selling_price);
      const now = new Date().toISOString();

      const { error: productError } = await (supabase as any)
        .from("products")
        .update({
          stock: newStock,
          stock_quantity: newStock,
          cost_price: itemCost || product?.cost_price,
          selling_price: itemSellingPrice || (product as any)?.selling_price,
          price: itemSellingPrice || (product as any)?.price,
          status:
            newStock <= 0
              ? "out_of_stock"
              : minStock > 0 && newStock <= minStock
                ? "low_stock"
                : "active",
          updated_at: now,
        })
        .eq("id", item.product_id)
        .eq("tenant_id", tenantId);

      if (productError) throw productError;

      const { data: batch, error: batchError } = await (supabase as any)
        .from("stock_batches")
        .insert({
          tenant_id: tenantId,
          product_id: item.product_id,
          batch_no: item.batch_no || makeBatchNo(purchaseNo, item.sku || product?.sku || "", purchaseItems.indexOf(item)),
          source_type: "purchase",
          source_id: purchaseId,
          quantity_in: qty,
          quantity_remaining: qty,
          cost_price: itemCost,
          selling_price: itemSellingPrice,
          status: "active",
          created_at: now,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const { error: movementError } = await (supabase as any).from("stock_movements").insert({
        tenant_id: tenantId,
        user_id: user.id,
        product_id: item.product_id,
        product_name: item.product_name || product?.name || "Unknown Product",
        movement_type: "purchase_received",
        quantity_change: qty,
        stock_before: currentStock,
        stock_after: newStock,
        reference: purchaseNo || "Purchase Received",
        reference_id: purchaseId,
        notes: `Received from ${form.supplier_name || (purchaseData as any)?.supplier_name || "No Supplier"} | Batch: ${batch?.batch_no || "N/A"}`,
      });

      if (movementError) throw movementError;
    }

    for (const item of purchaseItems) {
      if (!item.product_id) continue;
      await (supabase as any)
        .from("purchase_items")
        .update({ received_qty: safeNumber(item.quantity) })
        .eq("tenant_id", tenantId)
        .eq("purchase_id", purchaseId)
        .eq("product_id", item.product_id);
    }

    await update.mutateAsync({
      id: purchaseId,
      status: "received",
      due,
      paid: safeNumber(form.paid),
    } as any);

    await applyPurchaseToLocalStock(purchaseId, purchaseNo, purchaseItems, {
      queueSync: false,
      markProductsPending: false,
    });

    await refreshPurchaseRelatedQueries();
  };

  const handleSave = async () => {
    if (!form.purchase_no.trim()) {
      toast.error("Purchase number is required");
      return;
    }

    if (items.some((item) => !item.product_name || safeNumber(item.quantity) <= 0)) {
      toast.error("Each line item needs a product name and a quantity above 0.");
      return;
    }

    const payload = buildPurchasePayload();

    try {
      setProcessingId(editing?.id || "new");

      if (!canUseOnlineSupabase) {
        await savePurchaseOffline(payload, { receiveNow: form.status === "received" });
        toast.success(
          form.status === "received"
            ? "Purchase saved offline and stock updated locally."
            : "Purchase saved offline. It will sync when internet returns."
        );
        setDialogOpen(false);
        return;
      }

      if (editing) {
        if (String(editing.id).startsWith("offline-") || (editing as any).offline_id) {
          await savePurchaseOffline(payload, { forceId: editing.id, receiveNow: form.status === "received" });
          toast.success("Offline purchase updated locally.");
          setDialogOpen(false);
          return;
        }

        await update.mutateAsync({
          id: editing.id,
          ...payload,
          line_items: undefined,
        } as any);

        await saveLineItems(editing.id);

        if (form.status === "received" && editing.status !== "received") {
          await receivePurchaseDirectly(editing, items);
        }

        const cachedPurchases = await getCachedTable("purchases");
        await saveCachedTable(
          "purchases",
          dedupeByIdOrNo(
            [
              { ...editing, ...payload, updated_at: new Date().toISOString() },
              ...(Array.isArray(cachedPurchases) ? cachedPurchases : []),
            ],
            "purchase_no"
          )
        );

        toast.success("Purchase updated successfully.");
      } else {
        const result = await create.mutateAsync({
          ...payload,
          line_items: undefined,
        } as any);

        if (result?.id) {
          await saveLineItems(result.id);

          if (form.status === "received") {
            await receivePurchaseDirectly(result as DbPurchase, items);
          }

          const cachedPurchases = await getCachedTable("purchases");
          await saveCachedTable(
            "purchases",
            dedupeByIdOrNo(
              [
                {
                  ...(result as any),
                  ...payload,
                  id: result.id,
                  line_items: buildPurchaseLineItems(),
                },
                ...(Array.isArray(cachedPurchases) ? cachedPurchases : []),
              ],
              "purchase_no"
            )
          );
        }

        toast.success(
          form.status === "received"
            ? "Purchase created, received, and stock updated."
            : "Purchase created successfully."
        );
      }

      setDialogOpen(false);
      await refreshPurchaseRelatedQueries();
    } catch (error: any) {
      console.error("Purchase save failed:", error);

      if (isNetworkError(error) || !isOnline()) {
        try {
          await savePurchaseOffline(payload, { receiveNow: form.status === "received" });
          toast.success("Network failed. Purchase saved offline and will sync later.");
          setDialogOpen(false);
          return;
        } catch (offlineError: any) {
          toast.error(offlineError?.message || "Failed to save purchase offline");
          return;
        }
      }

      toast.error(error?.message || "Failed to save purchase");
    } finally {
      setProcessingId(null);
    }
  };

  const handleStatusChange = async (purchase: DbPurchase, newStatus: string) => {
    try {
      setProcessingId(purchase.id);

      if (newStatus === "received") {
        await receivePurchaseDirectly(purchase);
        toast.success("Purchase received — stock updated.");
      } else if (!canUseOnlineSupabase || String(purchase.id).startsWith("offline-")) {
        const payload = {
          ...purchase,
          status: newStatus,
          line_items: normalizeItemsFromPurchase(purchase),
        };

        await savePurchaseOffline(payload, { forceId: purchase.id });
        toast.success(`Purchase marked as ${newStatus} offline.`);
      } else {
        await update.mutateAsync({ id: purchase.id, status: newStatus } as any);

        const cachedPurchases = await getCachedTable("purchases");
        await saveCachedTable(
          "purchases",
          (Array.isArray(cachedPurchases) ? cachedPurchases : []).map((row: any) =>
            String(row.id) === String(purchase.id) ? { ...row, status: newStatus } : row
          )
        );
      }

      await refreshPurchaseRelatedQueries();
    } catch (error: any) {
      console.error("Purchase status failed:", error);

      if (isNetworkError(error)) {
        const payload = {
          ...purchase,
          status: newStatus,
          line_items: normalizeItemsFromPurchase(purchase),
        };
        await savePurchaseOffline(payload, { forceId: purchase.id, receiveNow: newStatus === "received" });
        toast.success(`Network failed. Purchase marked ${newStatus} offline.`);
        return;
      }

      toast.error(error?.message || "Failed to update purchase");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const purchase = cleanPurchases.find((p) => p.id === deleteId) as any;
    setDeleteId(null);

    try {
      if (!purchase) return;

      if (!canUseOnlineSupabase || String(deleteId).startsWith("offline-")) {
        const cachedPurchases = await getCachedTable("purchases");

        if (String(deleteId).startsWith("offline-")) {
          await saveCachedTable(
            "purchases",
            (Array.isArray(cachedPurchases) ? cachedPurchases : []).filter((row: any) => String(row.id) !== String(deleteId))
          );
          toast.success("Offline purchase removed locally.");
        } else {
          await savePending("purchases", {
            ...purchase,
            operation: "delete",
            sync_status: "pending_delete",
            status: "deleted",
            updated_offline_at: new Date().toISOString(),
          });

          await saveCachedTable(
            "purchases",
            (Array.isArray(cachedPurchases) ? cachedPurchases : []).map((row: any) =>
              String(row.id) === String(deleteId)
                ? { ...row, operation: "delete", sync_status: "pending_delete", status: "deleted" }
                : row
            )
          );

          toast.success("Purchase deletion saved offline. It will sync when internet returns.");
        }

        await refreshPurchaseRelatedQueries();
        return;
      }

      await remove.mutateAsync(deleteId);
      const cachedPurchases = await getCachedTable("purchases");
      await saveCachedTable(
        "purchases",
        (Array.isArray(cachedPurchases) ? cachedPurchases : []).filter((row: any) => String(row.id) !== String(deleteId))
      );

      await refreshPurchaseRelatedQueries();
      toast.success("Purchase deleted successfully.");
    } catch (error: any) {
      if (isNetworkError(error) && purchase) {
        await savePending("purchases", {
          ...purchase,
          operation: "delete",
          sync_status: "pending_delete",
          status: "deleted",
          updated_offline_at: new Date().toISOString(),
        });
        toast.success("Network failed. Purchase deletion saved offline.");
        await refreshPurchaseRelatedQueries();
        return;
      }

      toast.error(error?.message || "Failed to delete purchase");
    }
  };

  const getPurchaseItemsForDocument = async (purchase: any): Promise<POItem[]> => {
    if (!purchase) return [];

    const localItems = normalizeItemsFromPurchase(purchase);
    if (localItems.length > 0) return localItems;

    const mapRows = (rows: any[]) =>
      (rows || []).map((item: any, index: number) => ({
        product_id: item.product_id || null,
        product_name: item.product_name || item.name || item.products?.name || "",
        sku: item.sku || item.products?.sku || "",
        quantity: safeNumber(item.quantity || item.qty),
        unit_cost: safeNumber(item.unit_cost || item.cost_price || item.purchase_price),
        selling_price: safeNumber(item.selling_price || item.price),
        total: safeNumber(
          item.total ||
            item.line_total ||
            safeNumber(item.quantity || item.qty) * safeNumber(item.unit_cost || item.cost_price || item.purchase_price)
        ),
        received_qty: safeNumber(item.received_qty),
        batch_no: item.batch_no || makeBatchNo(purchase?.purchase_no, item.sku || item.products?.sku || "", index),
      }));

    try {
      const cachedPurchaseItems = (await getCachedTable("purchase_items")) as any[];
      const cachedItems = Array.isArray(cachedPurchaseItems)
        ? cachedPurchaseItems.filter((item: any) =>
            String(item.purchase_id || "") === String(purchase.id || "") ||
            String(item.purchase_no || "") === String(purchase.purchase_no || "")
          )
        : [];

      if (cachedItems.length > 0) return mapRows(cachedItems);
    } catch {
      // Cache lookup is optional.
    }

    if (!canUseOnlineSupabase || !purchase?.id || String(purchase.id).startsWith("offline-")) {
      return [];
    }

    try {
      const { data, error } = await (supabase as any)
        .from("purchase_items")
        .select("product_id, product_name, sku, quantity, unit_cost, total, received_qty")
        .eq("purchase_id", purchase.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;

      const onlineItems = mapRows(data || []);

      if (onlineItems.length > 0) {
        const cachedPurchaseItems = (await getCachedTable("purchase_items")) as any[];
        await saveCachedTable("purchase_items", [
          ...onlineItems.map((item) => ({ ...item, purchase_id: purchase.id, purchase_no: purchase.purchase_no })),
          ...(Array.isArray(cachedPurchaseItems) ? cachedPurchaseItems : []),
        ]);
      }

      return onlineItems;
    } catch (error: any) {
      toast.warning(error?.message || "Could not load purchase line items for this PO.");
      return [];
    }
  };

  const hydratePurchaseForDocument = async (purchase: any) => {
    const documentItems = await getPurchaseItemsForDocument(purchase);
    return {
      ...purchase,
      line_items: documentItems,
      items_count: documentItems.length || safeNumber(purchase?.items_count),
    };
  };

  const openViewPurchase = async (purchase: any) => {
    setProcessingId(purchase?.id || "view");
    try {
      setViewPurchase(await hydratePurchaseForDocument(purchase));
    } finally {
      setProcessingId(null);
    }
  };

  const printPurchaseOrder = async (purchase: any) => {
    if (!purchase) return;

    const purchaseWithItems = await hydratePurchaseForDocument(purchase);
    const purchaseItems = normalizeItemsFromPurchase(purchaseWithItems);
    purchase = purchaseWithItems;
    const supplier = suppliers.find((s: any) => String(s.id) === String(purchase.supplier_id));
    const branding = getPrintBranding(purchase);
    const poSubtotal = safeNumber(purchase.subtotal);
    const poTax = safeNumber(purchase.tax);
    const poShipping = safeNumber(purchase.shipping);
    const poDiscount = safeNumber(purchase.discount);
    const poPaid = safeNumber((purchase as any).paid);
    const poTotal = safeNumber(purchase.total);
    const poDue = safeNumber(purchase.due);
    const status = String(purchase.status || "draft").toUpperCase().replace(/_/g, " ");
    const printDate = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const rows = purchaseItems
      .map((item, index) => {
        const qty = safeNumber(item.quantity);
        const unitCost = safeNumber(item.unit_cost);
        const lineTotal = safeNumber(item.total || qty * unitCost);
        const receivedQty = safeNumber(item.received_qty);

        return `
          <tr>
            <td class="center">${index + 1}</td>
            <td>
              <div class="item-name">${escapePrintHtml(item.product_name || "Unknown Product")}</div>
              <div class="muted small">SKU: ${escapePrintHtml(item.sku || "—")}</div>
              ${item.batch_no ? `<div class="muted small">Batch: ${escapePrintHtml(item.batch_no)}</div>` : ""}
            </td>
            <td class="right">${qty.toLocaleString()}</td>
            <td class="right">${receivedQty ? receivedQty.toLocaleString() : "—"}</td>
            <td class="right">${escapePrintHtml(formatCurrency(unitCost))}</td>
            <td class="right strong">${escapePrintHtml(formatCurrency(lineTotal))}</td>
          </tr>
        `;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=1100,height=900");

    if (!printWindow) {
      toast.error("Popup blocked. Allow popups to print the purchase order.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order ${escapePrintHtml(purchase.purchase_no || "")}</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #f3f4f6;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              line-height: 1.45;
            }
            .page {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              background: #ffffff;
              padding: 16mm;
              position: relative;
            }
            .top-border {
              height: 8px;
              background: linear-gradient(90deg, #0b3d5c, #16719a, #0b3d5c);
              margin: -16mm -16mm 14mm -16mm;
            }
            .header {
              display: grid;
              grid-template-columns: 1.2fr 0.8fr;
              gap: 24px;
              align-items: start;
              border-bottom: 2px solid #0b3d5c;
              padding-bottom: 18px;
            }
            .brand {
              display: flex;
              gap: 14px;
              align-items: flex-start;
            }
            .logo-box {
              width: 74px;
              height: 74px;
              border: 1px solid #d1d5db;
              border-radius: 16px;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f9fafb;
              flex-shrink: 0;
            }
            .logo-box img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              padding: 6px;
            }
            .brand h1 {
              margin: 0 0 6px;
              font-size: 22px;
              color: #0b3d5c;
              letter-spacing: -0.02em;
            }
            .brand-lines div { color: #4b5563; margin-top: 2px; }
            .po-title { text-align: right; }
            .po-title h2 {
              margin: 0;
              color: #0b3d5c;
              font-size: 31px;
              letter-spacing: 0.04em;
            }
            .po-number {
              margin-top: 8px;
              display: inline-block;
              border: 2px solid #0b3d5c;
              border-radius: 999px;
              padding: 7px 14px;
              color: #0b3d5c;
              font-weight: 800;
              font-size: 14px;
            }
            .status-pill {
              margin-top: 9px;
              display: inline-block;
              border-radius: 999px;
              padding: 6px 12px;
              background: #ecfeff;
              color: #0e7490;
              border: 1px solid #67e8f9;
              font-weight: 700;
              font-size: 11px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-top: 18px;
            }
            .card {
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 12px;
              background: #fbfdff;
              min-height: 74px;
            }
            .card h3 {
              margin: 0 0 8px;
              color: #0b3d5c;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.06em;
            }
            .label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
            .value { font-weight: 700; margin-top: 2px; color: #111827; }
            .section-title {
              margin: 24px 0 10px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }
            .section-title h3 {
              margin: 0;
              font-size: 14px;
              color: #0b3d5c;
              letter-spacing: 0.02em;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #e5e7eb;
              overflow: hidden;
              border-radius: 14px;
            }
            thead th {
              background: #0b3d5c;
              color: #ffffff;
              padding: 10px 9px;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              text-align: left;
            }
            tbody td {
              border-top: 1px solid #e5e7eb;
              padding: 10px 9px;
              vertical-align: top;
            }
            tbody tr:nth-child(even) td { background: #f8fafc; }
            .right { text-align: right; }
            .center { text-align: center; }
            .strong { font-weight: 800; }
            .item-name { font-weight: 800; color: #111827; }
            .muted { color: #6b7280; }
            .small { font-size: 10px; }
            .summary-row {
              display: grid;
              grid-template-columns: 1fr 86mm;
              gap: 18px;
              margin-top: 18px;
              align-items: start;
            }
            .notes {
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 12px;
              min-height: 112px;
              background: #fbfdff;
            }
            .notes h3,
            .totals h3 {
              margin: 0 0 8px;
              color: #0b3d5c;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .totals {
              border: 1px solid #d1d5db;
              border-radius: 14px;
              padding: 12px;
              background: #ffffff;
            }
            .total-line {
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              border-bottom: 1px dashed #e5e7eb;
            }
            .total-line:last-child { border-bottom: none; }
            .grand-total {
              margin-top: 8px;
              padding: 10px 0 0;
              border-top: 2px solid #0b3d5c;
              color: #0b3d5c;
              font-size: 16px;
              font-weight: 900;
            }
            .terms {
              margin-top: 18px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 14px;
            }
            .signature-box {
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 12px;
              height: 92px;
              display: flex;
              flex-direction: column;
              justify-content: end;
              background: #fbfdff;
            }
            .signature-line {
              border-top: 1px solid #111827;
              padding-top: 8px;
              text-align: center;
              color: #4b5563;
              font-weight: 700;
              font-size: 11px;
            }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              gap: 10px;
              color: #6b7280;
              font-size: 10px;
            }
            @page { size: A4; margin: 0; }
            @media print {
              body { background: #ffffff; }
              .page { width: auto; min-height: auto; margin: 0; box-shadow: none; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="top-border"></div>

            <div class="header">
              <div class="brand">
                <div class="logo-box">
                  <img src="${escapePrintHtml(branding.logoUrl)}" alt="Logo" onerror="this.style.display='none'" />
                </div>
                <div>
                  <h1>${escapePrintHtml(branding.businessName)}</h1>
                  <div class="brand-lines">
                    <div>${escapePrintHtml(branding.tin)}</div>
                    <div>${escapePrintHtml(branding.phone)}</div>
                    <div>${escapePrintHtml(branding.email)}</div>
                    <div>${escapePrintHtml(branding.address)}</div>
                  </div>
                </div>
              </div>

              <div class="po-title">
                <h2>PURCHASE ORDER</h2>
                <div class="po-number">${escapePrintHtml(purchase.purchase_no || "PO")}</div>
                <br />
                <div class="status-pill">${escapePrintHtml(status)}</div>
              </div>
            </div>

            <div class="meta-grid">
              <div class="card">
                <h3>Supplier</h3>
                <div class="value">${escapePrintHtml(purchase.supplier_name || supplier?.name || "No Supplier")}</div>
                <div class="muted small">${escapePrintHtml((supplier as any)?.phone || (supplier as any)?.email || "Supplier contact not recorded")}</div>
                <div class="muted small">${escapePrintHtml((supplier as any)?.address || (supplier as any)?.city || "")}</div>
              </div>

              <div class="card">
                <h3>Order Details</h3>
                <div class="label">PO Date</div>
                <div class="value">${escapePrintHtml(purchase.date || "—")}</div>
                <div class="label" style="margin-top:6px;">Expected Delivery</div>
                <div class="value">${escapePrintHtml(purchase.expected_delivery || "—")}</div>
              </div>

              <div class="card">
                <h3>Receiving</h3>
                <div class="label">Branch / Store</div>
                <div class="value">${escapePrintHtml(purchase.branch || "Main Store")}</div>
                <div class="label" style="margin-top:6px;">Items</div>
                <div class="value">${purchaseItems.length.toLocaleString()}</div>
              </div>

              <div class="card">
                <h3>Payment</h3>
                <div class="label">Method</div>
                <div class="value">${escapePrintHtml(String(purchase.payment_method || "—").replace(/_/g, " "))}</div>
                <div class="label" style="margin-top:6px;">Balance Due</div>
                <div class="value">${escapePrintHtml(formatCurrency(poDue))}</div>
              </div>
            </div>

            <div class="section-title">
              <h3>Line Items</h3>
              <span class="muted small">Generated: ${escapePrintHtml(printDate)}</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width:34px;" class="center">#</th>
                  <th>Product / SKU</th>
                  <th class="right" style="width:70px;">Ordered</th>
                  <th class="right" style="width:74px;">Received</th>
                  <th class="right" style="width:100px;">Unit Cost</th>
                  <th class="right" style="width:112px;">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="6" class="center muted">No line items recorded for this purchase order.</td></tr>`}
              </tbody>
            </table>

            <div class="summary-row">
              <div class="notes">
                <h3>Notes / Terms</h3>
                <div>${escapePrintHtml(purchase.notes || "Please supply the listed products in good condition. Attach invoice and delivery note when delivering goods.")}</div>
              </div>

              <div class="totals">
                <h3>Order Summary</h3>
                <div class="total-line"><span>Subtotal</span><strong>${escapePrintHtml(formatCurrency(poSubtotal))}</strong></div>
                <div class="total-line"><span>Tax</span><strong>${escapePrintHtml(formatCurrency(poTax))}</strong></div>
                <div class="total-line"><span>Shipping / Handling</span><strong>${escapePrintHtml(formatCurrency(poShipping))}</strong></div>
                <div class="total-line"><span>Discount</span><strong>${escapePrintHtml(formatCurrency(poDiscount))}</strong></div>
                <div class="total-line"><span>Paid</span><strong>${escapePrintHtml(formatCurrency(poPaid))}</strong></div>
                <div class="total-line grand-total"><span>Grand Total</span><span>${escapePrintHtml(formatCurrency(poTotal))}</span></div>
              </div>
            </div>

            <div class="terms">
              <div class="signature-box"><div class="signature-line">Prepared By</div></div>
              <div class="signature-box"><div class="signature-line">Approved By</div></div>
              <div class="signature-box"><div class="signature-line">Supplier Signature</div></div>
            </div>

            <div class="footer">
              <span>${escapePrintHtml(branding.businessName)} · Purchase Order ${escapePrintHtml(purchase.purchase_no || "")}</span>
              <span>Printed from ShopCore POS System</span>
            </div>
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.focus();
                window.print();
              }, 350);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const downloadPurchaseOrder = async (purchase: any) => {
    if (!purchase) return;

    const purchaseWithItems = await hydratePurchaseForDocument(purchase);
    const purchaseItems = normalizeItemsFromPurchase(purchaseWithItems);
    const supplier = suppliers.find((s: any) => String(s.id) === String(purchaseWithItems.supplier_id));
    const branding = getPrintBranding(purchaseWithItems);
    const status = String(purchaseWithItems.status || "draft").toUpperCase().replace(/_/g, " ");
    const poSubtotal = safeNumber(purchaseWithItems.subtotal);
    const poTax = safeNumber(purchaseWithItems.tax);
    const poShipping = safeNumber(purchaseWithItems.shipping);
    const poDiscount = safeNumber(purchaseWithItems.discount);
    const poPaid = safeNumber((purchaseWithItems as any).paid);
    const poTotal = safeNumber(purchaseWithItems.total);
    const poDue = safeNumber(purchaseWithItems.due);
    const generatedAt = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const rows = purchaseItems
      .map((item, index) => {
        const qty = safeNumber(item.quantity);
        const unitCost = safeNumber(item.unit_cost);
        const lineTotal = safeNumber(item.total || qty * unitCost);

        return `
          <tr>
            <td>${index + 1}</td>
            <td><strong>${escapePrintHtml(item.product_name || "Unknown Product")}</strong><br /><small>SKU: ${escapePrintHtml(item.sku || "—")}</small></td>
            <td style="text-align:right;">${qty.toLocaleString()}</td>
            <td style="text-align:right;">${safeNumber(item.received_qty) || "—"}</td>
            <td style="text-align:right;">${escapePrintHtml(formatCurrency(unitCost))}</td>
            <td style="text-align:right;"><strong>${escapePrintHtml(formatCurrency(lineTotal))}</strong></td>
          </tr>
        `;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Purchase Order ${escapePrintHtml(purchaseWithItems.purchase_no || "PO")}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;margin:0;color:#111827;}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:18mm;box-sizing:border-box;}
  .bar{height:8px;background:#0b3d5c;margin:-18mm -18mm 14mm;}
  .header{display:flex;justify-content:space-between;gap:32px;border-bottom:2px solid #0b3d5c;padding-bottom:18px;}
  .brand{display:flex;gap:16px;align-items:flex-start;}
  .logo{width:78px;height:78px;border:1px solid #d1d5db;border-radius:16px;object-fit:contain;padding:8px;}
  h1,h2,h3{color:#0b3d5c;margin:0;}
  .title{text-align:right;letter-spacing:.08em;font-size:32px;font-weight:900;}
  .pill{display:inline-block;margin-top:10px;border:2px solid #0b3d5c;border-radius:999px;padding:7px 14px;font-weight:800;color:#0b3d5c;}
  .status{display:inline-block;margin-top:10px;border-radius:999px;padding:6px 12px;background:#ecfeff;color:#0e7490;border:1px solid #67e8f9;font-size:12px;font-weight:800;}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px;}
  .card{border:1px solid #e5e7eb;border-radius:14px;padding:13px;background:#fbfdff;}
  .card h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;}
  .label{font-size:11px;color:#6b7280;text-transform:uppercase;}
  .value{font-weight:800;margin-bottom:7px;}
  table{width:100%;border-collapse:collapse;margin-top:18px;border:1px solid #e5e7eb;}
  th{background:#0b3d5c;color:white;text-align:left;padding:10px;font-size:12px;text-transform:uppercase;}
  td{border-top:1px solid #e5e7eb;padding:10px;vertical-align:top;}
  tbody tr:nth-child(even) td{background:#f8fafc;}
  .summary{display:grid;grid-template-columns:1fr 90mm;gap:18px;margin-top:22px;}
  .notes,.totals{border:1px solid #e5e7eb;border-radius:14px;padding:14px;background:#fbfdff;}
  .line{display:flex;justify-content:space-between;border-bottom:1px dashed #e5e7eb;padding:7px 0;}
  .grand{border-top:2px solid #0b3d5c;margin-top:8px;padding-top:10px;color:#0b3d5c;font-size:20px;font-weight:900;}
  .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:40px;}
  .sig{border-top:1px solid #111827;text-align:center;padding-top:9px;font-weight:700;color:#4b5563;}
  .footer{margin-top:24px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:11px;color:#6b7280;display:flex;justify-content:space-between;}
  @media print{body{background:#fff}.page{width:auto;margin:0}}
</style>
</head>
<body>
<div class="page">
  <div class="bar"></div>
  <div class="header">
    <div class="brand">
      <img class="logo" src="${escapePrintHtml(branding.logoUrl)}" onerror="this.style.display='none'" />
      <div>
        <h1>${escapePrintHtml(branding.businessName)}</h1>
        <div>${escapePrintHtml(branding.tin)}</div>
        <div>${escapePrintHtml(branding.phone)}</div>
        <div>${escapePrintHtml(branding.email)}</div>
        <div>${escapePrintHtml(branding.address)}</div>
      </div>
    </div>
    <div>
      <div class="title">PURCHASE<br/>ORDER</div>
      <div class="pill">${escapePrintHtml(purchaseWithItems.purchase_no || "PO")}</div><br/>
      <div class="status">${escapePrintHtml(status)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card"><h3>Supplier</h3><div class="value">${escapePrintHtml(purchaseWithItems.supplier_name || supplier?.name || "No Supplier")}</div><div>${escapePrintHtml((supplier as any)?.phone || (supplier as any)?.email || "Supplier contact not recorded")}</div><div>${escapePrintHtml((supplier as any)?.address || (supplier as any)?.city || "")}</div></div>
    <div class="card"><h3>Order Details</h3><div class="label">PO Date</div><div class="value">${escapePrintHtml(purchaseWithItems.date || "—")}</div><div class="label">Expected Delivery</div><div class="value">${escapePrintHtml(purchaseWithItems.expected_delivery || "—")}</div></div>
    <div class="card"><h3>Receiving</h3><div class="label">Branch / Store</div><div class="value">${escapePrintHtml(purchaseWithItems.branch || "Main Store")}</div><div class="label">Items</div><div class="value">${purchaseItems.length}</div></div>
    <div class="card"><h3>Payment</h3><div class="label">Method</div><div class="value">${escapePrintHtml(String(purchaseWithItems.payment_method || "—").replace(/_/g, " "))}</div><div class="label">Balance Due</div><div class="value">${escapePrintHtml(formatCurrency(poDue))}</div></div>
  </div>

  <h3 style="margin-top:26px;">Line Items <span style="float:right;color:#6b7280;font-size:11px;font-weight:400;">Generated: ${escapePrintHtml(generatedAt)}</span></h3>
  <table>
    <thead><tr><th>#</th><th>Product / SKU</th><th style="text-align:right;">Ordered</th><th style="text-align:right;">Received</th><th style="text-align:right;">Unit Cost</th><th style="text-align:right;">Line Total</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#6b7280;">No line items recorded for this purchase order.</td></tr>'}</tbody>
  </table>

  <div class="summary">
    <div class="notes"><h3>Notes / Terms</h3><p>${escapePrintHtml(purchaseWithItems.notes || "Please supply the listed products in good condition. Attach invoice and delivery note when delivering goods.")}</p></div>
    <div class="totals"><h3>Order Summary</h3><div class="line"><span>Subtotal</span><strong>${escapePrintHtml(formatCurrency(poSubtotal))}</strong></div><div class="line"><span>Tax</span><strong>${escapePrintHtml(formatCurrency(poTax))}</strong></div><div class="line"><span>Shipping / Handling</span><strong>${escapePrintHtml(formatCurrency(poShipping))}</strong></div><div class="line"><span>Discount</span><strong>${escapePrintHtml(formatCurrency(poDiscount))}</strong></div><div class="line"><span>Paid</span><strong>${escapePrintHtml(formatCurrency(poPaid))}</strong></div><div class="line grand"><span>Grand Total</span><span>${escapePrintHtml(formatCurrency(poTotal))}</span></div></div>
  </div>

  <div class="signatures"><div class="sig">Prepared By</div><div class="sig">Approved By</div><div class="sig">Supplier Signature</div></div>
  <div class="footer"><span>${escapePrintHtml(branding.businessName)} · ${escapePrintHtml(purchaseWithItems.purchase_no || "")}</span><span>Downloaded from ShopCore POS System</span></div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${purchaseWithItems.purchase_no || "purchase-order"}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Purchase order downloaded.");
  };

  const exportPurchases = () => {
    const headers = ["PO Number", "Supplier", "Date", "Items", "Subtotal", "Tax", "Discount", "Shipping", "Total", "Paid", "Due", "Status", "Sync"];
    const rows = filtered.map((p: any) => [
      p.purchase_no || "",
      p.supplier_name || "No Supplier",
      p.date || p.created_at || "",
      String(p.items_count || 0),
      String(safeNumber(p.subtotal)),
      String(safeNumber(p.tax)),
      String(safeNumber(p.discount)),
      String(safeNumber(p.shipping)),
      String(safeNumber(p.total)),
      String(safeNumber(p.paid)),
      String(safeNumber(p.due)),
      p.status || "",
      isPendingSync(p) ? "pending" : "synced",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `purchases_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageBackground image={warehouseBg} opacity={0.04}>
      <PageShell
        title="Purchases"
        description="Control purchase orders, supplier sourcing, goods receiving, landed costs, batch intake, supplier balances, and offline stock replenishment."
      >
        {(offlineModeActive || stats.pendingSync > 0) && (
          <div className="mb-6 rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                  {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-bold">
                    {offlineModeActive ? "Purchases are using offline cache" : "Purchases waiting to sync"}
                  </p>
                  <p className="text-sm opacity-90">
                    Pending purchase records: {stats.pendingSync}. Received purchases update Products, POS, Stock Overview, Dashboard, and Reports locally.
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
            <div className="relative overflow-hidden border-b xl:border-b-0 xl:border-r bg-blue-50 border-blue-200 p-6 lg:p-7">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-200/70 blur-2xl" />
              <div className="absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-emerald-500/10 blur-2xl" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white mb-5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Procurement Control
                </div>

                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                      <Layers3 className="w-8 h-8" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white" />
                  </div>

                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-950">
                      Purchase Orders
                    </h1>

                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                      Plan supplier orders, receive stock into batches, control landed cost, update warehouse quantities, and keep purchasing work available online or offline.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Total Value
                    </div>
                    <p className="text-sm font-semibold mt-1">
                      {formatCurrency(stats.totalValue)}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      Suppliers
                    </div>
                    <p className="text-sm font-semibold mt-1">{stats.suppliersCount}</p>
                  </div>

                  <div className="rounded-2xl border bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="w-3.5 h-3.5 text-violet-600" />
                      Pending Sync
                    </div>
                    <p className="text-sm font-semibold mt-1">{stats.pendingSync} records</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-slate-50 p-6 lg:p-7">
              {topSummaryCards.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-3xl border ${item.wrapper} p-5 shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-11 h-11 rounded-2xl ${item.iconBox} flex items-center justify-center`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="h-2 w-2 rounded-full bg-current opacity-30" />
                  </div>

                  <p className="text-sm text-white/80">{item.label}</p>

                  <p
                    className={`font-bold font-data mt-1 leading-tight tracking-tight ${item.valueColor} ${
                      String(item.value).length > 10
                        ? "text-base xl:text-lg break-words max-w-full"
                        : "text-1xl"
                    }`}
                  >
                    {item.value}
                  </p>

                  <div className="mt-4 inline-flex rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] text-white/85">
                    {item.helper}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-cyan-200 bg-cyan-50 shadow-sm p-4 mb-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl border border-cyan-200 bg-white">
              <Search className="w-4 h-4 text-cyan-700" />
              <input
                placeholder="Search purchase orders by PO, supplier, branch, or payment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full xl:w-44 h-11 rounded-2xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={syncFilter} onValueChange={setSyncFilter}>
              <SelectTrigger className="w-full xl:w-40 h-11 rounded-2xl">
                <SelectValue placeholder="Sync" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sync</SelectItem>
                <SelectItem value="synced">Synced</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={exportPurchases} className={`h-11 rounded-2xl ${BTN_INFO}`}>
              <Receipt className="w-4 h-4 mr-2" />
              Export
            </Button>

            <Button
              onClick={openCreate}
              className={`h-11 rounded-2xl ${BTN_PRIMARY}`}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Purchase
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-blue-950">Receiving Control</h3>
                <p className="text-xs text-blue-800">Receive POs into stock, batches, movements, reports and POS availability.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-emerald-950">Stock Replenishment</h3>
                <p className="text-xs text-emerald-800">Use purchase intake to restore low stock, update cost, selling price, and batch balance.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-orange-950">Supplier Exceptions</h3>
                <p className="text-xs text-orange-800">Track draft, delayed, partial and unpaid purchase orders before they affect stock flow.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50/70">
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No purchase orders available
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p: any) => {
                  const config = statusConfig[p.status] ?? statusConfig.draft;
                  const StatusIcon = config.icon;
                  const pending = isPendingSync(p);

                  return (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell className="font-data text-xs font-medium">
                        {p.purchase_no}
                      </TableCell>

                      <TableCell className="font-medium">
                        {p.supplier_name || "No Supplier"}
                      </TableCell>

                      <TableCell className="text-sm">
                        {p.date
                          ? format(new Date(p.date), "MMM dd, yyyy")
                          : p.created_at
                            ? format(new Date(p.created_at), "MMM dd, yyyy")
                            : "—"}
                      </TableCell>

                      <TableCell className="font-data">{p.items_count ?? normalizeItemsFromPurchase(p).length}</TableCell>

                      <TableCell className="text-right font-data">
                        {formatCurrency(safeNumber(p.total))}
                      </TableCell>

                      <TableCell className="text-right font-data">
                        {formatCurrency(safeNumber(p.paid))}
                      </TableCell>

                      <TableCell className="text-right font-data">
                        {safeNumber(p.due) > 0 ? (
                          <span className="text-destructive">{formatCurrency(safeNumber(p.due))}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className={`gap-1 rounded-full ${config.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 rounded-full ${
                            pending
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          }`}
                        >
                          {pending ? <UploadCloud className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                          {pending ? "Pending" : "Synced"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={processingId === p.id}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openViewPurchase(p)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => printPurchaseOrder(p)}>
                              <Printer className="w-4 h-4 mr-2" />
                              Print PO
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => downloadPurchaseOrder(p)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download PO
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>

                            {p.status === "draft" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(p, "ordered")}>
                                <Clock className="w-4 h-4 mr-2" />
                                Mark as Ordered
                              </DropdownMenuItem>
                            )}

                            {["draft", "ordered", "partial"].includes(p.status) && (
                              <DropdownMenuItem onClick={() => handleStatusChange(p, "received")}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Receive & Update Stock
                              </DropdownMenuItem>
                            )}

                            {!["received", "cancelled"].includes(p.status) && (
                              <DropdownMenuItem onClick={() => handleStatusChange(p, "cancelled")}>
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(p.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Purchase Order" : "New Purchase Order"}</DialogTitle>
              <DialogDescription>
                Supplier is optional. Use No Supplier for direct stock receiving. Received purchases update stock locally even offline.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PO Number *</Label>
                  <Input
                    value={form.purchase_no}
                    onChange={(e) => setForm({ ...form, purchase_no: e.target.value })}
                    className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Supplier Optional</Label>
                  <Select
                    value={form.supplier_id ?? "none"}
                    onValueChange={(value) => {
                      if (value === "none") {
                        setForm({
                          ...form,
                          supplier_id: null,
                          supplier_name: "No Supplier",
                        });
                        return;
                      }

                      const supplier = suppliers.find((s) => s.id === value);
                      setForm({
                        ...form,
                        supplier_id: value,
                        supplier_name: supplier?.name ?? "No Supplier",
                      });
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70">
                      <SelectValue placeholder="No Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Supplier</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expected Delivery</Label>
                  <Input
                    type="date"
                    value={form.expected_delivery}
                    onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })}
                    className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="partial">Partially Received</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Paid Amount</Label>
                  <Input
                    type="number"
                    value={form.paid}
                    onChange={(e) => setForm({ ...form, paid: safeNumber(e.target.value) })}
                    className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70"
                  />
                </div>
              </div>

              <div className="border border-emerald-200 rounded-3xl p-4 space-y-4 bg-emerald-50">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Line Items</Label>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70" onClick={() => setScannerOpen(true)}>
                      <ScanBarcode className="w-4 h-4 mr-1" />
                      Scan
                    </Button>

                    <Button type="button" variant="outline" size="sm" className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70" onClick={addItem}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No items added. Click Add Item or scan a barcode.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_80px_110px_110px_120px_36px] gap-2 text-xs font-medium text-muted-foreground">
                      <span>Product</span>
                      <span>Qty</span>
                      <span>Unit Cost</span>
                      <span>Selling Price</span>
                      <span>Total</span>
                      <span />
                    </div>

                    {items.map((item, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_110px_110px_120px_36px] gap-2 items-center">
                        <ProductAutocomplete
                          value={item.product_name}
                          products={cleanProducts}
                          onSelect={(p) => {
                            const updated = [...items];
                            updated[i] = {
                              ...updated[i],
                              product_id: p.id,
                              product_name: p.name,
                              sku: p.sku,
                              unit_cost: getProductCost(p),
                              selling_price: getProductPrice(p),
                              total: safeNumber(updated[i].quantity) * getProductCost(p),
                            };
                            setItems(updated);
                          }}
                          onChange={(v) => updateItem(i, "product_name", v)}
                        />

                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(i, "quantity", safeNumber(e.target.value))}
                          className="h-9 rounded-xl text-sm"
                        />

                        <Input
                          type="number"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(i, "unit_cost", safeNumber(e.target.value))}
                          className="h-9 rounded-xl text-sm"
                        />

                        <Input
                          type="number"
                          value={item.selling_price}
                          onChange={(e) => updateItem(i, "selling_price", safeNumber(e.target.value))}
                          className="h-9 rounded-xl text-sm"
                        />

                        <p className="text-sm font-data text-right">
                          {formatCurrency(item.total)}
                        </p>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(i)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-data">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax (16%)</span>
                    <span className="font-data">{formatCurrency(tax)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Shipping</span>
                    <Input
                      type="number"
                      value={form.shipping}
                      onChange={(e) => setForm({ ...form, shipping: safeNumber(e.target.value) })}
                      className="w-28 h-8 rounded-xl text-sm text-right"
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Discount</span>
                    <Input
                      type="number"
                      value={form.discount}
                      onChange={(e) => setForm({ ...form, discount: safeNumber(e.target.value) })}
                      className="w-28 h-8 rounded-xl text-sm text-right"
                    />
                  </div>

                  <div className="flex justify-between font-semibold text-base border-t pt-3">
                    <span>Total</span>
                    <span className="font-data text-[#0b3d5c]">{formatCurrency(total)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Due</span>
                    <span className="font-data text-destructive">{formatCurrency(due)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(v) => setForm({ ...form, payment_method: v })}
                  >
                    <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="mobile">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Input
                    value={form.branch}
                    onChange={(e) => setForm({ ...form, branch: e.target.value })}
                    className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                  rows={2}
                  className="rounded-xl border-blue-200 bg-blue-50/50 placeholder:text-blue-700/70"
                />
              </div>

              {form.status === "received" && (
                <div className="rounded-2xl border bg-emerald-500/10 p-3 text-sm text-emerald-700">
                  This purchase will immediately add quantities to Products, POS, Stock Overview, Dashboard, and Reports. Offline changes will sync later.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={create.isPending || update.isPending || !!processingId}
                className={BTN_PRIMARY}
              >
                {processingId ? "Saving..." : editing ? "Save Changes" : "Create PO"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewPurchase} onOpenChange={() => setViewPurchase(null)}>
          <DialogContent className="w-[95vw] max-w-5xl rounded-3xl p-0 overflow-hidden">
            <div className="max-h-[88vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>{viewPurchase?.purchase_no}</DialogTitle>
              <DialogDescription>
                {viewPurchase?.supplier_name || "No Supplier"} · {viewPurchase?.date || "—"}
              </DialogDescription>
            </DialogHeader>

            {viewPurchase && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-data font-bold">{formatCurrency(safeNumber(viewPurchase.total))}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="font-data font-bold">{formatCurrency(safeNumber((viewPurchase as any).paid))}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs text-muted-foreground">Due</p>
                    <p className="font-data font-bold text-destructive">{formatCurrency(safeNumber(viewPurchase.due))}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-xs text-muted-foreground">Sync</p>
                    <p className="font-medium">{isPendingSync(viewPurchase) ? "Pending" : "Synced"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normalizeItemsFromPurchase(viewPurchase).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No local line items found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        normalizeItemsFromPurchase(viewPurchase).map((item, index) => (
                          <TableRow key={`${item.product_id}-${index}`}>
                            <TableCell>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-muted-foreground">{item.sku || "No SKU"}</p>
                            </TableCell>
                            <TableCell className="text-right font-data">{item.quantity}</TableCell>
                            <TableCell className="text-right font-data">{formatCurrency(item.unit_cost)}</TableCell>
                            <TableCell className="text-right font-data">{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse gap-2 border-t bg-background/95 p-4 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="outline" onClick={() => printPurchaseOrder(viewPurchase)}>
                <Printer className="w-4 h-4 mr-2" />
                Print PO
              </Button>

              <Button variant="outline" onClick={() => downloadPurchaseOrder(viewPurchase)}>
                <Download className="w-4 h-4 mr-2" />
                Download PO
              </Button>

              {viewPurchase && ["draft", "ordered", "partial"].includes(viewPurchase.status) && (
                <Button
                  className={BTN_SUCCESS}
                  onClick={() => {
                    const purchase = viewPurchase;
                    setViewPurchase(null);
                    handleStatusChange(purchase, "received");
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Receive & Update Stock
                </Button>
              )}
              <Button variant="outline" onClick={() => setViewPurchase(null)}>
                Close
              </Button>
            </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent className="sm:max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Delete Purchase Order</DialogTitle>
              <DialogDescription>
                Online records will be deleted immediately. Offline records will be queued for deletion.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
      </PageShell>
    </PageBackground>
  );
}
