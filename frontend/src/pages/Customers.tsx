import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  Users,
  Search,
  Plus,
  Eye,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Star,
  Mail,
  Phone,
  Wallet,
  Crown,
  UserCheck,
  MapPin,
  CreditCard,
  ShieldCheck,
  Wifi,
  WifiOff,
  UploadCloud,
  Database,
  RotateCcw,
  AlertTriangle,
  UserX,
  BarChart3,
  PieChart,
  Activity,
  TrendingUp,
  ClipboardCheck,
} from "lucide-react";
import { customerGroups, customerTypes } from "@/data/mockCustomers";
import {
  useCustomers,
  useCustomerMutations,
  type DbCustomer,
} from "@/hooks/useSupabaseData";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/currency";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { useAuth } from "@/contexts/AuthContext";

const SHOPCORE_BLUE = "#2563eb";

const BTN_PRIMARY = "bg-blue-600 text-white hover:bg-blue-700 border-blue-600";
const BTN_SUCCESS =
  "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600";
const BTN_WARNING =
  "bg-orange-600 text-white hover:bg-orange-700 border-orange-600";
const BTN_INFO = "bg-cyan-600 text-white hover:bg-cyan-700 border-cyan-600";
const BTN_DANGER = "bg-rose-600 text-white hover:bg-rose-700 border-rose-600";
const BTN_PURPLE =
  "bg-violet-600 text-white hover:bg-violet-700 border-violet-600";

const INPUT_BLUE =
  "rounded-xl border-blue-200 bg-blue-50 text-blue-900 placeholder:text-blue-700/60 focus-visible:ring-blue-500";
const INPUT_EMERALD =
  "rounded-xl border-emerald-200 bg-emerald-50 text-emerald-900 placeholder:text-emerald-700/60 focus-visible:ring-emerald-500";
const INPUT_ORANGE =
  "rounded-xl border-orange-200 bg-orange-50 text-orange-900 placeholder:text-orange-700/60 focus-visible:ring-orange-500";
const INPUT_ROSE =
  "rounded-xl border-rose-200 bg-rose-50 text-rose-900 placeholder:text-rose-700/60 focus-visible:ring-rose-500";
const INPUT_VIOLET =
  "rounded-xl border-violet-200 bg-violet-50 text-violet-900 placeholder:text-violet-700/60 focus-visible:ring-violet-500";
const INPUT_CYAN =
  "rounded-xl border-cyan-200 bg-cyan-50 text-cyan-900 placeholder:text-cyan-700/60 focus-visible:ring-cyan-500";

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  inactive: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  blocked: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  deleted: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  pending: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  pending_update: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  pending_delete: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

const tierColors: Record<string, string> = {
  bronze: "bg-orange-100 text-orange-700 border-orange-300",
  silver: "bg-cyan-100 text-cyan-700 border-cyan-300",
  gold: "bg-orange-100 text-orange-700 border-orange-300",
  platinum: "bg-violet-100 text-violet-700 border-violet-300",
};

const PAGE_SIZE = 12;

type SortKey =
  | "name"
  | "total_spent"
  | "outstanding_balance"
  | "loyalty_points"
  | "join_date"
  | "created_at";

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

function getCustomerDate(customer: any) {
  return (
    customer?.join_date ||
    customer?.created_offline_at ||
    customer?.created_at ||
    ""
  );
}

function isPendingSync(row: any) {
  return (
    String(row?.id || "").startsWith("offline-") ||
    !!row?.offline_id ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    String(row?.sync_status || "")
      .toLowerCase()
      .includes("pending")
  );
}

function isPendingDelete(row: any) {
  return (
    String(row?.operation || "").toLowerCase() === "delete" ||
    String(row?.sync_status || "").toLowerCase() === "pending_delete" ||
    String(row?.status || "").toLowerCase() === "deleted"
  );
}

function dedupeCustomers(customers: any[]) {
  const map = new Map<string, any>();

  for (const customer of customers || []) {
    const key = String(
      customer.id ||
        customer.offline_id ||
        customer.code ||
        customer.email ||
        customer.phone ||
        Math.random(),
    );

    const existing = map.get(key);
    if (!existing) {
      map.set(key, customer);
      continue;
    }

    const existingTime = new Date(
      existing.updated_offline_at ||
        (existing as any).updated_at ||
        (existing as any).created_at ||
        0,
    ).getTime();

    const incomingTime = new Date(
      customer.updated_offline_at ||
        (customer as any).updated_at ||
        (customer as any).created_at ||
        0,
    ).getTime();

    map.set(
      key,
      incomingTime >= existingTime
        ? { ...existing, ...customer }
        : { ...customer, ...existing },
    );
  }

  return Array.from(map.values()).filter(
    (customer) => !isPendingDelete(customer),
  ) as DbCustomer[];
}
function normalizeCustomerPayload(form: Partial<DbCustomer>) {
  const name = String(form.name || "").trim();
  const email = String(form.email || "").trim();
  const phone = String(form.phone || "").trim();

  return {
    name,
    email,
    phone,
    type: form.type || "retail",
    customer_group: form.customer_group || "General",
    credit_limit: safeNumber(form.credit_limit || 0),
    address: form.address || "",
    city: form.city || "",
    status: form.status || "active",
    loyalty_tier: form.loyalty_tier || "bronze",
    notes: (form as any).notes || "",
  };
}

function getTierFromStats(customer: any) {
  const spent = safeNumber(customer.total_spent);
  const points = safeNumber(customer.loyalty_points);

  if (spent >= 500000 || points >= 5000) return "platinum";
  if (spent >= 200000 || points >= 2000) return "gold";
  if (spent >= 75000 || points >= 750) return "silver";
  return customer.loyalty_tier || "bronze";
}

function percentOf(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatShortCurrency(value: number) {
  if (value >= 1_000_000_000)
    return `${formatCurrency(value / 1_000_000_000)}B`;
  if (value >= 1_000_000) return `${formatCurrency(value / 1_000_000)}M`;
  if (value >= 1_000) return `${formatCurrency(value / 1_000)}K`;
  return formatCurrency(value);
}

function formatCustomerDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Customers() {
  const { user, tenantId, session } = useAuth();
  const qc = useQueryClient();
  const { data: customers = [], isLoading } = useCustomers();
  const { create, update } = useCustomerMutations();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [syncFilter, setSyncFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const [viewCustomer, setViewCustomer] = useState<DbCustomer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<DbCustomer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<DbCustomer | null>(null);
  const [form, setForm] = useState<Partial<DbCustomer>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const offlineModeActive = !isOnline() || isOfflineMode();
  const canUseOnlineSupabase =
    isOnline() && !!session?.access_token && !isOfflineMode();

  const cleanCustomers = useMemo(
    () => dedupeCustomers(customers as DbCustomer[]),
    [customers],
  );

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>(customerTypes);
    cleanCustomers.forEach((c) => c.type && set.add(c.type));
    return [...set].filter(Boolean).sort();
  }, [cleanCustomers]);

  const uniqueGroups = useMemo(() => {
    const set = new Set<string>(customerGroups);
    cleanCustomers.forEach(
      (c) => c.customer_group && set.add(c.customer_group),
    );
    return [...set].filter(Boolean).sort();
  }, [cleanCustomers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    const list = cleanCustomers.filter((c: any) => {
      const matchSearch =
        !q ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q);

      const matchType = typeFilter === "all" || c.type === typeFilter;
      const matchGroup =
        groupFilter === "all" || c.customer_group === groupFilter;
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const pending = isPendingSync(c);
      const matchSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      return matchSearch && matchType && matchGroup && matchStatus && matchSync;
    });

    list.sort((a: any, b: any) => {
      if (sortKey === "created_at" || sortKey === "join_date") {
        const av = new Date(getCustomerDate(a) || 0).getTime();
        const bv = new Date(getCustomerDate(b) || 0).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      const av = a[sortKey];
      const bv = b[sortKey];

      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      return sortAsc
        ? safeNumber(av) - safeNumber(bv)
        : safeNumber(bv) - safeNumber(av);
    });

    return list;
  }, [
    cleanCustomers,
    search,
    typeFilter,
    groupFilter,
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

  const stats = useMemo(
    () => ({
      total: cleanCustomers.length,
      active: cleanCustomers.filter((c) => c.status === "active").length,
      inactive: cleanCustomers.filter((c) => c.status === "inactive").length,
      blocked: cleanCustomers.filter((c) => c.status === "blocked").length,
      outstanding: cleanCustomers.reduce(
        (s, c) => s + safeNumber(c.outstanding_balance),
        0,
      ),
      vip: cleanCustomers.filter((c) => c.customer_group === "VIP").length,
      points: cleanCustomers.reduce(
        (s, c) => s + safeNumber(c.loyalty_points),
        0,
      ),
      credit: cleanCustomers.reduce(
        (s, c) => s + safeNumber(c.credit_limit),
        0,
      ),
      totalSpent: cleanCustomers.reduce(
        (s, c) => s + safeNumber(c.total_spent),
        0,
      ),
      pendingSync: cleanCustomers.filter(isPendingSync).length,
      creditCustomers: cleanCustomers.filter(
        (c) => safeNumber(c.outstanding_balance) > 0,
      ).length,
    }),
    [cleanCustomers],
  );

  const customerAnalytics = useMemo(() => {
    const total = Math.max(cleanCustomers.length, 1);
    const activeRate = percentOf(stats.active, total);
    const syncRate = percentOf(
      cleanCustomers.length - stats.pendingSync,
      total,
    );
    const creditExposureRate = percentOf(stats.creditCustomers, total);
    const blockedRate = percentOf(stats.blocked, total);

    const crmScore = clampScore(
      activeRate * 0.45 +
        syncRate * 0.25 +
        Math.max(0, 100 - creditExposureRate) * 0.2 +
        Math.max(0, 100 - blockedRate) * 0.1,
    );

    const averageSpend =
      cleanCustomers.length > 0 ? stats.totalSpent / cleanCustomers.length : 0;
    const averageOutstanding =
      stats.creditCustomers > 0 ? stats.outstanding / stats.creditCustomers : 0;

    return {
      total,
      activeRate,
      syncRate,
      creditExposureRate,
      blockedRate,
      crmScore,
      averageSpend,
      averageOutstanding,
    };
  }, [cleanCustomers.length, stats]);

  const tierDistribution = useMemo(() => {
    const tiers = ["bronze", "silver", "gold", "platinum"];
    return tiers.map((tier) => {
      const count = cleanCustomers.filter(
        (c) => getTierFromStats(c) === tier,
      ).length;
      return {
        tier,
        count,
        percent: percentOf(count, cleanCustomers.length),
      };
    });
  }, [cleanCustomers]);

  const statusDistribution = useMemo(() => {
    const rows = [
      { label: "Active", value: stats.active, color: "bg-emerald-500" },
      { label: "Inactive", value: stats.inactive, color: "bg-orange-500" },
      { label: "Blocked", value: stats.blocked, color: "bg-rose-500" },
      { label: "Pending Sync", value: stats.pendingSync, color: "bg-blue-500" },
    ];

    return rows.map((row) => ({
      ...row,
      percent: percentOf(row.value, cleanCustomers.length),
    }));
  }, [stats, cleanCustomers.length]);

  const topCustomers = useMemo(
    () =>
      [...cleanCustomers]
        .sort(
          (a, b) =>
            safeNumber((b as any).total_spent) -
            safeNumber((a as any).total_spent),
        )
        .slice(0, 5)
        .map((customer: any) => ({
          id: customer.id,
          name: customer.name || "Unknown Customer",
          spent: safeNumber(customer.total_spent),
          balance: safeNumber(customer.outstanding_balance),
          tier: getTierFromStats(customer),
        })),
    [cleanCustomers],
  );

  const exportRows = filtered.map((c: any) => ({
    code: c.code || "",
    name: c.name || "",
    email: c.email || "",
    phone: c.phone || "",
    type: c.type || "",
    group: c.customer_group || "",
    total_purchases: safeNumber(c.total_purchases),
    total_spent: formatCurrency(safeNumber(c.total_spent)),
    outstanding_balance: formatCurrency(safeNumber(c.outstanding_balance)),
    credit_limit: formatCurrency(safeNumber(c.credit_limit)),
    loyalty_points: safeNumber(c.loyalty_points).toLocaleString(),
    loyalty_tier: getTierFromStats(c),
    status: c.status || "",
    city: c.city || "",
    sync_status: isPendingSync(c) ? "Pending" : "Synced",
    join_date: c.join_date || "",
  }));

  const exportCols = [
    { key: "code" as const, label: "Code" },
    { key: "name" as const, label: "Name" },
    { key: "email" as const, label: "Email" },
    { key: "phone" as const, label: "Phone" },
    { key: "type" as const, label: "Type" },
    { key: "group" as const, label: "Group" },
    { key: "total_purchases" as const, label: "Purchases" },
    { key: "total_spent" as const, label: "Total Spent" },
    { key: "outstanding_balance" as const, label: "Outstanding" },
    { key: "credit_limit" as const, label: "Credit Limit" },
    { key: "loyalty_points" as const, label: "Points" },
    { key: "loyalty_tier" as const, label: "Tier" },
    { key: "status" as const, label: "Status" },
    { key: "city" as const, label: "City" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "join_date" as const, label: "Join Date" },
  ];

  const refreshCustomerQueries = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["customers"] }),
      qc.invalidateQueries({ queryKey: ["sales"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["reports"] }),
      qc.invalidateQueries({ queryKey: ["loyalty"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setGroupFilter("all");
    setStatusFilter("active");
    setSyncFilter("all");
    setPage(1);
  };

  const openCreate = () => {
    setEditCustomer(null);
    setForm({
      type: "retail",
      customer_group: "General",
      status: "active",
      loyalty_tier: "bronze",
      credit_limit: 0,
      total_purchases: 0,
      total_spent: 0,
      outstanding_balance: 0,
      loyalty_points: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (c: DbCustomer) => {
    setEditCustomer(c);
    setForm({ ...c, loyalty_tier: getTierFromStats(c) });
    setDialogOpen(true);
  };

  const saveCustomerOffline = async (payload: any) => {
    if (!tenantId) throw new Error("No active workspace");

    const now = new Date().toISOString();
    const cachedCustomers = await getCachedTable("customers");

    if (editCustomer) {
      const isOfflineCustomer =
        String(editCustomer.id || "").startsWith("offline-") ||
        !!(editCustomer as any).offline_id;
      const updatedCustomer: any = {
        ...editCustomer,
        ...payload,
        id: editCustomer.id,
        tenant_id: (editCustomer as any).tenant_id || tenantId,
        user_id: (editCustomer as any).user_id || user?.id || null,
        operation: isOfflineCustomer ? "create" : "update",
        sync_status: isOfflineCustomer ? "pending" : "pending_update",
        updated_at: now,
        updated_offline_at: now,
      };

      await saveCachedTable(
        "customers",
        dedupeCustomers([
          updatedCustomer,
          ...(Array.isArray(cachedCustomers) ? cachedCustomers : []),
        ] as any),
      );

      await savePending("customers", updatedCustomer);
      toast.success(
        "Customer updated offline. It will sync when internet returns.",
      );
    } else {
      const offlineCustomer: any = {
        ...payload,
        id: makeLocalId("offline-customer"),
        code: `C-${Date.now().toString(36).toUpperCase()}`,
        tenant_id: tenantId,
        user_id: user?.id || null,
        total_purchases: 0,
        total_spent: 0,
        outstanding_balance: 0,
        loyalty_points: 0,
        loyalty_tier: payload.loyalty_tier || "bronze",
        join_date: new Date().toISOString().split("T")[0],
        last_purchase: null,
        operation: "create",
        sync_status: "pending",
        created_at: now,
        updated_at: now,
        created_offline_at: now,
        updated_offline_at: now,
      };

      await saveCachedTable(
        "customers",
        dedupeCustomers([
          offlineCustomer,
          ...(Array.isArray(cachedCustomers) ? cachedCustomers : []),
        ] as any),
      );

      await savePending("customers", offlineCustomer);
      toast.success(
        "Customer saved offline. It will sync when internet returns.",
      );
    }

    await refreshCustomerQueries();
    setDialogOpen(false);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Customer name is required");
      return;
    }

    const payload = normalizeCustomerPayload(form);

    if (!payload.email && !payload.phone) {
      toast.error("Add at least email or phone number");
      return;
    }

    try {
      setSavingId(editCustomer?.id || "new");

      if (!canUseOnlineSupabase) {
        await saveCustomerOffline(payload);
        return;
      }

      if (editCustomer) {
        if (
          String(editCustomer.id || "").startsWith("offline-") ||
          !!(editCustomer as any).offline_id
        ) {
          await saveCustomerOffline(payload);
          return;
        }

        await update.mutateAsync({
          id: editCustomer.id,
          ...payload,
        } as any);

        const cachedCustomers = await getCachedTable("customers");
        await saveCachedTable(
          "customers",
          dedupeCustomers([
            {
              ...editCustomer,
              ...payload,
              updated_at: new Date().toISOString(),
            },
            ...(Array.isArray(cachedCustomers) ? cachedCustomers : []),
          ] as any),
        );

        toast.success("Customer updated successfully.");
      } else {
        const createdPayload = {
          code: `C-${Date.now().toString(36).toUpperCase()}`,
          ...payload,
          total_purchases: 0,
          total_spent: 0,
          outstanding_balance: 0,
          credit_limit: safeNumber(payload.credit_limit),
          loyalty_points: 0,
          loyalty_tier: "bronze",
          status: payload.status || "active",
          join_date: new Date().toISOString().split("T")[0],
          last_purchase: null,
          notes: payload.notes || "",
        };

        const created = await create.mutateAsync(createdPayload as any);

        const cachedCustomers = await getCachedTable("customers");
        await saveCachedTable(
          "customers",
          dedupeCustomers([
            { ...createdPayload, ...(created || {}) },
            ...(Array.isArray(cachedCustomers) ? cachedCustomers : []),
          ] as any),
        );

        toast.success("Customer created successfully.");
      }

      setDialogOpen(false);
      await refreshCustomerQueries();
    } catch (error: any) {
      console.error("Customer save failed:", error);

      if (isNetworkError(error) || !isOnline()) {
        await saveCustomerOffline(payload);
        return;
      }

      toast.error(error?.message || "Failed to save customer");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteCustomer) return;

    const customer = deleteCustomer as any;
    const now = new Date().toISOString();
    const archivedPatch = { status: "inactive", updated_at: now };
    setDeleteCustomer(null);

    try {
      const cachedCustomers = await getCachedTable("customers");
      const archivedCustomer = {
        ...customer,
        ...archivedPatch,
        operation: "update",
        sync_status: "pending_update",
        updated_offline_at: now,
      };

      if (
        !canUseOnlineSupabase ||
        String(customer.id || "").startsWith("offline-")
      ) {
        if (String(customer.id || "").startsWith("offline-")) {
          await saveCachedTable(
            "customers",
            (Array.isArray(cachedCustomers) ? cachedCustomers : []).filter(
              (row: any) => String(row.id) !== String(customer.id),
            ),
          );
          toast.success("Offline customer removed locally.");
        } else {
          await savePending("customers", archivedCustomer);
          await saveCachedTable(
            "customers",
            (Array.isArray(cachedCustomers) ? cachedCustomers : []).map(
              (row: any) =>
                String(row.id) === String(customer.id) ? archivedCustomer : row,
            ),
          );
          toast.success(
            "Customer archived offline. It will sync when internet returns.",
          );
        }

        await refreshCustomerQueries();
        return;
      }

      await update.mutateAsync({ id: customer.id, status: "inactive" } as any);
      await saveCachedTable(
        "customers",
        (Array.isArray(cachedCustomers) ? cachedCustomers : []).map(
          (row: any) =>
            String(row.id) === String(customer.id)
              ? { ...row, ...archivedPatch }
              : row,
        ),
      );
      await refreshCustomerQueries();
      toast.success("Customer archived successfully.");
    } catch (error: any) {
      if (isNetworkError(error)) {
        const archivedCustomer = {
          ...customer,
          ...archivedPatch,
          operation: "update",
          sync_status: "pending_update",
          updated_offline_at: now,
        };
        await savePending("customers", archivedCustomer);
        toast.success("Network failed. Customer archive saved offline.");
        await refreshCustomerQueries();
        return;
      }

      toast.error(error?.message || "Failed to archive customer");
    }
  };

  const kpis = [
    {
      label: "Total Customers",
      value: stats.total,
      icon: Users,
      color: "bg-blue-600 text-white border-blue-600",
    },
    {
      label: "Active",
      value: stats.active,
      icon: UserCheck,
      color: "bg-emerald-600 text-white border-emerald-600",
    },
    {
      label: "Outstanding",
      value: formatCurrency(stats.outstanding),
      icon: Wallet,
      color: "bg-rose-600 text-white border-rose-600",
    },
    {
      label: "VIP Customers",
      value: stats.vip,
      icon: Crown,
      color: "bg-orange-600 text-white border-orange-600",
    },
  ];

  if (isLoading) {
    return (
      <PageShell title="Customers" description="Loading...">
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Customers"
      description="Enterprise customer CRM for profiles, purchase behavior, balances, loyalty, credit exposure, and offline-ready customer management."
    >
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-4">
          {(offlineModeActive || stats.pendingSync > 0) && (
            <div className="rounded-2xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">
                    {offlineModeActive ? (
                      <WifiOff className="h-5 w-5" />
                    ) : (
                      <Database className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive
                        ? "Customers are using offline cache"
                        : "Customer changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending customer records: {stats.pendingSync}. POS and
                      Sales can still use cached customers while offline.
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-7 rounded-2xl border border-blue-200 bg-blue-50 shadow-sm p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-600 text-white border-blue-600 mb-3">
                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                    Customer Relationship Center
                  </Badge>
                  <h2 className="text-xl font-bold tracking-tight">
                    Customer CRM Control Room
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Manage customer profiles, credit limits, loyalty tiers,
                    outstanding balances, purchase behavior, customer groups,
                    and offline customer records.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                      <p className="text-xs font-medium text-orange-700">
                        Loyalty Points
                      </p>
                      <p className="text-sm font-semibold font-data text-orange-700">
                        {stats.points.toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <p className="text-xs font-medium text-violet-700">
                        Credit Limit
                      </p>
                      <p className="text-sm font-semibold font-data text-violet-700">
                        {formatCurrency(stats.credit)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                      <p className="text-xs font-medium text-cyan-700">
                        Filtered Results
                      </p>
                      <p className="text-sm font-semibold font-data text-cyan-700">
                        {filtered.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 gap-3">
              {kpis.map((item) => {
                const Icon = item.icon;
                const valueClass =
                  String(item.value).length > 14
                    ? "text-base xl:text-lg break-words max-w-full"
                    : "text-2xl";

                return (
                  <div
                    key={item.label}
                    className={`rounded-2xl border shadow-sm p-4 ${item.color}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">
                          {item.label}
                        </p>
                        <p className={`${valueClass} font-bold font-data mt-1`}>
                          {item.value}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-5 rounded-2xl border border-blue-200 bg-blue-50 shadow-sm p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="font-semibold">Customer Health</h3>
                  <p className="text-xs opacity-80">
                    CRM activity and account exposure
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Active",
                    value: stats.active,
                    icon: UserCheck,
                    color: "border-emerald-200 bg-emerald-50 text-emerald-700",
                  },
                  {
                    label: "Blocked",
                    value: stats.blocked,
                    icon: UserX,
                    color: "border-rose-200 bg-rose-50 text-rose-700",
                  },
                  {
                    label: "Credit",
                    value: stats.creditCustomers,
                    icon: AlertTriangle,
                    color: "border-orange-200 bg-orange-50 text-orange-700",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-xl border p-3 text-center ${item.color}`}
                  >
                    <item.icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="font-data font-bold truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-medium text-rose-700">
                  Outstanding Balance
                </p>
                <p className="text-sm font-semibold font-data mt-1 text-rose-600">
                  {formatCurrency(stats.outstanding)}
                </p>
              </div>
            </div>

            <div className="xl:col-span-7 rounded-2xl border border-blue-200 bg-blue-50 shadow-sm p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                  <Crown className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="font-semibold">Customer Segments</h3>
                  <p className="text-xs text-muted-foreground">
                    Distribution by group
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {uniqueGroups.map((group) => {
                  const count = cleanCustomers.filter(
                    (c) => c.customer_group === group,
                  ).length;
                  const percent =
                    cleanCustomers.length > 0
                      ? Math.round((count / cleanCustomers.length) * 100)
                      : 0;

                  return (
                    <div key={group}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{group}</span>
                        <span className="font-data text-violet-700">
                          {count} · {percent}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percent}%`,
                            background: SHOPCORE_BLUE,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-4 rounded-2xl border border-blue-200 bg-blue-50 shadow-sm p-4 overflow-hidden relative">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10" />
              <div className="absolute -right-3 top-20 h-16 w-16 rounded-full bg-emerald-500/10" />

              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold">CRM Health Score</h3>
                    <p className="text-xs text-muted-foreground">
                      Activity, sync, credit, and risk quality
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center py-3">
                  <div
                    className="h-32 w-32 rounded-full p-4"
                    style={{
                      background: `conic-gradient(${SHOPCORE_BLUE} ${customerAnalytics.crmScore * 3.6}deg, #dbeafe 0deg)`,
                    }}
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-inner">
                      <p className="text-3xl font-black font-data">
                        {customerAnalytics.crmScore}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Health Score
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-muted-foreground">Active Rate</p>
                    <p className="font-bold font-data">
                      {customerAnalytics.activeRate}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-xs text-muted-foreground">Sync Rate</p>
                    <p className="font-bold font-data">
                      {customerAnalytics.syncRate}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-2xl border border-violet-200 bg-violet-50 shadow-sm p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <PieChart className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="font-semibold">Loyalty Tier Mix</h3>
                  <p className="text-xs text-muted-foreground">
                    Visual share of bronze, silver, gold, and platinum customers
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {tierDistribution.map((item) => (
                  <div key={item.tier}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">
                        {item.tier}
                      </span>
                      <span className="font-data text-muted-foreground">
                        {item.count} · {item.percent}%
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/80">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.percent}%`,
                          background:
                            item.tier === "platinum"
                              ? "#7c3aed"
                              : item.tier === "gold"
                                ? "#f59e0b"
                                : item.tier === "silver"
                                  ? "#94a3b8"
                                  : "#f97316",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-violet-200 bg-white/70 p-3">
                <p className="text-xs text-muted-foreground">
                  Total Loyalty Points
                </p>
                <p className="text-lg font-bold font-data">
                  {stats.points.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-2xl border border-emerald-200 bg-emerald-50 shadow-sm p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="font-semibold">Customer Value Insights</h3>
                  <p className="text-xs text-muted-foreground">
                    Spending, exposure, and CRM quality indicators
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-white/80 p-3">
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                  <p className="text-lg font-bold font-data">
                    {formatShortCurrency(stats.totalSpent)}
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                  <p className="text-xs text-muted-foreground">Avg. Spend</p>
                  <p className="text-lg font-bold font-data">
                    {formatShortCurrency(customerAnalytics.averageSpend)}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Credit Exposure
                  </p>
                  <p className="text-lg font-bold font-data text-rose-600">
                    {customerAnalytics.creditExposureRate}%
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs text-muted-foreground">Avg. Balance</p>
                  <p className="text-lg font-bold font-data">
                    {formatShortCurrency(customerAnalytics.averageOutstanding)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {statusDistribution.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-white/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-14 text-right text-xs font-data text-muted-foreground">
                      {item.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-7 rounded-2xl border border-blue-200 bg-blue-50 shadow-sm p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="font-semibold">Top Customer Value Chart</h3>
                  <p className="text-xs text-muted-foreground">
                    Highest-spending customers ranked by lifetime value
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {topCustomers.length === 0 ? (
                  <div className="rounded-xl border border-cyan-200 bg-white/70 py-8 text-center text-sm text-cyan-700">
                    No spending data available yet
                  </div>
                ) : (
                  topCustomers.map((customer, index) => {
                    const maxSpent = Math.max(
                      ...topCustomers.map((row) => row.spent),
                      1,
                    );
                    const width = percentOf(customer.spent, maxSpent);

                    return (
                      <div
                        key={customer.id || customer.name}
                        className="space-y-1"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <span className="font-semibold">{index + 1}.</span>{" "}
                            <span className="truncate">{customer.name}</span>
                          </div>
                          <span className="font-data font-semibold">
                            {formatCurrency(customer.spent)}
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-white/80 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${width}%`,
                              background: SHOPCORE_BLUE,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="xl:col-span-5 rounded-2xl border border-orange-200 bg-orange-50 shadow-sm p-4 relative overflow-hidden">
              <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-amber-500/10" />
              <div className="absolute bottom-16 right-10 h-20 w-20 rotate-12 rounded-2xl bg-blue-500/10" />

              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold">CRM Action Register</h3>
                    <p className="text-xs text-muted-foreground">
                      Customer follow-up and account discipline
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          Recover outstanding balances
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.creditCustomers} customer(s) have unpaid
                          balances totaling {formatCurrency(stats.outstanding)}.
                        </p>
                      </div>
                      <Badge className="rounded-full bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/10">
                        Priority
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Grow loyalty engagement</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Promote repeat purchases using tier-based rewards and
                          customer groups.
                        </p>
                      </div>
                      <Badge className="rounded-full bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10">
                        Loyalty
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          Keep offline records synced
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.pendingSync} customer record(s) are waiting for
                          synchronization.
                        </p>
                      </div>
                      <Badge className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10">
                        Sync
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 shadow-sm p-3">
            <div className="flex flex-col xl:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50">
                <Search className="w-4 h-4 text-blue-700" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, code, city, or address..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-blue-700/60"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[130px] h-10 rounded-xl border-blue-200 bg-blue-50 text-blue-700">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={groupFilter}
                  onValueChange={(v) => {
                    setGroupFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[140px] h-10 rounded-xl border-violet-200 bg-violet-50 text-violet-700">
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {uniqueGroups.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
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
                  <SelectTrigger className="w-[130px] h-10 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={syncFilter}
                  onValueChange={(v) => {
                    setSyncFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[130px] h-10 rounded-xl border-cyan-200 bg-cyan-50 text-cyan-700">
                    <SelectValue placeholder="Sync" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sync</SelectItem>
                    <SelectItem value="synced">Synced</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={sortKey}
                  onValueChange={(v) => toggleSort(v as SortKey)}
                >
                  <SelectTrigger className="w-[150px] h-10 rounded-xl border-violet-200 bg-violet-50 text-violet-700">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Newest</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="total_spent">Total Spent</SelectItem>
                    <SelectItem value="outstanding_balance">Balance</SelectItem>
                    <SelectItem value="loyalty_points">Points</SelectItem>
                    <SelectItem value="join_date">Join Date</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  className={`h-10 rounded-xl ${BTN_PURPLE}`}
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  {sortAsc ? "Asc" : "Desc"}
                </Button>

                <Button
                  variant="ghost"
                  className={`h-10 rounded-xl ${BTN_WARNING}`}
                  onClick={resetFilters}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>

                <ExportMenu
                  onCSV={() => exportToCSV(exportRows, "customers", exportCols)}
                  onPDF={() =>
                    exportToPDF(
                      exportRows,
                      "customers",
                      "Customers Report",
                      exportCols,
                      {
                        subtitle: `${filtered.length} customers`,
                        summary: [
                          {
                            label: "Total Customers",
                            value: String(stats.total),
                          },
                          { label: "Active", value: String(stats.active) },
                          { label: "VIP Customers", value: String(stats.vip) },
                          {
                            label: "Outstanding",
                            value: formatCurrency(stats.outstanding),
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
                  className={`h-10 rounded-xl ${BTN_PRIMARY}`}
                  onClick={openCreate}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
            {paged.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-blue-200 bg-blue-50 px-6 py-10 text-center text-blue-800">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                No customers found
              </div>
            ) : (
              paged.map((c: any) => {
                const pending = isPendingSync(c);
                const tier = getTierFromStats(c);

                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-blue-100 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md transition p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-semibold shrink-0">
                          {(c.name || "C").charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{c.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.email || c.phone || "No contact"}
                          </p>
                          <p className="text-xs text-muted-foreground font-data">
                            {c.code}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant="outline"
                          className={`capitalize rounded-full ${
                            statusColors[c.status] || statusColors.inactive
                          }`}
                        >
                          {c.status || "active"}
                        </Badge>

                        <Badge
                          variant="outline"
                          className={`capitalize rounded-full ${
                            tierColors[tier] || tierColors.bronze
                          }`}
                        >
                          {tier}
                        </Badge>

                        {pending && (
                          <Badge
                            variant="outline"
                            className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30"
                          >
                            <UploadCloud className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Spent
                        </p>
                        <p className="font-data font-bold text-sm">
                          {formatCurrency(safeNumber(c.total_spent))}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Balance
                        </p>
                        <p
                          className={`font-data font-bold text-sm ${
                            safeNumber(c.outstanding_balance) > 0
                              ? "text-rose-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {safeNumber(c.outstanding_balance) > 0
                            ? formatCurrency(safeNumber(c.outstanding_balance))
                            : "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Points
                        </p>
                        <p className="font-data font-bold text-sm flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" />
                          {safeNumber(c.loyalty_points).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Type</p>
                          <p className="font-medium capitalize truncate">
                            {c.type}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Group</p>
                          <p className="font-medium truncate">
                            {c.customer_group}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="font-medium truncate">
                            {c.phone || "No phone"}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">City</p>
                          <p className="font-medium truncate">
                            {c.city || "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <div className="flex-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">
                          Joined: {formatCustomerDate(c.join_date)} · Last:{" "}
                          {formatCustomerDate(c.last_purchase)}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className={`rounded-xl shrink-0 ${BTN_INFO}`}
                        onClick={() => setViewCustomer(c)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </div>

                    <div className="flex justify-end gap-1 mt-4">
                      <Button
                        size="sm"
                        className={`rounded-xl ${BTN_WARNING}`}
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        className={`rounded-xl ${BTN_DANGER}`}
                        onClick={() => setDeleteCustomer(c)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Archive
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 shadow-sm px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (n) => (
                    <Button
                      key={n}
                      variant={n === currentPage ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(n)}
                      style={
                        n === currentPage
                          ? { background: SHOPCORE_BLUE }
                          : undefined
                      }
                    >
                      {n}
                    </Button>
                  ),
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <Dialog
          open={!!viewCustomer}
          onOpenChange={() => setViewCustomer(null)}
        >
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {viewCustomer?.name}
              </DialogTitle>
              <DialogDescription>
                {viewCustomer?.code} · {viewCustomer?.type} customer
              </DialogDescription>
            </DialogHeader>

            {viewCustomer && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl font-bold">
                    {(viewCustomer.name || "C").charAt(0).toUpperCase()}
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold text-lg">{viewCustomer.name}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={`capitalize rounded-full ${
                          tierColors[getTierFromStats(viewCustomer)] ||
                          tierColors.bronze
                        }`}
                      >
                        {getTierFromStats(viewCustomer)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`capitalize rounded-full ${
                          statusColors[viewCustomer.status] ||
                          statusColors.inactive
                        }`}
                      >
                        {viewCustomer.status}
                      </Badge>
                      {isPendingSync(viewCustomer) && (
                        <Badge
                          variant="outline"
                          className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30"
                        >
                          Pending Sync
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {viewCustomer.email || "No email"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {viewCustomer.phone || "No phone"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {viewCustomer.city ||
                        viewCustomer.address ||
                        "No location"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formatCurrency(safeNumber(viewCustomer.credit_limit))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Purchases
                    </p>
                    <p className="text-lg font-semibold font-data">
                      {safeNumber(viewCustomer.total_purchases)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Total Spent
                    </p>
                    <p className="text-lg font-semibold font-data">
                      {formatCurrency(safeNumber(viewCustomer.total_spent))}
                    </p>
                  </div>

                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Points
                    </p>
                    <p className="text-lg font-semibold font-data flex items-center gap-1">
                      <Star className="w-3 h-3 text-warning" />
                      {safeNumber(viewCustomer.loyalty_points).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Credit Limit
                    </p>
                    <p className="font-data">
                      {formatCurrency(safeNumber(viewCustomer.credit_limit))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="font-data">
                      {safeNumber(viewCustomer.outstanding_balance) > 0
                        ? formatCurrency(
                            safeNumber(viewCustomer.outstanding_balance),
                          )
                        : "None"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p>{formatCustomerDate(viewCustomer.join_date)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      Last Purchase
                    </p>
                    <p>{formatCustomerDate(viewCustomer.last_purchase)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p>
                      {viewCustomer.address || "—"}
                      {viewCustomer.city ? `, ${viewCustomer.city}` : ""}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Group</p>
                    <p>{viewCustomer.customer_group}</p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                className={BTN_WARNING}
                onClick={() => setViewCustomer(null)}
              >
                Close
              </Button>

              <Button
                className={BTN_PRIMARY}
                onClick={() => {
                  if (viewCustomer) {
                    openEdit(viewCustomer);
                    setViewCustomer(null);
                  }
                }}
              >
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>
                {editCustomer ? "Edit Customer" : "Add New Customer"}
              </DialogTitle>
              <DialogDescription>
                {editCustomer
                  ? "Update customer details. Offline changes will sync later."
                  : "Add a new customer to your CRM. Email or phone is required."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Full Name *
                </label>
                <Input
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jean Customer"
                  className={INPUT_BLUE}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Email
                  </label>
                  <Input
                    value={form.email || ""}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="customer@email.com"
                    className={INPUT_CYAN}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Phone
                  </label>
                  <Input
                    value={form.phone || ""}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="+250..."
                    className={INPUT_EMERALD}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Type
                  </label>
                  <Select
                    value={form.type || "retail"}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                  >
                    <SelectTrigger className="rounded-xl border-orange-200 bg-orange-50 text-orange-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueTypes.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Group
                  </label>
                  <Select
                    value={form.customer_group || "General"}
                    onValueChange={(v) =>
                      setForm({ ...form, customer_group: v })
                    }
                  >
                    <SelectTrigger className="rounded-xl border-violet-200 bg-violet-50 text-violet-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueGroups.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Address
                  </label>
                  <Input
                    value={form.address || ""}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    placeholder="Street address"
                    className={INPUT_BLUE}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    City
                  </label>
                  <Input
                    value={form.city || ""}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Kigali"
                    className={INPUT_CYAN}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Credit Limit (RWF)
                  </label>
                  <Input
                    type="number"
                    value={form.credit_limit ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        credit_limit: safeNumber(e.target.value),
                      })
                    }
                    placeholder="0"
                    className={INPUT_ROSE}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <Select
                    value={form.status || "active"}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {offlineModeActive && (
                <div className="rounded-xl border bg-amber-500/10 p-3 text-sm text-amber-700">
                  Customer will be saved locally first and synced when internet
                  returns.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                className={BTN_WARNING}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={create.isPending || update.isPending || !!savingId}
                className={BTN_PRIMARY}
              >
                {savingId
                  ? "Saving..."
                  : editCustomer
                    ? "Update"
                    : "Add Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!deleteCustomer}
          onOpenChange={() => setDeleteCustomer(null)}
        >
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>Archive Customer</DialogTitle>
              <DialogDescription>
                Archive "{deleteCustomer?.name}"? The customer will be moved to
                inactive status and hidden from the default active list.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                className={BTN_WARNING}
                onClick={() => setDeleteCustomer(null)}
              >
                Cancel
              </Button>

              <Button
                className={BTN_DANGER}
                onClick={handleDelete}
                disabled={update.isPending}
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
