import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import { useSuppliers, type DbSupplier } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedTable, isNetworkError, isOnline, saveCachedTable, saveOfflineSupplier, savePending, upsertCachedRecord, patchCachedRecord, removeCachedRecord } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Truck, Plus, Search, MoreHorizontal, Pencil, Trash2, Phone, Mail, Wallet, CheckCircle2, XCircle, MapPin, Layers3, ShieldCheck, Wifi, WifiOff, Database, UploadCloud, RotateCcw, Download, Eye, Copy, BarChart3, TrendingUp, AlertTriangle, Activity, Gauge, ClipboardCheck, FileText, Receipt, RefreshCcw, Archive, List, Grid3X3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/currency";
import warehouseBg from "@/assets/bg-warehouse.jpg";

const PAGE_SIZE = 18;
const BTN_PRIMARY =
  "bg-blue-600 hover:bg-blue-700 text-white border-blue-600";

const BTN_INFO =
  "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100";

const BTN_SUCCESS =
  "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";

const BTN_WARNING =
  "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100";

const BTN_DANGER =
  "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";

const emptySupplier = {
  code: "",
  name: "",
  email: "",
  phone: "",
  contact_person: "",
  address: "",
  city: "",
  country: "Rwanda",
  tax_number: "",
  payment_terms: "Immediate",
  status: "active",
  notes: null as string | null,
  total_purchases: 0,
  outstanding_balance: 0,
};

type ViewMode = "grid" | "list" | "compact";
type SmartFilter =
  | "all"
  | "active"
  | "inactive"
  | "with_balance"
  | "no_contact"
  | "no_tax"
  | "top_spend"
  | "pending";

type SortKey =
  | "created_at"
  | "name"
  | "code"
  | "total_purchases"
  | "outstanding_balance"
  | "payment_terms"
  | "status"
  | "health";

const supplierStatusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  inactive: "bg-orange-50 text-orange-700 border-orange-200",
  blocked: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  deleted: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  pending: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  pending_update: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  pending_delete: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

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

function nowIso() {
  return new Date().toISOString();
}

function compactCurrency(value: number) {
  if (Math.abs(value) < 1_000_000) return formatCurrency(value);
  return `RF ${new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function shouldSaveOffline(error: unknown) {
  return !isOnline() || isNetworkError(error);
}

function isPendingSync(row: any) {
  const status = String(row?.sync_status || "").toLowerCase();
  return (
    String(row?.id || "").startsWith("offline-") ||
    String(row?.id || "").startsWith("offline-supplier-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    status.includes("pending")
  );
}

function isPendingDelete(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function getSupplierDate(supplier: any) {
  return (
    supplier?.updated_offline_at ||
    supplier?.updated_at ||
    supplier?.created_offline_at ||
    supplier?.created_at ||
    new Date().toISOString()
  );
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

function supplierAgeDays(supplier: any) {
  const date = new Date(supplier?.created_offline_at || supplier?.created_at || 0);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
}

function getSupplierHealth(supplier: any) {
  let score = 100;

  if (!supplier.name) score -= 20;
  if (!supplier.code) score -= 15;
  if (!supplier.phone && !supplier.email) score -= 18;
  if (!supplier.contact_person) score -= 8;
  if (!supplier.address && !supplier.city) score -= 8;
  if (!supplier.tax_number) score -= 10;
  if (!supplier.payment_terms) score -= 5;
  if (safeNumber(supplier.outstanding_balance) > 0) score -= 8;
  if (String(supplier.status || "").toLowerCase() !== "active") score -= 12;
  if (isPendingSync(supplier)) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function getSupplierHealthLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Review";
  return "Critical";
}

function normalizeSupplierPayload(form: typeof emptySupplier) {
  return {
    code: String(form.code || "").trim(),
    name: String(form.name || "").trim(),
    email: String(form.email || "").trim() || null,
    phone: String(form.phone || "").trim() || null,
    contact_person: String(form.contact_person || "").trim() || null,
    address: String(form.address || "").trim() || null,
    city: String(form.city || "").trim() || null,
    country: String(form.country || "").trim() || null,
    tax_number: String(form.tax_number || "").trim() || null,
    payment_terms: form.payment_terms || "Immediate",
    status: form.status || "active",
    notes: form.notes || null,
    total_purchases: safeNumber(form.total_purchases),
    outstanding_balance: safeNumber(form.outstanding_balance),
  };
}

function dedupeSuppliers(suppliers: DbSupplier[]) {
  const map = new Map<string, DbSupplier>();

  for (const supplier of suppliers || []) {
    const key = String(
      supplier.id ||
        (supplier as any).offline_id ||
        supplier.code ||
        supplier.email ||
        supplier.phone ||
        supplier.name ||
        Math.random()
    );

    const existing = map.get(key);

    if (!existing) {
      map.set(key, supplier);
      continue;
    }

    const existingTime = new Date(getSupplierDate(existing)).getTime();
    const incomingTime = new Date(getSupplierDate(supplier)).getTime();

    map.set(
      key,
      incomingTime >= existingTime ? { ...existing, ...supplier } : { ...supplier, ...existing }
    );
  }

  return Array.from(map.values()).filter((supplier) => !isPendingDelete(supplier));
}

function matchesSupplierQuery(supplier: any, query: string) {
  if (!query) return true;

  const q = query.toLowerCase();

  return [
    supplier.name,
    supplier.code,
    supplier.email,
    supplier.phone,
    supplier.contact_person,
    supplier.address,
    supplier.city,
    supplier.country,
    supplier.tax_number,
    supplier.payment_terms,
    supplier.status,
    supplier.notes,
    supplier.total_purchases,
    supplier.outstanding_balance,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ")
    .includes(q);
}

export default function Suppliers() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();
  const { data: suppliers = [], isLoading } = useSuppliers();

  const [search, setSearch] = useState("");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [termsFilter, setTermsFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [viewSupplier, setViewSupplier] = useState<DbSupplier | null>(null);
  const [editing, setEditing] = useState<DbSupplier | null>(null);
  const [form, setForm] = useState(emptySupplier);
  const [bulkText, setBulkText] = useState("");
  const [deleteSupplier, setDeleteSupplier] = useState<DbSupplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const offlineModeActive = !isOnline() || isOfflineMode() || !session?.access_token;
  const cleanSuppliers = useMemo(() => dedupeSuppliers(suppliers as DbSupplier[]), [suppliers]);

  const uniqueCountries = useMemo(() => {
    const values = new Set<string>(["Rwanda"]);
    cleanSuppliers.forEach((supplier) => supplier.country && values.add(supplier.country));
    return [...values].filter(Boolean).sort();
  }, [cleanSuppliers]);

  const uniqueTerms = useMemo(() => {
    const values = new Set<string>(["Immediate", "7 days", "15 days", "30 days", "60 days", "90 days"]);
    cleanSuppliers.forEach((supplier) => supplier.payment_terms && values.add(supplier.payment_terms));
    return [...values].filter(Boolean);
  }, [cleanSuppliers]);

  const duplicateCodes = useMemo(() => {
    const map = new Map<string, number>();
    cleanSuppliers.forEach((supplier) => {
      const code = String(supplier.code || "").trim().toLowerCase();
      if (code) map.set(code, (map.get(code) || 0) + 1);
    });
    return new Set([...map.entries()].filter(([, count]) => count > 1).map(([code]) => code));
  }, [cleanSuppliers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = cleanSuppliers.filter((supplier: any) => {
      const pending = isPendingSync(supplier);
      const status = String(supplier.status || "active").toLowerCase();
      const health = getSupplierHealth(supplier);
      const outstanding = safeNumber(supplier.outstanding_balance);
      const totalPurchases = safeNumber(supplier.total_purchases);

      const matchesSmart =
        smartFilter === "all" ||
        (smartFilter === "active" && status === "active") ||
        (smartFilter === "inactive" && status !== "active") ||
        (smartFilter === "with_balance" && outstanding > 0) ||
        (smartFilter === "no_contact" && !supplier.phone && !supplier.email) ||
        (smartFilter === "no_tax" && !supplier.tax_number) ||
        (smartFilter === "top_spend" && totalPurchases > 0) ||
        (smartFilter === "pending" && pending) ||
        health >= 0;

      return (
        matchesSupplierQuery(supplier, q) &&
        matchesSmart &&
        (statusFilter === "all" || status === statusFilter) &&
        (termsFilter === "all" || supplier.payment_terms === termsFilter) &&
        (countryFilter === "all" || supplier.country === countryFilter) &&
        (syncFilter === "all" ||
          (syncFilter === "pending" && pending) ||
          (syncFilter === "synced" && !pending))
      );
    });

    list.sort((a: any, b: any) => {
      if (sortKey === "created_at") {
        const av = new Date(getSupplierDate(a)).getTime();
        const bv = new Date(getSupplierDate(b)).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "health") {
        return sortAsc
          ? getSupplierHealth(a) - getSupplierHealth(b)
          : getSupplierHealth(b) - getSupplierHealth(a);
      }

      const av = a[sortKey];
      const bv = b[sortKey];

      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      return sortAsc ? safeNumber(av) - safeNumber(bv) : safeNumber(bv) - safeNumber(av);
    });

    return list;
  }, [
    cleanSuppliers,
    search,
    smartFilter,
    statusFilter,
    termsFilter,
    countryFilter,
    syncFilter,
    sortKey,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const activeCount = cleanSuppliers.filter((s) => String(s.status || "active") === "active").length;
    const inactiveCount = cleanSuppliers.filter((s) => String(s.status || "active") !== "active").length;
    const totalOutstanding = cleanSuppliers.reduce((a, s) => a + safeNumber(s.outstanding_balance), 0);
    const totalPurchases = cleanSuppliers.reduce((a, s) => a + safeNumber(s.total_purchases), 0);
    const withContacts = cleanSuppliers.filter((s) => s.phone || s.email).length;
    const missingContacts = cleanSuppliers.filter((s) => !s.phone && !s.email).length;
    const missingTax = cleanSuppliers.filter((s) => !s.tax_number).length;
    const pendingSync = cleanSuppliers.filter(isPendingSync).length;
    const topSupplier = [...cleanSuppliers].sort((a, b) => safeNumber(b.total_purchases) - safeNumber(a.total_purchases))[0];
    const avgHealth = cleanSuppliers.length
      ? Math.round(cleanSuppliers.reduce((sum, s) => sum + getSupplierHealth(s), 0) / cleanSuppliers.length)
      : 0;
    const outstandingSuppliers = cleanSuppliers.filter((s) => safeNumber(s.outstanding_balance) > 0).length;
    const topSpendSuppliers = cleanSuppliers.filter((s) => safeNumber(s.total_purchases) > 0).length;

    return {
      activeCount,
      inactiveCount,
      totalOutstanding,
      totalPurchases,
      withContacts,
      missingContacts,
      missingTax,
      pendingSync,
      total: cleanSuppliers.length,
      avgHealth,
      outstandingSuppliers,
      topSpendSuppliers,
      topSupplier,
    };
  }, [cleanSuppliers]);

  const smartCards = [
  {
    key: "all",
    label: "All Suppliers",
    value: stats.total,
    icon: Truck,
    color: "border-blue-200 bg-blue-50 text-blue-800",
    iconBox: "bg-blue-600 text-white",
  },
  {
    key: "active",
    label: "Active",
    value: stats.activeCount,
    icon: CheckCircle2,
    color: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconBox: "bg-emerald-600 text-white",
  },
  {
    key: "inactive",
    label: "Inactive",
    value: stats.inactiveCount,
    icon: XCircle,
    color: "border-orange-200 bg-orange-50 text-orange-800",
    iconBox: "bg-orange-600 text-white",
  },
  {
    key: "with_balance",
    label: "Outstanding",
    value: stats.outstandingSuppliers,
    icon: Wallet,
    color: "border-rose-200 bg-rose-50 text-rose-800",
    iconBox: "bg-rose-600 text-white",
  },
  {
    key: "no_contact",
    label: "No Contact",
    value: stats.missingContacts,
    icon: Phone,
    color: "border-orange-200 bg-orange-50 text-orange-800",
    iconBox: "bg-orange-600 text-white",
  },
  {
    key: "no_tax",
    label: "No Tax Number",
    value: stats.missingTax,
    icon: FileText,
    color: "border-orange-200 bg-orange-50 text-orange-800",
    iconBox: "bg-orange-600 text-white",
  },
  {
    key: "top_spend",
    label: "Top Purchase",
    value: stats.topSpendSuppliers,
    icon: TrendingUp,
    color: "border-violet-200 bg-violet-50 text-violet-800",
    iconBox: "bg-violet-600 text-white",
  },
  {
    key: "pending",
    label: "Pending Sync",
    value: stats.pendingSync,
    icon: UploadCloud,
    color: "border-cyan-200 bg-cyan-50 text-cyan-800",
    iconBox: "bg-cyan-600 text-white",
  },
];

  const topSummaryCards = [
    {
      label: "Total Suppliers",
      value: stats.total,
      helper: "Supplier profiles",
      icon: Truck,
      color: "bg-emerald-600 text-white border-emerald-600",
    },
    {
      label: "Purchase Value",
      value: compactCurrency(stats.totalPurchases),
      helper: "purchase history",
      icon: Receipt,
      color: "bg-amber-500 text-white border-amber-500",
    },
    {
      label: "Outstanding",
      value: compactCurrency(stats.totalOutstanding),
      helper: "supplier balance",
      icon: Wallet,
      color: "bg-rose-500 text-white border-rose-500",
    },
    {
      label: "Supplier Health",
      value: `${stats.avgHealth}%`,
      helper: getSupplierHealthLabel(stats.avgHealth),
      icon: Gauge,
      color: "bg-violet-500 text-white border-violet-500",
    },
  ];

  const exportRows = filtered.map((s: any) => ({
    code: s.code || "",
    name: s.name || "",
    email: s.email || "",
    phone: s.phone || "",
    contact_person: s.contact_person || "",
    city: s.city || "",
    country: s.country || "",
    tax_number: s.tax_number || "",
    payment_terms: s.payment_terms || "",
    status: s.status || "",
    total_purchases: formatCurrency(safeNumber(s.total_purchases)),
    outstanding_balance: formatCurrency(safeNumber(s.outstanding_balance)),
    sync_status: isPendingSync(s) ? "Pending" : "Synced",
    health: `${getSupplierHealth(s)}%`,
    created_at: formatDateTime(getSupplierDate(s)),
  }));

  const exportCols = [
    { key: "code" as const, label: "Code" },
    { key: "name" as const, label: "Name" },
    { key: "email" as const, label: "Email" },
    { key: "phone" as const, label: "Phone" },
    { key: "contact_person" as const, label: "Contact Person" },
    { key: "city" as const, label: "City" },
    { key: "country" as const, label: "Country" },
    { key: "tax_number" as const, label: "Tax Number" },
    { key: "payment_terms" as const, label: "Payment Terms" },
    { key: "status" as const, label: "Status" },
    { key: "total_purchases" as const, label: "Total Purchases" },
    { key: "outstanding_balance" as const, label: "Outstanding" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "health" as const, label: "Health" },
    { key: "created_at" as const, label: "Created At" },
  ];

  const refreshSuppliers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
      queryClient.invalidateQueries({ queryKey: ["purchases"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const resetFilters = () => {
    setSearch("");
    setSmartFilter("all");
    setStatusFilter("all");
    setSyncFilter("all");
    setTermsFilter("all");
    setCountryFilter("all");
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    const nextCode = `SUP-${String(cleanSuppliers.length + 1).padStart(4, "0")}`;
    setForm({ ...emptySupplier, code: nextCode });
    setDialogOpen(true);
  };

  const openEdit = (supplier: DbSupplier) => {
    setEditing(supplier);
    setForm({
      code: supplier.code || "",
      name: supplier.name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      contact_person: supplier.contact_person || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "Rwanda",
      tax_number: supplier.tax_number || "",
      payment_terms: supplier.payment_terms || "Immediate",
      status: supplier.status || "active",
      notes: supplier.notes,
      total_purchases: safeNumber(supplier.total_purchases),
      outstanding_balance: safeNumber(supplier.outstanding_balance),
    });
    setDialogOpen(true);
  };

  const duplicateSupplier = (supplier: DbSupplier) => {
    setEditing(null);
    setForm({
      code: `${supplier.code || "SUP"}-COPY-${Date.now().toString().slice(-4)}`,
      name: `${supplier.name || "Supplier"} Copy`,
      email: "",
      phone: supplier.phone || "",
      contact_person: supplier.contact_person || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "Rwanda",
      tax_number: "",
      payment_terms: supplier.payment_terms || "Immediate",
      status: "active",
      notes: supplier.notes || null,
      total_purchases: 0,
      outstanding_balance: 0,
    });
    setDialogOpen(true);
    toast.info("Supplier duplicated. Review code, email, and tax number before saving.");
  };

  const validateSupplier = () => {
    if (!form.name.trim() || !form.code.trim()) return "Name and code are required";

    const code = String(form.code || "").trim().toLowerCase();
    const codeExists = cleanSuppliers.some(
      (supplier) =>
        String(supplier.id) !== String(editing?.id) &&
        String(supplier.code || "").trim().toLowerCase() === code
    );

    if (codeExists) return "Another supplier already uses this code";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return "Enter a valid supplier email address";
    }

    return null;
  };

  const saveSupplierOffline = async (payload: any) => {
    const timestamp = nowIso();
    const cached = await getCachedTable("suppliers");
    const cachedRows = Array.isArray(cached) ? cached : [];

    if (editing) {
      const isOfflineSupplier =
        String(editing.id || "").startsWith("offline-") ||
        String(editing.id || "").startsWith("offline-supplier-") ||
        !!(editing as any).offline_id;

      const updatedSupplier = {
        ...editing,
        ...payload,
        id: editing.id,
        tenant_id: (editing as any).tenant_id || tenantId || null,
        user_id: (editing as any).user_id || user?.id || null,
        offline_id: (editing as any).offline_id || (isOfflineSupplier ? editing.id : null),
        operation: isOfflineSupplier ? "create" : "update",
        sync_status: isOfflineSupplier ? "pending" : "pending_update",
        updated_at: timestamp,
        updated_offline_at: timestamp,
      };

      const exists = cachedRows.some((s: any) => String(s.id) === String(editing.id));

      const nextRows = exists
        ? cachedRows.map((s: any) => (String(s.id) === String(editing.id) ? updatedSupplier : s))
        : [updatedSupplier, ...cachedRows];

      await saveCachedTable("suppliers", dedupeSuppliers(nextRows as any) as any);
      await saveOfflineSupplier(updatedSupplier);
      await savePending("suppliers", updatedSupplier as any);

      return updatedSupplier;
    }

    const offlineSupplier = {
      ...payload,
      id: makeLocalId("offline-supplier"),
      tenant_id: tenantId || null,
      user_id: user?.id || null,
      offline_id: null,
      operation: "create",
      sync_status: "pending",
      created_at: timestamp,
      updated_at: timestamp,
      created_offline_at: timestamp,
      updated_offline_at: timestamp,
    };

    await saveOfflineSupplier(offlineSupplier);
    await upsertCachedRecord("suppliers", offlineSupplier);
    await savePending("suppliers", offlineSupplier as any);

    return offlineSupplier;
  };

  const handleSave = async () => {
    if (!user?.id || !tenantId) {
      toast.error("No active user or workspace found");
      return;
    }

    const validationError = validateSupplier();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      user_id: user.id,
      ...normalizeSupplierPayload(form),
    };

    try {
      if (offlineModeActive) {
        await saveSupplierOffline(payload);
        toast.success(editing ? "Supplier update saved offline" : "Supplier saved offline. It will sync later.");
      } else if (editing) {
        const isOfflineSupplier =
          String(editing.id || "").startsWith("offline-") ||
          String(editing.id || "").startsWith("offline-supplier-") ||
          !!(editing as any).offline_id;

        if (isOfflineSupplier) {
          await saveSupplierOffline(payload);
          toast.success("Offline supplier updated locally.");
        } else {
          try {
            const { error } = await (supabase as any)
              .from("suppliers")
              .update({
                ...payload,
                updated_at: nowIso(),
                sync_status: "synced",
              })
              .eq("id", editing.id)
              .eq("tenant_id", tenantId);

            if (error) throw error;

            await patchCachedRecord("suppliers", editing.id, {
              ...payload,
              sync_status: "synced",
              updated_at: nowIso(),
            });

            toast.success("Supplier updated");
          } catch (error) {
            if (shouldSaveOffline(error)) {
              await saveSupplierOffline(payload);
              toast.success("Supplier update saved offline");
            } else {
              throw error;
            }
          }
        }
      } else {
        try {
          const { data, error } = await (supabase as any)
            .from("suppliers")
            .insert({
              ...payload,
              created_at: nowIso(),
              updated_at: nowIso(),
              sync_status: "synced",
            })
            .select()
            .single();

          if (error) throw error;

          if (data) await upsertCachedRecord("suppliers", data);
          toast.success("Supplier added");
        } catch (error) {
          if (shouldSaveOffline(error)) {
            await saveSupplierOffline(payload);
            toast.success("Supplier saved offline. It will sync when internet returns.");
          } else {
            throw error;
          }
        }
      }

      setDialogOpen(false);
      setEditing(null);
      await refreshSuppliers();
    } catch (error: any) {
      console.error("Supplier save failed:", error);
      toast.error(
        error?.message ||
          error?.details ||
          error?.hint ||
          error?.code ||
          "Failed to save supplier"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSupplier || !tenantId) return;

    const supplier = deleteSupplier;
    setDeleting(true);

    try {
      const isOfflineSupplier =
        String(supplier.id || "").startsWith("offline-") ||
        String(supplier.id || "").startsWith("offline-supplier-") ||
        !!(supplier as any).offline_id;

      if (offlineModeActive || isOfflineSupplier) {
        if (isOfflineSupplier) {
          await removeCachedRecord("suppliers", supplier.id);
          toast.success("Offline supplier removed locally");
        } else {
          const deleted = {
            ...supplier,
            operation: "delete",
            sync_status: "pending_delete",
            status: "deleted",
            updated_offline_at: nowIso(),
          };

          await savePending("suppliers", deleted as any);
          await patchCachedRecord("suppliers", supplier.id, deleted);
          toast.success("Supplier deletion saved offline. It will sync later.");
        }
      } else {
        try {
          const { error } = await (supabase as any)
            .from("suppliers")
            .delete()
            .eq("id", supplier.id)
            .eq("tenant_id", tenantId);

          if (error) throw error;

          await removeCachedRecord("suppliers", supplier.id);
          toast.success("Supplier deleted");
        } catch (error) {
          if (shouldSaveOffline(error)) {
            const deleted = {
              ...supplier,
              operation: "delete",
              sync_status: "pending_delete",
              status: "deleted",
              updated_offline_at: nowIso(),
            };

            await savePending("suppliers", deleted as any);
            await patchCachedRecord("suppliers", supplier.id, deleted);
            toast.success("Network failed. Supplier deletion saved offline.");
          } else {
            throw error;
          }
        }
      }

      setDeleteSupplier(null);
      await refreshSuppliers();
    } catch (error: any) {
      console.error("Supplier delete failed:", error);
      toast.error(error?.message || "Failed to delete supplier");
    } finally {
      setDeleting(false);
    }
  };

  const bulkCreateSuppliers = async () => {
    const rows = bulkText
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean);

    if (!rows.length) {
      toast.error("Paste at least one supplier row.");
      return;
    }

    const parsedRows = rows.map((row, index) => {
      const [name, code, phone, email, contact, city, country, tax, terms] = row
        .split(",")
        .map((value) => value?.trim());

      return {
        tenant_id: tenantId,
        user_id: user?.id || null,
        code: code || `SUP-${Date.now()}-${index}`,
        name: name || "Unnamed Supplier",
        phone: phone || null,
        email: email || null,
        contact_person: contact || null,
        city: city || null,
        country: country || "Rwanda",
        tax_number: tax || null,
        payment_terms: terms || "Immediate",
        status: "active",
        notes: null,
        total_purchases: 0,
        outstanding_balance: 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
    });

    try {
      if (offlineModeActive) {
        for (const payload of parsedRows) {
          await saveSupplierOffline(payload);
        }
        toast.success(`${parsedRows.length} suppliers imported offline.`);
      } else {
        const { error } = await (supabase as any).from("suppliers").insert(
          parsedRows.map((row) => ({
            ...row,
            sync_status: "synced",
          }))
        );

        if (error) throw error;
        toast.success(`${parsedRows.length} suppliers imported successfully.`);
      }

      setBulkDialogOpen(false);
      setBulkText("");
      await refreshSuppliers();
    } catch (error: any) {
      toast.error(error?.message || "Bulk import failed");
    }
  };

  const statusClass = (status: string) => {
    const key = String(status || "active").toLowerCase();
    return supplierStatusColors[key] || supplierStatusColors.inactive;
  };

  const SupplierMenu = ({ supplier }: { supplier: DbSupplier }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-xl">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewSupplier(supplier)}>
          <Eye className="w-4 h-4 mr-2" />
          View
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => openEdit(supplier)}>
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => duplicateSupplier(supplier)}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-destructive"
          onClick={() => setDeleteSupplier(supplier)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const SupplierCard = ({ supplier }: { supplier: DbSupplier }) => {
    const health = getSupplierHealth(supplier);
    const pending = isPendingSync(supplier);
    const hasDuplicateCode = duplicateCodes.has(String(supplier.code || "").trim().toLowerCase());

    return (
      <div className="rounded-3xl border border-blue-100 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-14 h-14 rounded-3xl bg-blue-600 text-white flex items-center justify-center font-semibold text-lg shrink-0"
              >
                {(supplier.name || "S").charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setViewSupplier(supplier)}
                  className="font-semibold text-base truncate block max-w-[220px] hover:text-primary"
                >
                  {supplier.name}
                </button>
                <p className="font-data text-xs text-muted-foreground">{supplier.code}</p>
                {supplier.contact_person && (
                  <p className="text-xs text-muted-foreground truncate">{supplier.contact_person}</p>
                )}
              </div>
            </div>

            <SupplierMenu supplier={supplier} />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline" className={`rounded-full ${statusClass(supplier.status || "active")}`}>
              {supplier.status === "active" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              {supplier.status || "active"}
            </Badge>

            {pending && (
              <Badge variant="outline" className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30">
                <UploadCloud className="w-3 h-3 mr-1" />
                Pending
              </Badge>
            )}

            {hasDuplicateCode && (
              <Badge variant="outline" className="rounded-full bg-orange-500/10 text-orange-600 border-orange-500/30">
                Duplicate Code
              </Badge>
            )}

            <Badge variant="secondary" className="rounded-full text-xs font-normal">
              {supplier.payment_terms || "Immediate"}
            </Badge>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-3.5 h-3.5" />
              <span className="truncate">{supplier.phone || "No phone"}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate">{supplier.email || "No email"}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">
                {[supplier.city, supplier.country].filter(Boolean).join(", ") || "No location"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
              <p className="text-[11px] text-muted-foreground">Purchases</p>
              <p className="font-data font-semibold text-sm mt-1">
                {compactCurrency(safeNumber(supplier.total_purchases))}
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
              <p className="text-[11px] text-muted-foreground">Outstanding</p>
              <p
                className={`font-data font-semibold text-sm mt-1 ${
                  safeNumber(supplier.outstanding_balance) > 0 ? "text-rose-600" : ""
                }`}
              >
                {compactCurrency(safeNumber(supplier.outstanding_balance))}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Supplier Health</span>
              <span>{health}%</span>
            </div>
            <Progress value={health} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="outline" size="sm" className={`rounded-xl ${BTN_INFO}`} onClick={() => setViewSupplier(supplier)}>
              <Eye className="w-3.5 h-3.5 mr-1" />
              View
            </Button>

            <Button variant="outline" size="sm" className="rounded-xl border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100" onClick={() => openEdit(supplier)}>
              <Pencil className="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageBackground image={warehouseBg} opacity={0.035}>
      <PageShell
        title="Suppliers"
        description="Supplier directory, procurement records, balances, contacts, compliance checks, and offline supplier management."
      >
        <div className="space-y-6">
          {(offlineModeActive || stats.pendingSync > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "Suppliers are using cached offline data" : "Supplier changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending supplier records: {stats.pendingSync}. Purchases, Products, Dashboard, and Reports refresh after sync.
                    </p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Truck className="w-7 h-7" />
                </div>

                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-600 text-white border-blue-600 mb-3">
                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                    Supplier Control Center
                  </Badge>

                  <h2 className="text-2xl font-bold tracking-tight">
                    Supplier Management Center
                  </h2>

                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Manage supplier contacts, payment terms, balances, tax records, purchase history,
                    offline supplier edits, and supplier performance controls from one workspace.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                      <p className="text-xs font-medium text-emerald-700">With Contacts</p>
                      <p className="text-sm font-semibold font-data">{stats.withContacts}</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-orange-800">
                      <p className="text-xs font-medium text-orange-700">Missing Contacts</p>
                      <p className="text-sm font-semibold font-data">{stats.missingContacts}</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-violet-800">
                      <p className="text-xs font-medium text-violet-700">Top Supplier</p>
                      <p className="text-sm font-semibold truncate">{stats.topSupplier?.name || "—"}</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-cyan-800">
                      <p className="text-xs font-medium text-cyan-700">Filtered</p>
                      <p className="text-sm font-semibold font-data">{filtered.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 gap-3">
              {topSummaryCards.map((item) => {
                const Icon = item.icon;
                const valueClass =
                  String(item.value).length > 14
                    ? "text-base xl:text-lg break-words max-w-full"
                    : "text-2xl";

                return (
                  <div key={item.label} className={`rounded-3xl border shadow-sm p-4 ${item.color}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">{item.label}</p>
                        <p className={`${valueClass} font-bold font-data mt-1`}>{item.value}</p>
                        <p className="text-[11px] opacity-70 truncate">{item.helper}</p>
                      </div>

                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {smartCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  setSmartFilter(card.key as SmartFilter);
                  setPage(1);
                }}
                className={`rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.color} ${
                  smartFilter === card.key ? "ring-2 ring-blue-600" : ""
                }`}
              >
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${card.iconBox}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold opacity-80">{card.label}</p>
                <p className="font-data text-xl font-black">{card.value}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Supplier Health</h3>
                  <p className="text-xs text-muted-foreground">Completeness and risk signals</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Health Score", value: `${stats.avgHealth}%`, icon: Gauge, tone: "bg-blue-500/10 text-blue-700" },
                  { label: "Missing Contacts", value: stats.missingContacts, icon: Phone, tone: "bg-orange-500/10 text-orange-700" },
                  { label: "Missing Tax No.", value: stats.missingTax, icon: FileText, tone: "bg-amber-500/10 text-amber-700" },
                  { label: "Inactive", value: stats.inactiveCount, icon: Archive, tone: "bg-orange-50 text-orange-700 border border-orange-200" },
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

            <div className="xl:col-span-4 rounded-3xl border border-emerald-200 bg-emerald-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Procurement Financials</h3>
                  <p className="text-xs text-muted-foreground">Purchases and payable exposure</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Outstanding vs Purchases</span>
                    <span className="font-data">
                      {stats.totalPurchases > 0
                        ? Math.round((stats.totalOutstanding / stats.totalPurchases) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      stats.totalPurchases > 0
                        ? Math.min(100, (stats.totalOutstanding / stats.totalPurchases) * 100)
                        : 0
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                    <p className="text-xs text-muted-foreground">Purchases</p>
                    <p className="font-data font-bold">{compactCurrency(stats.totalPurchases)}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="font-data font-bold text-rose-600">{compactCurrency(stats.totalOutstanding)}</p>
                  </div>
                  <div className="col-span-2 rounded-2xl bg-emerald-500/10 p-3 text-emerald-700">
                    <p className="text-xs">Purchase Suppliers</p>
                    <p className="font-data font-bold">{stats.topSpendSuppliers}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-orange-200 bg-orange-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Operational Signals</h3>
                  <p className="text-xs text-muted-foreground">Supplier network attention areas</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "With Balance", value: stats.outstandingSuppliers, icon: Wallet },
                  { label: "No Contact", value: stats.missingContacts, icon: AlertTriangle },
                  { label: "No Tax No.", value: stats.missingTax, icon: FileText },
                  { label: "Pending Sync", value: stats.pendingSync, icon: UploadCloud },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-orange-200 bg-white p-3 text-center">
                    <item.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-data font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-blue-200 bg-blue-50 p-4 lg:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">Supplier Directory</h2>
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
                    Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} suppliers
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ExportMenu
                    onCSV={() => exportToCSV(exportRows, "suppliers", exportCols)}
                    onPDF={() =>
                      exportToPDF(exportRows, "suppliers", "Suppliers Enterprise Report", exportCols, {
                        subtitle: `${filtered.length} supplier records`,
                        summary: [
                          { label: "Total Suppliers", value: String(stats.total) },
                          { label: "Active", value: String(stats.activeCount) },
                          { label: "Total Purchases", value: formatCurrency(stats.totalPurchases) },
                          { label: "Outstanding", value: formatCurrency(stats.totalOutstanding) },
                          { label: "Pending Sync", value: String(stats.pendingSync) },
                        ],
                      })
                    }
                  />

                  <Button variant="outline" className={`rounded-2xl h-10 ${BTN_INFO}`} onClick={() => setBulkDialogOpen(true)}>
                    <Download className="w-4 h-4 mr-2" />
                    Bulk Import
                  </Button>

                  <Button variant="outline" className="rounded-2xl h-10 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={refreshSuppliers}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>

                  <div className="flex rounded-2xl border bg-blue-50 p-1">
                    {[
                      { key: "grid" as ViewMode, label: "Grid", icon: Grid3X3 },
                      { key: "list" as ViewMode, label: "List", icon: List },
                      { key: "compact" as ViewMode, label: "Compact", icon: Layers3 },
                    ].map((mode) => (
                      <Button
                        key={mode.key}
                        type="button"
                        size="sm"
                        variant={viewMode === mode.key ? "default" : "ghost"}
                        className={`rounded-xl h-8 px-3 ${viewMode === mode.key ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                        onClick={() => setViewMode(mode.key)}
                      >
                        <mode.icon className="w-4 h-4 mr-1.5" />
                        {mode.label}
                      </Button>
                    ))}
                  </div>

                  <Button onClick={openCreate} className={`h-10 rounded-2xl ${BTN_PRIMARY}`}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Supplier
                  </Button>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers by name, code, email, phone, contact, city, tax number, balance..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="h-11 rounded-2xl border-blue-200 bg-blue-50/70 pl-10 placeholder:text-blue-700/60"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[135px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={termsFilter} onValueChange={(v) => { setTermsFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[145px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Terms</SelectItem>
                      {uniqueTerms.map((term) => <SelectItem key={term} value={term}>{term}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[145px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {uniqueCountries.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={syncFilter} onValueChange={(v) => { setSyncFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[130px] h-11 rounded-2xl text-xs">
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
                      const [key, direction] = v.split(":") as [SortKey, "asc" | "desc"];
                      setSortKey(key);
                      setSortAsc(direction === "asc");
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[170px] h-11 rounded-2xl text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at:desc">Newest</SelectItem>
                      <SelectItem value="name:asc">Name A-Z</SelectItem>
                      <SelectItem value="name:desc">Name Z-A</SelectItem>
                      <SelectItem value="total_purchases:desc">Top Purchases</SelectItem>
                      <SelectItem value="outstanding_balance:desc">Highest Balance</SelectItem>
                      <SelectItem value="health:desc">Best Health</SelectItem>
                      <SelectItem value="health:asc">Needs Review</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" className="h-11 rounded-2xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100" onClick={resetFilters}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 lg:p-5">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-64 rounded-3xl" />
                  ))}
                </div>
              ) : paged.length === 0 ? (
                <div className="rounded-3xl border border-blue-200 bg-blue-50 text-center py-16 text-blue-800">
                  <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  No suppliers found
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {paged.map((supplier) => (
                    <SupplierCard key={supplier.id} supplier={supplier} />
                  ))}
                </div>
              ) : viewMode === "list" ? (
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[1180px] text-sm">
                    <thead className="bg-blue-50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Supplier</th>
                        <th className="px-4 py-3 text-left font-medium">Contact</th>
                        <th className="px-4 py-3 text-left font-medium">Location</th>
                        <th className="px-4 py-3 text-left font-medium">Tax No.</th>
                        <th className="px-4 py-3 text-left font-medium">Terms</th>
                        <th className="px-4 py-3 text-left font-medium">Purchases</th>
                        <th className="px-4 py-3 text-left font-medium">Outstanding</th>
                        <th className="px-4 py-3 text-left font-medium">Health</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Sync</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {paged.map((supplier: any) => {
                        const health = getSupplierHealth(supplier);
                        const pending = isPendingSync(supplier);

                        return (
                          <tr key={supplier.id} className="hover:bg-blue-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                                  {(supplier.name || "S").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <button type="button" onClick={() => setViewSupplier(supplier)} className="font-semibold hover:text-primary truncate block max-w-[240px]">
                                    {supplier.name}
                                  </button>
                                  <p className="font-data text-xs text-muted-foreground">{supplier.code}</p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="text-xs">
                                <p>{supplier.contact_person || "—"}</p>
                                <p className="text-muted-foreground">{supplier.phone || supplier.email || "No contact"}</p>
                              </div>
                            </td>

                            <td className="px-4 py-3">{[supplier.city, supplier.country].filter(Boolean).join(", ") || "—"}</td>
                            <td className="px-4 py-3 font-data text-xs">{supplier.tax_number || "—"}</td>
                            <td className="px-4 py-3">{supplier.payment_terms || "Immediate"}</td>
                            <td className="px-4 py-3 font-data">{formatCurrency(safeNumber(supplier.total_purchases))}</td>
                            <td className={`px-4 py-3 font-data ${safeNumber(supplier.outstanding_balance) > 0 ? "text-rose-600" : ""}`}>{formatCurrency(safeNumber(supplier.outstanding_balance))}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 overflow-hidden rounded-full bg-blue-100">
                                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${health}%` }} />
                                </div>
                                <span className="text-xs">{health}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`rounded-full text-xs ${statusClass(supplier.status || "active")}`}>
                                {supplier.status || "active"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`rounded-full text-xs ${pending ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}`}>
                                {pending ? "Pending" : "Synced"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end">
                                <SupplierMenu supplier={supplier} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {paged.map((supplier: any) => (
                    <div key={supplier.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                          {(supplier.name || "S").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{supplier.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{supplier.code} · {supplier.phone || supplier.email || "No contact"}</p>
                        </div>
                        <SupplierMenu supplier={supplier} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <Badge variant="outline" className={`rounded-full ${statusClass(supplier.status || "active")}`}>
                          {supplier.status || "active"}
                        </Badge>
                        <span className="font-data">{compactCurrency(safeNumber(supplier.outstanding_balance))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t px-4 lg:px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages} · {filtered.length} suppliers
              </p>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  <span className="sr-only">Previous</span>
                  ‹
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                  .map((n, index, arr) => {
                    const previous = arr[index - 1];
                    const showDots = previous && n - previous > 1;

                    return (
                      <div key={n} className="flex items-center gap-1">
                        {showDots && <span className="px-2 text-xs text-muted-foreground">...</span>}
                        <Button
                          variant={n === currentPage ? "default" : "outline"}
                          size="icon"
                          className={`h-9 w-9 rounded-xl text-xs ${n === currentPage ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </Button>
                      </div>
                    );
                  })}

                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                  <span className="sr-only">Next</span>
                  ›
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
              <DialogDescription>
                Create a supplier profile with contact details, payment terms, tax information, and supplier health controls.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-4 lg:grid-cols-[220px_1fr]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
                  <div className="h-32 w-full rounded-2xl border border-blue-200 bg-blue-600 flex items-center justify-center text-white text-4xl font-black">
                    {(form.name || "S").charAt(0).toUpperCase()}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground">Supplier Health</p>
                    <p className="text-2xl font-black">{getSupplierHealth(form)}%</p>
                    <Progress value={getSupplierHealth(form)} className="mt-2" />
                    <p className="mt-2 text-xs text-muted-foreground">{getSupplierHealthLabel(getSupplierHealth(form))}</p>
                  </div>
                </div>

                {offlineModeActive && (
                  <div className="rounded-2xl border bg-amber-500/10 p-3 text-sm text-amber-700">
                    Supplier changes will save locally and sync when internet returns.
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                  {form.code && duplicateCodes.has(String(form.code).trim().toLowerCase()) && String(editing?.code || "").trim().toLowerCase() !== String(form.code).trim().toLowerCase() && (
                    <p className="text-xs text-rose-600">This code is already used.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Contact Person</Label>
                  <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                </div>

                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                </div>

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                </div>

                <div className="space-y-2">
                  <Label>Tax Number / TIN</Label>
                  <Input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60" />
                </div>

                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select value={form.payment_terms} onValueChange={(value) => setForm({ ...form, payment_terms: value })}>
                    <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Immediate">Immediate</SelectItem>
                      <SelectItem value="7 days">Net 7</SelectItem>
                      <SelectItem value="15 days">Net 15</SelectItem>
                      <SelectItem value="30 days">Net 30</SelectItem>
                      <SelectItem value="60 days">Net 60</SelectItem>
                      <SelectItem value="90 days">Net 90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                    <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Total Purchases</Label>
                  <Input
                    type="number"
                    value={form.total_purchases}
                    onChange={(e) => setForm({ ...form, total_purchases: safeNumber(e.target.value) })}
                    className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Outstanding Balance</Label>
                  <Input
                    type="number"
                    value={form.outstanding_balance}
                    onChange={(e) => setForm({ ...form, outstanding_balance: safeNumber(e.target.value) })}
                    className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes ?? ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                    rows={3}
                    className="rounded-xl border-blue-200 bg-blue-50/40 placeholder:text-blue-700/60"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>

              <Button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Supplier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>Bulk Import Suppliers</DialogTitle>
              <DialogDescription>
                Paste one supplier per line using: name, code, phone, email, contact, city, country, tax number, payment terms
              </DialogDescription>
            </DialogHeader>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Kigali Wholesale, SUP-001, +250788000000, sales@example.com, John Doe, Kigali, Rwanda, 123456789, 30 days\nFresh Foods Ltd, SUP-002, +250788111111, info@fresh.rw, Jane, Kigali, Rwanda, 987654321, Immediate"}
              className="min-h-[220px] w-full rounded-2xl border bg-background p-4 text-sm outline-none"
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={bulkCreateSuppliers} className={BTN_PRIMARY}>
                Import Suppliers
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewSupplier} onOpenChange={() => setViewSupplier(null)}>
          <DialogContent className="max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{viewSupplier?.name}</DialogTitle>
              <DialogDescription>{viewSupplier?.code} · Supplier profile and procurement summary</DialogDescription>
            </DialogHeader>

            {viewSupplier && (
              <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
                <div className="space-y-4">
                  <div className="h-40 w-full rounded-3xl bg-blue-600 text-white flex items-center justify-center text-5xl font-black">
                    {(viewSupplier.name || "S").charAt(0).toUpperCase()}
                  </div>

                  <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs text-muted-foreground">Supplier Health</p>
                    <p className="text-2xl font-black">{getSupplierHealth(viewSupplier)}%</p>
                    <Progress value={getSupplierHealth(viewSupplier)} className="mt-2" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {getSupplierHealthLabel(getSupplierHealth(viewSupplier))}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`rounded-full ${statusClass(viewSupplier.status || "active")}`}>
                      {viewSupplier.status || "active"}
                    </Badge>
                    <Badge variant="outline" className={isPendingSync(viewSupplier) ? "rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30" : "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
                      {isPendingSync(viewSupplier) ? "Pending Sync" : "Synced"}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full">
                      {viewSupplier.payment_terms || "Immediate"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {[
                      ["Contact Person", viewSupplier.contact_person || "—"],
                      ["Phone", viewSupplier.phone || "—"],
                      ["Email", viewSupplier.email || "—"],
                      ["City", viewSupplier.city || "—"],
                      ["Country", viewSupplier.country || "—"],
                      ["Tax Number", viewSupplier.tax_number || "—"],
                      ["Purchases", formatCurrency(safeNumber(viewSupplier.total_purchases))],
                      ["Outstanding", formatCurrency(safeNumber(viewSupplier.outstanding_balance))],
                      ["Supplier Age", `${supplierAgeDays(viewSupplier)} days`],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                        <span className="text-muted-foreground text-xs block">{label}</span>
                        <span className="font-medium break-words">{String(value ?? "—")}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <span className="text-muted-foreground text-xs block">Address</span>
                    <p className="mt-1 text-sm">{viewSupplier.address || "No address"}</p>
                  </div>

                  {viewSupplier.notes && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <span className="text-muted-foreground text-xs block">Notes</span>
                      <p className="mt-1 text-sm">{viewSupplier.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => viewSupplier && duplicateSupplier(viewSupplier)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
              <Button className={BTN_PRIMARY} onClick={() => { if (viewSupplier) openEdit(viewSupplier); setViewSupplier(null); }}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteSupplier} onOpenChange={() => setDeleteSupplier(null)}>
          <DialogContent className="sm:max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Delete Supplier</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteSupplier?.name}"? Offline deletions will be queued for sync.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteSupplier(null)}>
                Cancel
              </Button>

              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </PageBackground>
  );
}