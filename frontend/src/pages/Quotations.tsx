import { useMemo, useState } from "react";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Pencil,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Package,
  BarChart3,
  Wallet,
  TrendingUp,
  ClipboardCheck,
  Percent,
  ArrowRightCircle,
  Mail,
  Phone,
  CalendarDays,
  Eye,
  Copy,
  Download,
  Wifi,
  WifiOff,
  UploadCloud,
  Database,
  CreditCard,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  UserRound,
  Receipt,
  Printer,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useSupabaseData";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/utils/currency";
import { toast } from "sonner";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const SHOPCORE_BLUE = "#2563eb";
const TAX_RATE = 0.16;
const PAGE_SIZE = 12;

const BTN_PRIMARY = "bg-blue-600 text-white hover:bg-blue-700 border-blue-600";
const BTN_SUCCESS = "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600";
const BTN_WARNING = "bg-amber-500 text-white hover:bg-amber-600 border-amber-500";
const BTN_INFO = "bg-cyan-600 text-white hover:bg-cyan-700 border-cyan-600";
const BTN_DANGER = "bg-rose-600 text-white hover:bg-rose-700 border-rose-600";
const BTN_PURPLE = "bg-violet-600 text-white hover:bg-violet-700 border-violet-600";


interface QuoteItem {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quotation {
  id: string;
  tenant_id: string;
  user_id: string | null;
  quotation_no: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  status: string | null;
  valid_until: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes: string | null;
  items: QuoteItem[];
  created_at: string;
  updated_at?: string | null;
  created_offline_at?: string | null;
  updated_offline_at?: string | null;
  operation?: "create" | "update" | "delete";
  sync_status?: "synced" | "pending" | "pending_update" | "pending_delete" | "failed";
  offline_id?: string | null;
}

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "expired", label: "Expired" },
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

function makeQuoteNo() {
  return `QT-${Date.now().toString().slice(-8)}`;
}

function getQuoteDate(quote: any) {
  return quote?.created_at || quote?.created_offline_at || quote?.updated_offline_at || new Date().toISOString();
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

function formatDateTime(value?: string | null) {
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

function isArchivedProduct(row: any) {
  const status = String(row?.status || row?.product_status || "active").toLowerCase();
  return (
    isDeletedRecord(row) ||
    status === "inactive" ||
    status === "archived" ||
    status === "deleted" ||
    status === "pending_delete" ||
    !!row?.archived_at ||
    !!row?.deleted_at
  );
}

function isExpiredQuote(quote: any) {
  if (!quote?.valid_until) return false;
  const date = new Date(quote.valid_until);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < new Date(new Date().toDateString()).getTime();
}

function normalizeQuotation(row: any): Quotation {
  return {
    id: String(row.id || row.offline_id || makeLocalId("offline-quote")),
    tenant_id: row.tenant_id || "",
    user_id: row.user_id || null,
    quotation_no: row.quotation_no || row.quote_no || makeQuoteNo(),
    customer_name: row.customer_name || "Unnamed Customer",
    customer_email: row.customer_email || null,
    customer_phone: row.customer_phone || null,
    status: row.status || (isExpiredQuote(row) ? "expired" : "open"),
    valid_until: row.valid_until || null,
    subtotal: safeNumber(row.subtotal),
    tax: safeNumber(row.tax),
    discount: safeNumber(row.discount),
    total: safeNumber(row.total),
    notes: row.notes || null,
    items: Array.isArray(row.items) ? row.items : [],
    created_at: row.created_at || row.created_offline_at || new Date().toISOString(),
    updated_at: row.updated_at || null,
    created_offline_at: row.created_offline_at || null,
    updated_offline_at: row.updated_offline_at || null,
    operation: row.operation || undefined,
    sync_status: row.sync_status || "synced",
    offline_id: row.offline_id || null,
  };
}

function dedupeQuotations(rows: any[]) {
  const map = new Map<string, Quotation>();

  for (const row of rows || []) {
    const quote = normalizeQuotation(row);
    const key = String(quote.id || quote.offline_id || quote.quotation_no || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, quote);
      continue;
    }

    const incomingTime = new Date(quote.updated_offline_at || quote.updated_at || quote.created_at || 0).getTime();
    const existingTime = new Date(existing.updated_offline_at || existing.updated_at || existing.created_at || 0).getTime();

    map.set(key, incomingTime >= existingTime ? { ...existing, ...quote } : { ...quote, ...existing });
  }

  return Array.from(map.values())
    .filter((quote) => !isDeletedRecord(quote))
    .sort((a, b) => new Date(getQuoteDate(b)).getTime() - new Date(getQuoteDate(a)).getTime());
}

function getQuoteStatus(quote: Quotation) {
  if ((quote.status || "open") !== "accepted" && (quote.status || "open") !== "cancelled" && isExpiredQuote(quote)) {
    return "expired";
  }
  return quote.status || "open";
}

export default function Quotations() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const availableProducts = useMemo(() => (products as any[]).filter((product) => !isArchivedProduct(product)), [products]);

  const onlineReady = isOnline() && !isOfflineMode() && !!session?.access_token;
  const offlineModeActive = !onlineReady;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [viewQuote, setViewQuote] = useState<Quotation | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState("open");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([]);

  const cacheQuotations = async (rows: any[]) => {
    const cleaned = dedupeQuotations(rows);
    await saveCachedTable("quotations", cleaned);
    return cleaned;
  };

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["quotations", tenantId, onlineReady ? "online" : "offline"],
    enabled: !!tenantId || !onlineReady,
    retry: onlineReady ? 1 : 0,
    refetchOnWindowFocus: onlineReady,
    queryFn: async () => {
      if (!onlineReady) {
        const cached = await getCachedTable("quotations");
        return dedupeQuotations(Array.isArray(cached) ? cached : []);
      }

      try {
        const { data, error } = await (supabase as any)
          .from("quotations")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return cacheQuotations(data || []);
      } catch (error: any) {
        if (isNetworkError(error)) {
          const cached = await getCachedTable("quotations");
          return dedupeQuotations(Array.isArray(cached) ? cached : []);
        }
        throw error;
      }
    },
  });

  const subtotal = items.reduce((sum, i) => sum + safeNumber(i.total), 0);
  const tax = subtotal * TAX_RATE;
  const discountValue = safeNumber(discount);
  const total = Math.max(0, subtotal + tax - discountValue);

  const persistLocalRows = async (rows: any[]) => {
    await cacheQuotations(rows);
    queryClient.setQueryData(["quotations", tenantId, onlineReady ? "online" : "offline"], dedupeQuotations(rows));
    queryClient.invalidateQueries({ queryKey: ["quotations"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const saveQuotationOffline = async (payload: Partial<Quotation>, mode: "create" | "update") => {
    if (!tenantId) throw new Error("No active workspace");

    const now = new Date().toISOString();
    const cached = await getCachedTable("quotations");
    const cachedRows = Array.isArray(cached) ? cached : [];

    const row: Quotation = {
      ...(editing || {}),
      ...payload,
      id: editing?.id || makeLocalId("offline-quote"),
      tenant_id: tenantId,
      user_id: user?.id || editing?.user_id || null,
      quotation_no: editing?.quotation_no || payload.quotation_no || makeQuoteNo(),
      customer_name: payload.customer_name || customerName.trim(),
      customer_email: payload.customer_email ?? null,
      customer_phone: payload.customer_phone ?? null,
      status: payload.status || status,
      valid_until: payload.valid_until ?? null,
      subtotal: safeNumber(payload.subtotal),
      tax: safeNumber(payload.tax),
      discount: safeNumber(payload.discount),
      total: safeNumber(payload.total),
      notes: payload.notes ?? null,
      items: Array.isArray(payload.items) ? payload.items : items,
      created_at: editing?.created_at || now,
      updated_at: now,
      created_offline_at: editing?.created_offline_at || (mode === "create" ? now : null),
      updated_offline_at: now,
      operation: editing?.id?.startsWith("offline-") ? "create" : mode,
      sync_status: editing?.id?.startsWith("offline-") || mode === "create" ? "pending" : "pending_update",
      offline_id: editing?.offline_id || (editing?.id?.startsWith("offline-") ? editing.id : null),
    };

    const nextRows = editing
      ? cachedRows.map((quote: any) => (String(quote.id) === String(editing.id) ? row : quote))
      : [row, ...cachedRows];

    await persistLocalRows(nextRows);
    await savePending("quotations", row as any);

    toast.success(mode === "create" ? "Quotation saved offline. It will sync later." : "Quotation updated offline. It will sync later.");
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return quotations.filter((quote) => {
      const quoteStatus = getQuoteStatus(quote);
      const matchSearch =
        !q ||
        (quote.quotation_no || "").toLowerCase().includes(q) ||
        (quote.customer_name || "").toLowerCase().includes(q) ||
        (quote.customer_email || "").toLowerCase().includes(q) ||
        (quote.customer_phone || "").toLowerCase().includes(q) ||
        (quote.notes || "").toLowerCase().includes(q) ||
        quote.items?.some((item) => item.product_name.toLowerCase().includes(q));

      const matchStatus = statusFilter === "all" || quoteStatus === statusFilter;
      const pending = isPendingSync(quote);
      const matchSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      return matchSearch && matchStatus && matchSync;
    });
  }, [quotations, search, statusFilter, syncFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const open = quotations.filter((q) => getQuoteStatus(q) === "open").length;
    const sent = quotations.filter((q) => getQuoteStatus(q) === "sent").length;
    const accepted = quotations.filter((q) => getQuoteStatus(q) === "accepted").length;
    const expired = quotations.filter((q) => getQuoteStatus(q) === "expired").length;
    const totalValue = quotations.reduce((s, q) => s + safeNumber(q.total), 0);
    const acceptedValue = quotations
      .filter((q) => getQuoteStatus(q) === "accepted")
      .reduce((s, q) => s + safeNumber(q.total), 0);
    const pendingSync = quotations.filter(isPendingSync).length;
    const rate = quotations.length > 0 ? Math.round((accepted / quotations.length) * 100) : 0;

    return {
      open,
      sent,
      accepted,
      expired,
      totalValue,
      acceptedValue,
      rate,
      filtered: filtered.length,
      total: quotations.length,
      pendingSync,
    };
  }, [quotations, filtered.length]);

  const exportRows = filtered.map((quote) => ({
    quotation_no: quote.quotation_no || "",
    customer_name: quote.customer_name || "",
    customer_email: quote.customer_email || "",
    customer_phone: quote.customer_phone || "",
    status: getQuoteStatus(quote),
    valid_until: quote.valid_until || "",
    items: quote.items?.length || 0,
    subtotal: formatCurrency(safeNumber(quote.subtotal)),
    tax: formatCurrency(safeNumber(quote.tax)),
    discount: formatCurrency(safeNumber(quote.discount)),
    total: formatCurrency(safeNumber(quote.total)),
    sync_status: isPendingSync(quote) ? "Pending" : "Synced",
    created_at: formatDateTime(getQuoteDate(quote)),
  }));

  const exportCols = [
    { key: "quotation_no" as const, label: "Quotation No" },
    { key: "customer_name" as const, label: "Customer" },
    { key: "customer_email" as const, label: "Email" },
    { key: "customer_phone" as const, label: "Phone" },
    { key: "status" as const, label: "Status" },
    { key: "valid_until" as const, label: "Valid Until" },
    { key: "items" as const, label: "Items" },
    { key: "subtotal" as const, label: "Subtotal" },
    { key: "tax" as const, label: "Tax" },
    { key: "discount" as const, label: "Discount" },
    { key: "total" as const, label: "Total" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "created_at" as const, label: "Created At" },
  ];

  const openCreate = () => {
    setEditing(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setValidUntil("");
    setStatus("open");
    setDiscount("");
    setNotes("");
    setItems([]);
    setDialogOpen(true);
  };

  const openEdit = (quote: Quotation) => {
    setEditing(quote);
    setCustomerName(quote.customer_name || "");
    setCustomerEmail(quote.customer_email || "");
    setCustomerPhone(quote.customer_phone || "");
    setValidUntil(quote.valid_until || "");
    setStatus(getQuoteStatus(quote));
    setDiscount(String(quote.discount || ""));
    setNotes(quote.notes || "");
    setItems(Array.isArray(quote.items) ? quote.items : []);
    setDialogOpen(true);
  };

  const addItemFromProduct = (productId: string) => {
    const product = availableProducts.find((p: any) => String(p.id) === String(productId));
    if (!product) return;

    const price = safeNumber((product as any).selling_price ?? (product as any).price);

    setItems([
      ...items,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: price,
        total: price,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: string | number) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;

    updated[index].quantity = safeNumber(updated[index].quantity);
    updated[index].unit_price = safeNumber(updated[index].unit_price);
    updated[index].total = updated[index].quantity * updated[index].unit_price;

    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const buildPayload = () => {
    if (!tenantId) throw new Error("No active workspace");
    if (!customerName.trim()) throw new Error("Customer name is required");
    if (items.length === 0) throw new Error("Add at least one item");

    return {
      tenant_id: tenantId,
      user_id: user?.id || null,
      quotation_no: editing?.quotation_no || makeQuoteNo(),
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim() || null,
      customer_phone: customerPhone.trim() || null,
      status,
      valid_until: validUntil || null,
      subtotal,
      tax,
      discount: discountValue,
      total,
      notes: notes.trim() || null,
      items,
      updated_at: new Date().toISOString(),
    };
  };

  const saveQuotation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();

      if (!onlineReady) {
        await saveQuotationOffline(payload, editing ? "update" : "create");
        return;
      }

      try {
        if (editing && !editing.id.startsWith("offline-")) {
          const { error } = await (supabase as any)
            .from("quotations")
            .update(payload)
            .eq("id", editing.id)
            .eq("tenant_id", tenantId);

          if (error) throw error;
        } else if (editing?.id?.startsWith("offline-")) {
          await saveQuotationOffline(payload, "update");
          return;
        } else {
          const { error } = await (supabase as any).from("quotations").insert(payload);
          if (error) throw error;
        }
      } catch (error: any) {
        if (isNetworkError(error)) {
          await saveQuotationOffline(payload, editing ? "update" : "create");
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(editing ? "Quotation updated" : "Quotation created");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ quote, newStatus }: { quote: Quotation; newStatus: string }) => {
      const patch = { status: newStatus, updated_at: new Date().toISOString() };

      if (!onlineReady || quote.id.startsWith("offline-")) {
        const cached = await getCachedTable("quotations");
        const rows = Array.isArray(cached) ? cached : quotations;
        const updatedQuote = {
          ...quote,
          ...patch,
          operation: quote.id.startsWith("offline-") ? "create" : "update",
          sync_status: quote.id.startsWith("offline-") ? "pending" : "pending_update",
          updated_offline_at: new Date().toISOString(),
        };
        await persistLocalRows(rows.map((row: any) => (String(row.id) === String(quote.id) ? updatedQuote : row)));
        await savePending("quotations", updatedQuote as any);
        return;
      }

      try {
        const { error } = await (supabase as any)
          .from("quotations")
          .update(patch)
          .eq("id", quote.id)
          .eq("tenant_id", tenantId);

        if (error) throw error;
      } catch (error: any) {
        if (isNetworkError(error)) {
          const updatedQuote = {
            ...quote,
            ...patch,
            operation: "update",
            sync_status: "pending_update",
            updated_offline_at: new Date().toISOString(),
          };
          await savePending("quotations", updatedQuote as any);
          await persistLocalRows(quotations.map((row) => (row.id === quote.id ? updatedQuote : row)));
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteQuotation = useMutation({
    mutationFn: async (quote: Quotation) => {
      if (!onlineReady || quote.id.startsWith("offline-")) {
        const cached = await getCachedTable("quotations");
        const rows = Array.isArray(cached) ? cached : quotations;

        if (quote.id.startsWith("offline-")) {
          await persistLocalRows(rows.filter((row: any) => String(row.id) !== String(quote.id)));
          return;
        }

        const deleted = {
          ...quote,
          operation: "delete",
          sync_status: "pending_delete",
          updated_offline_at: new Date().toISOString(),
        };

        await savePending("quotations", deleted as any);
        await persistLocalRows(rows.map((row: any) => (String(row.id) === String(quote.id) ? deleted : row)));
        return;
      }

      try {
        const { error } = await (supabase as any)
          .from("quotations")
          .update({ status: "deleted", operation: "delete", sync_status: "pending_delete", updated_at: new Date().toISOString() })
          .eq("id", quote.id)
          .eq("tenant_id", tenantId);

        if (error) throw error;
      } catch (error: any) {
        if (isNetworkError(error)) {
          const deleted = {
            ...quote,
            operation: "delete",
            sync_status: "pending_delete",
            updated_offline_at: new Date().toISOString(),
          };
          await savePending("quotations", deleted as any);
          await persistLocalRows(quotations.map((row) => (row.id === quote.id ? deleted : row)));
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateQuote = async (quote: Quotation) => {
    try {
      const copy = {
        ...quote,
        quotation_no: makeQuoteNo(),
        status: "open",
        valid_until: null,
        notes: quote.notes ? `${quote.notes}\nDuplicated from ${quote.quotation_no}` : `Duplicated from ${quote.quotation_no}`,
      };

      setEditing(null);
      setCustomerName(copy.customer_name || "");
      setCustomerEmail(copy.customer_email || "");
      setCustomerPhone(copy.customer_phone || "");
      setValidUntil("");
      setStatus("open");
      setDiscount(String(copy.discount || ""));
      setNotes(copy.notes || "");
      setItems(Array.isArray(copy.items) ? copy.items : []);
      setDialogOpen(true);
      toast.info("Quotation copied. Review and save it as a new quotation.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to duplicate quotation");
    }
  };

  const buildQuotationHtml = (quote: Quotation) => {
    const rows = (quote.items || [])
      .map(
        (item) => `
          <tr>
            <td>${String(item.product_name || "Item").replace(/</g, "&lt;")}</td>
            <td class="right">${safeNumber(item.quantity)}</td>
            <td class="right">${formatCurrency(safeNumber(item.unit_price))}</td>
            <td class="right">${formatCurrency(safeNumber(item.total))}</td>
          </tr>`,
      )
      .join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${quote.quotation_no || "Quotation"}</title>
  <style>
    body { margin: 0; background: #f8fafc; color: #111827; font-family: Arial, sans-serif; }
    .page { max-width: 820px; margin: 0 auto; background: #fff; min-height: 100vh; padding: 34px; }
    .top { height: 8px; background: #2563eb; margin: -34px -34px 28px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; color: #2563eb; letter-spacing: .03em; }
    .muted { color: #64748b; font-size: 12px; }
    .pill { display: inline-block; border-radius: 999px; background: #dbeafe; color: #1d4ed8; padding: 7px 12px; font-weight: 700; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 22px 0; }
    .card { border: 1px solid #dbeafe; background: #eff6ff; border-radius: 16px; padding: 14px; }
    .label { font-size: 11px; color: #2563eb; text-transform: uppercase; letter-spacing: .05em; }
    .value { margin-top: 5px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th { background: #2563eb; color: #fff; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; }
    td { border-bottom: 1px solid #e5e7eb; padding: 12px; vertical-align: top; }
    .right { text-align: right; }
    .totals { margin-left: auto; width: 320px; margin-top: 18px; border: 1px solid #d1fae5; border-radius: 16px; padding: 14px; background: #ecfdf5; }
    .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .grand { border-top: 1px solid #10b981; margin-top: 6px; padding-top: 10px; font-size: 18px; font-weight: 900; color: #047857; }
    .notes { margin-top: 18px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 16px; padding: 14px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-top: 70px; }
    .sig { border-top: 1px solid #111827; text-align: center; padding-top: 8px; font-size: 12px; color: #475569; font-weight: 700; }
    @media print { body { background: #fff; } .page { max-width: none; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="top"></div>
    <div class="header">
      <div>
        <h1>ShopCore Quotation</h1>
        <p class="muted">Professional customer proposal and price offer</p>
      </div>
      <div style="text-align:right">
        <div class="pill">${quote.quotation_no || "Quotation"}</div>
        <p class="muted">Created: ${formatDateTime(getQuoteDate(quote))}</p>
        <p class="muted">Status: ${getQuoteStatus(quote)}</p>
      </div>
    </div>

    <div class="grid">
      <div class="card"><div class="label">Customer</div><div class="value">${quote.customer_name}</div></div>
      <div class="card"><div class="label">Phone</div><div class="value">${quote.customer_phone || "—"}</div></div>
      <div class="card"><div class="label">Email</div><div class="value">${quote.customer_email || "—"}</div></div>
      <div class="card"><div class="label">Valid Until</div><div class="value">${formatDate(quote.valid_until)}</div></div>
    </div>

    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" class="muted">No items attached.</td></tr>`}</tbody>
    </table>

    <div class="totals">
      <div class="line"><span>Subtotal</span><strong>${formatCurrency(safeNumber(quote.subtotal))}</strong></div>
      <div class="line"><span>Tax 16%</span><strong>${formatCurrency(safeNumber(quote.tax))}</strong></div>
      <div class="line"><span>Discount</span><strong>-${formatCurrency(safeNumber(quote.discount))}</strong></div>
      <div class="line grand"><span>Total</span><span>${formatCurrency(safeNumber(quote.total))}</span></div>
    </div>

    ${quote.notes ? `<div class="notes"><div class="label">Notes</div><div class="value">${String(quote.notes).replace(/</g, "&lt;")}</div></div>` : ""}

    <div class="signatures">
      <div class="sig">Prepared By</div>
      <div class="sig">Customer Approval</div>
      <div class="sig">Manager Approval</div>
    </div>
  </div>
</body>
</html>`;
  };

  const printQuotation = (quote: Quotation | null) => {
    if (!quote) return;
    const printWindow = window.open("", "_blank", "width=980,height=900");
    if (!printWindow) {
      toast.error("Allow popups to print the quotation.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildQuotationHtml(quote));
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 350);
  };

  const downloadQuotation = (quote: Quotation | null) => {
    if (!quote) return;
    const html = buildQuotationHtml(quote);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${quote.quotation_no || "quotation"}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const statusClass = (s: string | null) => {
    const value = s || "open";
    if (value === "accepted") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    if (value === "expired" || value === "cancelled") return "bg-rose-500/10 text-rose-600 border-rose-500/30";
    if (value === "sent") return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  };

  const statusIcon = (s: string | null) => {
    const value = s || "open";
    if (value === "accepted") return CheckCircle2;
    if (value === "expired" || value === "cancelled") return XCircle;
    if (value === "sent") return Send;
    return Clock;
  };

  const kpis = [
    {
      label: "All Quotes",
      value: stats.total,
      icon: FileText,
      color: "bg-blue-600 text-white border-blue-600",
      helper: "pipeline records",
    },
    {
      label: "Accepted",
      value: stats.accepted,
      icon: CheckCircle2,
      color: "bg-emerald-600 text-white border-emerald-600",
      helper: "ready for sale",
    },
    {
      label: "Open",
      value: stats.open,
      icon: Clock,
      color: "bg-orange-600 text-white border-orange-600",
      helper: "needs follow-up",
    },
    {
      label: "Total Value",
      value: formatCurrency(stats.totalValue),
      icon: Wallet,
      color: "bg-violet-600 text-white border-violet-600",
      helper: "proposal value",
    },
    {
      label: "Conversion",
      value: `${stats.rate}%`,
      icon: Percent,
      color: "bg-cyan-600 text-white border-cyan-600",
      helper: "accepted ratio",
    },
    {
      label: "Expired",
      value: stats.expired,
      icon: XCircle,
      color: "bg-rose-600 text-white border-rose-600",
      helper: "price risk",
    },
  ];

  return (
    <PageShell
      title="Quotations"
      description="Manage quotations, proforma offers, proposal value, validity control, approval status, customer follow-up, and offline sales preparation."
    >
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-6">
          {(offlineModeActive || stats.pendingSync > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-2.5 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "Quotations are using offline cache" : "Quotation changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending quotation records: {stats.pendingSync}. Create, edit, accept, and delete quotations offline.
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
            <div className="xl:col-span-7 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0"
                >
                  <FileText className="w-6 h-6" />
                </div>

                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-600 text-white border-blue-600 mb-3">
                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                    Proposal Operations Center
                  </Badge>

                  <h2 className="text-xl font-bold tracking-tight">
                    Quotation Control Center
                  </h2>

                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Prepare customer offers, control validity dates, monitor conversion, protect margin,
                    duplicate winning quotations, and keep proposal work available offline.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                      <p className="text-xs font-medium text-emerald-700">Accepted Value</p>
                      <p className="text-sm font-semibold font-data text-emerald-700">
                        {formatCurrency(stats.acceptedValue)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-2.5">
                      <p className="text-xs font-medium text-violet-700">Conversion</p>
                      <p className="text-sm font-semibold font-data text-violet-700">{stats.rate}%</p>
                    </div>

                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                      <p className="text-xs font-medium text-cyan-700">Filtered Results</p>
                      <p className="text-sm font-semibold font-data text-cyan-700">{stats.filtered}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 gap-2.5">
              {kpis.map((item) => {
                const Icon = item.icon;
                const valueClass =
                  String(item.value).length > 14
                    ? "text-base xl:text-lg break-words max-w-full"
                    : "text-2xl";

                return (
                  <div
                    key={item.label}
                    className={`min-h-[94px] rounded-[1.4rem] border shadow-sm p-2.5 ${item.color}`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">{item.label}</p>
                        <p className={`${valueClass} font-bold font-data mt-1`}>
                          {item.value}
                        </p>
                        <p className="text-[11px] opacity-75 truncate">{item.helper}</p>
                      </div>

                      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 rounded-3xl border border-cyan-200 bg-cyan-50 shadow-sm p-4">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center"
                >
                  <BarChart3 className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-semibold">Quote Pipeline</h3>
                  <p className="text-xs text-muted-foreground">Status and conversion overview</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: "Open", value: stats.open, icon: Clock, color: "bg-orange-600 text-white" },
                  { label: "Sent", value: stats.sent, icon: Send, color: "bg-blue-600 text-white" },
                  { label: "Expired", value: stats.expired, icon: XCircle, color: "bg-rose-600 text-white" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-2xl p-2.5 text-center shadow-sm ${item.color}`}>
                    <item.icon className="w-4 h-4 mx-auto mb-1" />
                    <p className="text-xs text-white/80">{item.label}</p>
                    <p className="font-data font-bold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-cyan-600 p-2.5 text-white">
                <p className="text-xs text-white/80">Pipeline Value</p>
                <p className="text-sm font-semibold font-data mt-1">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
            </div>

            <div className="xl:col-span-7 rounded-3xl border border-violet-200 bg-violet-50 shadow-sm p-4">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                  <ArrowRightCircle className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-semibold">Quotation Workflow Controls</h3>
                  <p className="text-xs text-muted-foreground">
                    Validity, conversion, and approval discipline
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-2.5">
                <div className="rounded-2xl bg-blue-600 p-2.5 text-white shadow-sm">
                  <p className="text-sm font-semibold">Validity Control</p>
                  <p className="text-xs text-white/80 mt-1">
                    Protect current pricing and prevent outdated offers from being accepted.
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-600 p-2.5 text-white shadow-sm">
                  <p className="text-sm font-semibold">Conversion Tracking</p>
                  <p className="text-xs text-white/80 mt-1">
                    Mark accepted proposals to measure sales performance and customer intent.
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-600 p-2.5 text-white shadow-sm">
                  <p className="text-sm font-semibold">Offline Continuity</p>
                  <p className="text-xs text-white/80 mt-1">
                    Prepare, edit, and accept quotations locally until the branch reconnects.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-card shadow-sm p-2.5">
            <div className="flex flex-col xl:flex-row gap-2.5">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-500/20 bg-blue-500/10">
                <Search className="w-4 h-4 text-blue-700" />
                <input
                  placeholder="Search quotation, customer, phone, email, notes, or item..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full xl:w-40 h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={syncFilter} onValueChange={(v) => { setSyncFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full xl:w-36 h-10 rounded-xl">
                  <SelectValue placeholder="Sync" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sync</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Button className={`h-10 rounded-xl ${BTN_WARNING}`} onClick={() => { setSearch(""); setStatusFilter("all"); setSyncFilter("all"); setPage(1); }}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>

              <ExportMenu
                onCSV={() => exportToCSV(exportRows, "quotations", exportCols)}
                onPDF={() =>
                  exportToPDF(exportRows, "quotations", "Quotations Report", exportCols, {
                    subtitle: `${filtered.length} quotation records`,
                    summary: [
                      { label: "Open Quotes", value: String(stats.open) },
                      { label: "Accepted", value: String(stats.accepted) },
                      { label: "Total Value", value: formatCurrency(stats.totalValue) },
                      { label: "Accepted Value", value: formatCurrency(stats.acceptedValue) },
                      { label: "Pending Sync", value: String(stats.pendingSync) },
                    ],
                  })
                }
              />

              <Button onClick={openCreate} className={`h-10 rounded-xl ${BTN_PRIMARY}`}>
                <Plus className="w-4 h-4 mr-2" />
                New Quotation
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
            {isLoading ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Loading quotations...
              </div>
            ) : paged.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-blue-500/20 bg-blue-500/10 px-6 py-16 text-center text-blue-800">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-sm">
                  <FileText className="w-8 h-8" />
                </div>
                <p className="text-lg font-black">No quotations available</p>
                <p className="mx-auto mt-2 max-w-xl text-sm text-blue-800/80">
                  Create a customer quotation to prepare product offers, track validity, manage acceptance, and convert proposals into sales.
                </p>
                <Button onClick={openCreate} className={`mt-4 rounded-2xl ${BTN_PRIMARY}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Quotation
                </Button>
              </div>
            ) : (
              paged.map((quote) => {
                const quoteStatus = getQuoteStatus(quote);
                const StatusIcon = statusIcon(quoteStatus);

                return (
                  <div key={quote.id} className="rounded-3xl border border-blue-100 bg-white shadow-sm p-4 hover:-translate-y-0.5 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 ${quoteStatus === "accepted" ? "bg-emerald-600" : quoteStatus === "expired" || quoteStatus === "cancelled" ? "bg-rose-600" : quoteStatus === "sent" ? "bg-blue-600" : "bg-orange-600"}`}
                        >
                          <FileText className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold truncate">{quote.quotation_no || "No number"}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(getQuoteDate(quote))}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={`rounded-full capitalize ${statusClass(quoteStatus)}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {quoteStatus}
                        </Badge>
                        {isPendingSync(quote) && (
                          <Badge variant="outline" className="rounded-full border-blue-500/30 bg-blue-500/10 text-blue-600">
                            <UploadCloud className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="font-semibold truncate">{quote.customer_name}</p>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          {quote.customer_email || "No email"}
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          {quote.customer_phone || "No phone"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-2.5">
                        <p className="text-xs text-blue-700">Items</p>
                        <p className="font-bold font-data">{quote.items?.length || 0}</p>
                      </div>
                      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-2.5">
                        <p className="text-xs text-orange-700">Valid</p>
                        <p className="font-medium text-sm truncate">{formatDate(quote.valid_until)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5">
                        <p className="text-xs text-emerald-700">Total</p>
                        <p className="font-bold font-data text-sm truncate">{formatCurrency(safeNumber(quote.total))}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-4">
                      <Button size="sm" className={`rounded-xl ${BTN_INFO}`} onClick={() => setViewQuote(quote)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>

                      <div className="flex justify-end gap-1">
                        {quoteStatus !== "accepted" && (
                          <Button
                            className={BTN_SUCCESS}
                            size="icon"
                            onClick={() => updateStatus.mutate({ quote, newStatus: "accepted" })}
                            title="Mark accepted"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}

                        {quoteStatus === "open" && (
                          <Button
                            className={BTN_PRIMARY}
                            size="icon"
                            onClick={() => updateStatus.mutate({ quote, newStatus: "sent" })}
                            title="Mark sent"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}

                        <Button className={BTN_PURPLE} size="icon" onClick={() => duplicateQuote(quote)} title="Duplicate">
                          <Copy className="w-4 h-4" />
                        </Button>

                        <Button className={BTN_WARNING} size="icon" onClick={() => openEdit(quote)} title="Edit">
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Button
                          size="icon"
                          className={BTN_DANGER}
                          onClick={() => deleteQuotation.mutate(quote)}
                          disabled={deleteQuotation.isPending}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-3xl border bg-card px-4 py-3 shadow-sm">
              <p className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    variant={n === currentPage ? "default" : "ghost"}
                    size="icon"
                    className={`h-8 w-8 text-xs ${n === currentPage ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Dialog open={!!viewQuote} onOpenChange={() => setViewQuote(null)}>
          <DialogContent className="max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                {viewQuote?.quotation_no}
              </DialogTitle>
              <DialogDescription>
                {viewQuote ? `${viewQuote.customer_name} · ${formatDateTime(getQuoteDate(viewQuote))}` : "Quotation details"}
              </DialogDescription>
            </DialogHeader>

            {viewQuote && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-2.5">
                    <p className="text-xs text-blue-700">Customer</p>
                    <p className="font-medium truncate">{viewQuote.customer_name}</p>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-2.5">
                    <p className="text-xs text-orange-700">Status</p>
                    <Badge variant="outline" className={`rounded-full capitalize ${statusClass(getQuoteStatus(viewQuote))}`}>
                      {getQuoteStatus(viewQuote)}
                    </Badge>
                  </div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-2.5">
                    <p className="text-xs text-violet-700">Valid Until</p>
                    <p className="font-medium">{formatDate(viewQuote.valid_until)}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5">
                    <p className="text-xs text-emerald-700">Total</p>
                    <p className="font-bold font-data">{formatCurrency(safeNumber(viewQuote.total))}</p>
                  </div>
                </div>

                <div className="rounded-2xl border overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground uppercase">
                    <div className="col-span-6">Item</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  {(viewQuote.items || []).map((item, i) => (
                    <div key={`${item.product_name}-${i}`} className="grid grid-cols-12 gap-2 border-t px-4 py-3 text-sm">
                      <div className="col-span-6">{item.product_name}</div>
                      <div className="col-span-2 text-center font-data">{item.quantity}</div>
                      <div className="col-span-2 text-right font-data">{formatCurrency(item.unit_price)}</div>
                      <div className="col-span-2 text-right font-data font-semibold">{formatCurrency(item.total)}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-data">{formatCurrency(safeNumber(viewQuote.subtotal))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax 16%</span>
                    <span className="font-data">{formatCurrency(safeNumber(viewQuote.tax))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-data">-{formatCurrency(safeNumber(viewQuote.discount))}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total</span>
                    <span className="font-data">{formatCurrency(safeNumber(viewQuote.total))}</span>
                  </div>
                </div>

                {viewQuote.notes && (
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm mt-1">{viewQuote.notes}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button className={BTN_INFO} onClick={() => printQuotation(viewQuote)}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button className={BTN_PURPLE} onClick={() => downloadQuotation(viewQuote)}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={() => setViewQuote(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Quotation" : "New Quotation"}</DialogTitle>
              <DialogDescription>
                Build a professional quotation with products, pricing, tax, and validity.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <Input
                placeholder="Customer name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-xl border-blue-500/20 bg-blue-500/5 placeholder:text-blue-700/70"
              />

              <Input
                placeholder="Customer email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="rounded-xl border-blue-500/20 bg-blue-500/5 placeholder:text-blue-700/70"
              />

              <Input
                placeholder="Customer phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="rounded-xl border-blue-500/20 bg-blue-500/5 placeholder:text-blue-700/70"
              />

              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="rounded-xl border-blue-500/20 bg-blue-500/5 placeholder:text-blue-700/70"
              />

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl border-blue-500/20 bg-blue-500/5 placeholder:text-blue-700/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="Discount"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="rounded-xl border-blue-500/20 bg-blue-500/5 placeholder:text-blue-700/70"
              />
            </div>

            <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 mb-3">
                <h3 className="font-semibold">Quotation Items</h3>

                <Select onValueChange={addItemFromProduct}>
                  <SelectTrigger className="w-full sm:w-72 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                    <SelectValue placeholder="Add product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {formatCurrency(safeNumber(p.selling_price ?? p.price))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-8 text-center text-emerald-800">
                    <Package className="w-10 h-10 mx-auto mb-2" />
                    <p className="font-semibold">No products selected</p>
                    <p className="mt-1 text-xs text-emerald-800/80">Choose products above to build a priced customer proposal.</p>
                  </div>
                ) : (
                  items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-12 md:col-span-5 rounded-xl"
                        value={item.product_name}
                        onChange={(e) => updateItem(i, "product_name", e.target.value)}
                      />

                      <Input
                        className="col-span-3 md:col-span-2 rounded-xl"
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", safeNumber(e.target.value))}
                      />

                      <Input
                        className="col-span-4 md:col-span-2 rounded-xl"
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(i, "unit_price", safeNumber(e.target.value))}
                      />

                      <p className="col-span-4 md:col-span-2 text-right font-data">
                        {formatCurrency(item.total)}
                      </p>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="col-span-1 text-destructive"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-white border border-emerald-200 p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Tax 16%</span>
                  <span>{formatCurrency(tax)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountValue)}</span>
                </div>

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <Input
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl mt-4 border-violet-500/20 bg-violet-500/5 placeholder:text-violet-700/70"
            />

            {offlineModeActive && (
              <div className="rounded-2xl border bg-amber-500/10 p-2.5 text-sm text-amber-700">
                This quotation will be saved locally and synced when online login returns.
              </div>
            )}

            <DialogFooter>
              <Button className={BTN_WARNING} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>

              <Button
                onClick={() => saveQuotation.mutate()}
                disabled={saveQuotation.isPending}
                className={BTN_PRIMARY}
              >
                {saveQuotation.isPending ? "Saving..." : editing ? "Update Quotation" : "Save Quotation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}