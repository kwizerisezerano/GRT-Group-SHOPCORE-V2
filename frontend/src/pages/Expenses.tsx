import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { formatCurrency } from "@/utils/currency";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CreditCard,
  Search,
  Plus,
  Eye,
  MoreHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wallet,
  AlertTriangle,
  Tags,
  Building2,
  Receipt,
  PieChart,
  Layers3,
  ShieldCheck,
  CalendarDays,
  Wifi,
  WifiOff,
  UploadCloud,
  Database,
  RotateCcw,
} from "lucide-react";
import { expenseCategories } from "@/data/mockExpenses";
import {
  useExpenses,
  useExpenseMutations,
  type DbExpense,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { toast } from "sonner";
import warehouseBg from "@/assets/bg-warehouse.jpg";

const SHOPCORE_BLUE = "#2563eb";

const BTN_PRIMARY = "bg-blue-600 text-white hover:bg-blue-700 border-blue-600";
const BTN_SUCCESS = "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600";
const BTN_WARNING = "bg-orange-600 text-white hover:bg-orange-700 border-orange-600";
const BTN_INFO = "bg-cyan-600 text-white hover:bg-cyan-700 border-cyan-600";
const BTN_DANGER = "bg-rose-600 text-white hover:bg-rose-700 border-rose-600";
const BTN_PURPLE = "bg-violet-600 text-white hover:bg-violet-700 border-violet-600";

const statusColors: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  pending: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  rejected: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  deleted: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  pending_sync: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  pending_update: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  pending_delete: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

const PAGE_SIZE = 10;
type SortKey = "title" | "amount" | "category" | "date" | "status";
type DateFilter = "all" | "today" | "week" | "month" | "year";

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

function getExpenseDate(expense: any) {
  return expense?.date || expense?.created_offline_at || expense?.created_at || new Date().toISOString();
}

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

function dedupeExpenses(expenses: any[]) {
  const map = new Map<string, any>();

  for (const expense of expenses || []) {
    const key = String(
      expense.id ||
        expense.offline_id ||
        expense.reference ||
        `${expense.title}-${expense.amount}-${expense.date}` ||
        Math.random()
    );

    const existing = map.get(key);
    if (!existing) {
      map.set(key, expense);
      continue;
    }

    const existingTime = new Date(
      existing.updated_offline_at ||
        existing.updated_at ||
        existing.created_offline_at ||
        existing.created_at ||
        0
    ).getTime();

    const incomingTime = new Date(
      expense.updated_offline_at ||
        expense.updated_at ||
        expense.created_offline_at ||
        expense.created_at ||
        0
    ).getTime();

    map.set(
      key,
      incomingTime >= existingTime
        ? { ...existing, ...expense }
        : { ...expense, ...existing }
    );
  }

  return Array.from(map.values()).filter((expense) => !isPendingDelete(expense)) as DbExpense[];
}

function normalizeExpensePayload(form: Partial<DbExpense>) {
  return {
    title: String(form.title || "").trim(),
    amount: safeNumber(form.amount),
    category: form.category || "Miscellaneous",
    paid_to: form.paid_to || "",
    payment_method: form.payment_method || "cash",
    branch: form.branch || "Main Store",
    is_recurring: Boolean(form.is_recurring),
    notes: form.notes || null,
    status: form.status || "pending",
  };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isExpenseInDateFilter(expense: any, filter: DateFilter) {
  if (filter === "all") return true;

  const value = new Date(getExpenseDate(expense));
  if (Number.isNaN(value.getTime())) return false;

  const now = new Date();
  if (filter === "today") return isSameDay(value, now);

  if (filter === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return value >= start && value < end;
  }

  if (filter === "month") {
    return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
  }

  if (filter === "year") {
    return value.getFullYear() === now.getFullYear();
  }

  return true;
}

function getExpenseMonthLabel(expense: any) {
  const date = new Date(getExpenseDate(expense));
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export default function Expenses() {
  const { user, tenantId, session } = useAuth();
  const qc = useQueryClient();
  const { data: expenses = [], isLoading } = useExpenses();
  const { create, update, remove } = useExpenseMutations();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const [viewExpense, setViewExpense] = useState<DbExpense | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<DbExpense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<DbExpense | null>(null);
  const [form, setForm] = useState<Partial<DbExpense>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const offlineModeActive = !isOnline() || isOfflineMode();
  const canUseOnlineSupabase = isOnline() && !!session?.access_token && !isOfflineMode();

  const cleanExpenses = useMemo(() => dedupeExpenses(expenses as any[]), [expenses]);

  const paymentMethods = useMemo(() => {
    const set = new Set<string>(["cash", "card", "bank", "mobile"]);
    cleanExpenses.forEach((expense: any) => expense.payment_method && set.add(expense.payment_method));
    return Array.from(set).filter(Boolean);
  }, [cleanExpenses]);

  const filtered = useMemo(() => {
    const list = cleanExpenses.filter((e: any) => {
      const q = search.toLowerCase().trim();

      const matchSearch =
        !q ||
        (e.title || "").toLowerCase().includes(q) ||
        (e.reference || "").toLowerCase().includes(q) ||
        (e.paid_to || "").toLowerCase().includes(q) ||
        (e.branch || "").toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q);

      const matchCat = catFilter === "all" || e.category === catFilter;
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchPayment = paymentFilter === "all" || e.payment_method === paymentFilter;
      const matchDate = isExpenseInDateFilter(e, dateFilter);
      const pending = isPendingSync(e);
      const matchSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      return matchSearch && matchCat && matchStatus && matchPayment && matchDate && matchSync;
    });

    list.sort((a: any, b: any) => {
      if (sortKey === "date") {
        const av = new Date(getExpenseDate(a)).getTime();
        const bv = new Date(getExpenseDate(b)).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];

      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      return sortAsc
        ? safeNumber(av) - safeNumber(bv)
        : safeNumber(bv) - safeNumber(av);
    });

    return list;
  }, [cleanExpenses, search, catFilter, statusFilter, paymentFilter, dateFilter, syncFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const total = cleanExpenses.reduce((s, e) => s + safeNumber(e.amount), 0);

    const approved = cleanExpenses
      .filter((e) => e.status === "approved")
      .reduce((s, e) => s + safeNumber(e.amount), 0);

    const pending = cleanExpenses.filter((e) => e.status === "pending");
    const rejected = cleanExpenses.filter((e) => e.status === "rejected");

    const categoryMap = new Map<string, number>();
    cleanExpenses.forEach((e) => {
      categoryMap.set(
        e.category || "Miscellaneous",
        (categoryMap.get(e.category || "Miscellaneous") || 0) + safeNumber(e.amount)
      );
    });

    const topCategory =
      Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    const todayTotal = cleanExpenses
      .filter((expense) => isExpenseInDateFilter(expense, "today"))
      .reduce((s, e) => s + safeNumber(e.amount), 0);

    const monthTotal = cleanExpenses
      .filter((expense) => isExpenseInDateFilter(expense, "month"))
      .reduce((s, e) => s + safeNumber(e.amount), 0);

    const approvalRate = cleanExpenses.length > 0
      ? Math.round((cleanExpenses.filter((e) => e.status === "approved").length / cleanExpenses.length) * 100)
      : 0;

    const avgExpense = cleanExpenses.length > 0 ? Math.round(total / cleanExpenses.length) : 0;

    return {
      total,
      approved,
      todayTotal,
      monthTotal,
      avgExpense,
      approvalRate,
      pendingCount: pending.length,
      pendingValue: pending.reduce((s, e) => s + safeNumber(e.amount), 0),
      rejectedCount: rejected.length,
      categories: new Set(cleanExpenses.map((e) => e.category || "Miscellaneous")).size,
      recurring: cleanExpenses.filter((e) => e.is_recurring).length,
      topCategory,
      pendingSync: cleanExpenses.filter(isPendingSync).length,
      filtered: filtered.length,
    };
  }, [cleanExpenses, filtered.length]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();

    cleanExpenses.forEach((e) => {
      map.set(e.category || "Miscellaneous", (map.get(e.category || "Miscellaneous") || 0) + safeNumber(e.amount));
    });

    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [cleanExpenses]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();

    cleanExpenses.forEach((e) => {
      map.set(e.payment_method || "cash", (map.get(e.payment_method || "cash") || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [cleanExpenses]);


  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number>();
    cleanExpenses.forEach((expense) => {
      const month = getExpenseMonthLabel(expense);
      map.set(month, (map.get(month) || 0) + safeNumber(expense.amount));
    });

    const rows = Array.from(map.entries()).map(([month, amount]) => ({ month, amount }));
    const maxAmount = Math.max(...rows.map((row) => row.amount), 0);

    return rows
      .map((row) => ({ ...row, percent: maxAmount ? Math.round((row.amount / maxAmount) * 100) : 0 }))
      .slice(-6);
  }, [cleanExpenses]);

  const expenseControlCards = [
    { label: "Today", value: formatCurrency(stats.todayTotal), helper: "Current day spending", icon: CalendarDays, tone: "bg-blue-500/10 text-blue-600" },
    { label: "This Month", value: formatCurrency(stats.monthTotal), helper: "Monthly expense load", icon: Wallet, tone: "bg-rose-500/10 text-rose-600" },
    { label: "Average Expense", value: formatCurrency(stats.avgExpense), helper: "Average record value", icon: Receipt, tone: "bg-violet-500/10 text-violet-600" },
    { label: "Approval Rate", value: `${stats.approvalRate}%`, helper: "Approved record ratio", icon: ShieldCheck, tone: "bg-emerald-500/10 text-emerald-600" },
  ];

  const exportRows = filtered.map((e: any) => ({
    reference: e.reference || "",
    title: e.title || "",
    category: e.category || "",
    amount: formatCurrency(safeNumber(e.amount)),
    branch: e.branch || "",
    paid_to: e.paid_to || "",
    payment_method: e.payment_method || "",
    status: e.status || "",
    recurring: e.is_recurring ? "Yes" : "No",
    approved_by: e.approved_by || "",
    sync_status: isPendingSync(e) ? "Pending" : "Synced",
    date: formatDate(getExpenseDate(e)),
    notes: e.notes || "",
  }));

  const exportCols = [
    { key: "reference" as const, label: "Reference" },
    { key: "title" as const, label: "Title" },
    { key: "category" as const, label: "Category" },
    { key: "amount" as const, label: "Amount" },
    { key: "branch" as const, label: "Branch" },
    { key: "paid_to" as const, label: "Paid To" },
    { key: "payment_method" as const, label: "Payment" },
    { key: "status" as const, label: "Status" },
    { key: "recurring" as const, label: "Recurring" },
    { key: "approved_by" as const, label: "Approved By" },
    { key: "sync_status" as const, label: "Sync" },
    { key: "date" as const, label: "Date" },
    { key: "notes" as const, label: "Notes" },
  ];

  const topSummaryCards = [
    {
      label: "Total Expenses",
      value: formatCurrency(stats.total),
      helper: "All recorded spending",
      icon: Wallet,
      wrapper: "bg-rose-600 text-white border-rose-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Pending",
      value: stats.pendingCount,
      helper: formatCurrency(stats.pendingValue),
      icon: AlertTriangle,
      wrapper: "bg-orange-600 text-white border-orange-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Categories",
      value: stats.categories,
      helper: "Expense groups",
      icon: Tags,
      wrapper: "bg-blue-600 text-white border-blue-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
    {
      label: "Pending Sync",
      value: stats.pendingSync,
      helper: "Waiting upload",
      icon: UploadCloud,
      wrapper: "bg-cyan-600 text-white border-cyan-600",
      iconBox: "bg-white/20 text-white",
      valueColor: "text-white",
    },
  ];

  const refreshExpenseQueries = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["expenses"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({
    label,
    sortKeyName,
  }: {
    label: string;
    sortKeyName: SortKey;
  }) => (
    <button
      onClick={() => toggleSort(sortKeyName)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  const resetFilters = () => {
    setSearch("");
    setCatFilter("all");
    setStatusFilter("all");
    setPaymentFilter("all");
    setDateFilter("all");
    setSyncFilter("all");
    setPage(1);
  };

  const openCreate = () => {
    setEditExpense(null);
    setForm({
      category: "Miscellaneous",
      payment_method: "cash",
      status: "pending",
      is_recurring: false,
      branch: "Main Store",
      date: new Date().toISOString().split("T")[0],
    } as any);
    setDialogOpen(true);
  };

  const openEdit = (e: DbExpense) => {
    setEditExpense(e);
    setForm({ ...e });
    setDialogOpen(true);
  };

  const saveExpenseOffline = async (payload: any) => {
    if (!tenantId) throw new Error("No active workspace");

    const now = new Date().toISOString();
    const cachedExpenses = await getCachedTable("expenses");

    if (editExpense) {
      const isOfflineExpense = String(editExpense.id || "").startsWith("offline-") || !!(editExpense as any).offline_id;
      const updatedExpense: any = {
        ...editExpense,
        ...payload,
        id: editExpense.id,
        tenant_id: (editExpense as any).tenant_id || tenantId,
        user_id: (editExpense as any).user_id || user?.id || null,
        operation: isOfflineExpense ? "create" : "update",
        sync_status: isOfflineExpense ? "pending" : "pending_update",
        updated_at: now,
        updated_offline_at: now,
      };

      await saveCachedTable(
        "expenses",
        dedupeExpenses([
          updatedExpense,
          ...(Array.isArray(cachedExpenses) ? cachedExpenses : []),
        ] as any)
      );

      await savePending("expenses", updatedExpense);
      toast.success("Expense updated offline. It will sync when internet returns.");
    } else {
      const offlineExpense: any = {
        ...payload,
        id: makeLocalId("offline-expense"),
        reference: `EXP-${Date.now().toString(36).toUpperCase()}`,
        tenant_id: tenantId,
        user_id: user?.id || null,
        approved_by: null,
        attachments: 0,
        operation: "create",
        sync_status: "pending",
        created_at: now,
        updated_at: now,
        created_offline_at: now,
        updated_offline_at: now,
      };

      await saveCachedTable(
        "expenses",
        dedupeExpenses([
          offlineExpense,
          ...(Array.isArray(cachedExpenses) ? cachedExpenses : []),
        ] as any)
      );

      await savePending("expenses", offlineExpense);
      toast.success("Expense saved offline. It will sync when internet returns.");
    }

    await refreshExpenseQueries();
    setDialogOpen(false);
  };

  const handleSave = async () => {
    if (!form.title || safeNumber(form.amount) <= 0) {
      toast.error("Title and amount above 0 are required");
      return;
    }

    const payload = {
      ...normalizeExpensePayload(form),
      date: (form as any).date || editExpense?.date || new Date().toISOString().split("T")[0],
    };

    try {
      setSavingId(editExpense?.id || "new");

      if (!canUseOnlineSupabase) {
        await saveExpenseOffline(payload);
        return;
      }

      if (editExpense) {
        if (String(editExpense.id || "").startsWith("offline-") || !!(editExpense as any).offline_id) {
          await saveExpenseOffline(payload);
          return;
        }

        await update.mutateAsync({
          id: editExpense.id,
          ...payload,
        } as any);

        const cachedExpenses = await getCachedTable("expenses");
        await saveCachedTable(
          "expenses",
          dedupeExpenses([
            { ...editExpense, ...payload, updated_at: new Date().toISOString() },
            ...(Array.isArray(cachedExpenses) ? cachedExpenses : []),
          ] as any)
        );

        toast.success("Expense updated successfully.");
      } else {
        const createdPayload = {
          reference: `EXP-${Date.now().toString(36).toUpperCase()}`,
          ...payload,
          approved_by: null,
          attachments: 0,
        };

        const created = await create.mutateAsync(createdPayload as any);

        const cachedExpenses = await getCachedTable("expenses");
        await saveCachedTable(
          "expenses",
          dedupeExpenses([
            { ...createdPayload, ...(created || {}) },
            ...(Array.isArray(cachedExpenses) ? cachedExpenses : []),
          ] as any)
        );

        toast.success("Expense recorded successfully.");
      }

      setDialogOpen(false);
      await refreshExpenseQueries();
    } catch (error: any) {
      console.error("Expense save failed:", error);

      if (isNetworkError(error) || !isOnline()) {
        await saveExpenseOffline(payload);
        return;
      }

      toast.error(error?.message || "Failed to save expense");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteExpense) return;

    const expense = deleteExpense as any;
    setDeleteExpense(null);

    try {
      const cachedExpenses = await getCachedTable("expenses");

      if (!canUseOnlineSupabase || String(expense.id || "").startsWith("offline-")) {
        if (String(expense.id || "").startsWith("offline-")) {
          await saveCachedTable(
            "expenses",
            (Array.isArray(cachedExpenses) ? cachedExpenses : []).filter(
              (row: any) => String(row.id) !== String(expense.id)
            )
          );
          toast.success("Offline expense removed locally.");
        } else {
          const deleted = {
            ...expense,
            operation: "delete",
            sync_status: "pending_delete",
            status: "deleted",
            updated_offline_at: new Date().toISOString(),
          };

          await savePending("expenses", deleted);
          await saveCachedTable(
            "expenses",
            (Array.isArray(cachedExpenses) ? cachedExpenses : []).map((row: any) =>
              String(row.id) === String(expense.id) ? deleted : row
            )
          );

          toast.success("Expense deletion saved offline. It will sync when internet returns.");
        }

        await refreshExpenseQueries();
        return;
      }

      const archived = {
        ...expense,
        status: "deleted",
        operation: "delete",
        sync_status: "pending_delete",
        updated_offline_at: new Date().toISOString(),
      };

      await update.mutateAsync({
        id: expense.id,
        status: "deleted",
      } as any);

      await saveCachedTable(
        "expenses",
        (Array.isArray(cachedExpenses) ? cachedExpenses : []).map((row: any) =>
          String(row.id) === String(expense.id) ? archived : row
        )
      );

      await refreshExpenseQueries();
      toast.success("Expense archived successfully.");
    } catch (error: any) {
      if (isNetworkError(error)) {
        await savePending("expenses", {
          ...expense,
          operation: "delete",
          sync_status: "pending_delete",
          status: "deleted",
          updated_offline_at: new Date().toISOString(),
        });
        toast.success("Network failed. Expense deletion saved offline.");
        await refreshExpenseQueries();
        return;
      }

      toast.error(error?.message || "Failed to delete expense");
    }
  };

  const changeExpenseStatus = async (expense: DbExpense, status: "approved" | "rejected") => {
    const approvedBy = status === "approved" ? user?.email || user?.id || "Current User" : null;

    try {
      setSavingId(expense.id);

      const patch: any = {
        status,
        approved_by: approvedBy,
      };

      if (!canUseOnlineSupabase || String(expense.id || "").startsWith("offline-")) {
        const cachedExpenses = await getCachedTable("expenses");
        const isOfflineExpense = String(expense.id || "").startsWith("offline-") || !!(expense as any).offline_id;

        const updatedExpense = {
          ...(expense as any),
          ...patch,
          operation: isOfflineExpense ? "create" : "update",
          sync_status: isOfflineExpense ? "pending" : "pending_update",
          updated_offline_at: new Date().toISOString(),
        };

        await saveCachedTable(
          "expenses",
          dedupeExpenses([
            updatedExpense,
            ...(Array.isArray(cachedExpenses) ? cachedExpenses : []),
          ] as any)
        );

        await savePending("expenses", updatedExpense);
        await refreshExpenseQueries();
        toast.success(`Expense ${status} offline. It will sync later.`);
        return;
      }

      await update.mutateAsync({
        id: expense.id,
        ...patch,
      } as any);

      const cachedExpenses = await getCachedTable("expenses");
      await saveCachedTable(
        "expenses",
        (Array.isArray(cachedExpenses) ? cachedExpenses : []).map((row: any) =>
          String(row.id) === String(expense.id) ? { ...row, ...patch } : row
        )
      );

      await refreshExpenseQueries();
      toast.success(`Expense ${status}.`);
    } catch (error: any) {
      if (isNetworkError(error)) {
        const cachedExpenses = await getCachedTable("expenses");
        const updatedExpense = {
          ...(expense as any),
          status,
          approved_by: approvedBy,
          operation: "update",
          sync_status: "pending_update",
          updated_offline_at: new Date().toISOString(),
        };

        await saveCachedTable(
          "expenses",
          dedupeExpenses([
            updatedExpense,
            ...(Array.isArray(cachedExpenses) ? cachedExpenses : []),
          ] as any)
        );

        await savePending("expenses", updatedExpense);
        await refreshExpenseQueries();
        toast.success(`Network failed. Expense ${status} offline.`);
        return;
      }

      toast.error(error?.message || `Failed to ${status} expense`);
    } finally {
      setSavingId(null);
    }
  };

  const approveExpense = (e: DbExpense) => changeExpenseStatus(e, "approved");
  const rejectExpense = (e: DbExpense) => changeExpenseStatus(e, "rejected");

  if (isLoading) {
    return (
      <PageShell title="Expenses" description="Loading...">
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageBackground image={warehouseBg} opacity={0.04}>
      <PageShell
        title="Expenses"
        description="Track business expenses, approvals, categories, recurring costs, payment activity, offline records, and spending intelligence."
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
                    {offlineModeActive ? "Expenses are using offline cache" : "Expense changes waiting to sync"}
                  </p>
                  <p className="text-sm opacity-90">
                    Pending expense records: {stats.pendingSync}. Dashboard and Reports will use local expense data immediately.
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

        <div className="rounded-3xl border border-blue-200 bg-blue-50 shadow-sm overflow-hidden mb-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.45fr]">
            <div className="relative overflow-hidden border-b border-blue-200 xl:border-b-0 xl:border-r xl:border-blue-200 bg-blue-50 p-6 lg:p-7">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-rose-500/10 blur-2xl" />
              <div className="absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-[#0b3d5c]/10 blur-2xl" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white mb-5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Expense Control
                </div>

                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                      <Layers3 className="w-8 h-8" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white" />
                  </div>

                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-cyan-950">
                      Business Expenses
                    </h1>

                    <p className="text-sm text-slate-600 mt-1 max-w-xl">
                      Monitor spending, approve requests, track recurring costs, control categories, and keep expense records working offline.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Approved
                    </div>
                    <p className="text-sm font-semibold mt-1">
                      {formatCurrency(stats.approved)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                      Top Category
                    </div>
                    <p className="text-sm font-semibold mt-1 truncate">{stats.topCategory}</p>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Rejected
                    </div>
                    <p className="text-sm font-semibold mt-1">{stats.rejectedCount} Items</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 bg-cyan-50/70 p-6 lg:p-7">
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

                  <p className="text-sm text-slate-600">{item.label}</p>

                  <p
                    className={`font-bold font-data mt-1 leading-tight tracking-tight ${item.valueColor} ${
                      String(item.value).length > 14
                        ? "text-base xl:text-lg break-words max-w-full"
                        : "text-1xl"
                    }`}
                  >
                    {item.value}
                  </p>

                  <div className="mt-4 inline-flex rounded-full bg-white/20 border border-white/30 px-3 py-1 text-[11px] text-white/80">
                    {item.helper}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-6">
          <div className="xl:col-span-4 rounded-3xl border border-emerald-200 bg-emerald-50 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Approved Spending</h3>
                <p className="text-xs text-slate-600">Confirmed business expenses</p>
              </div>
            </div>

            <p className="text-3xl font-bold font-data">
              {formatCurrency(stats.approved)}
            </p>

            <p className="text-xs text-slate-600 mt-1">
              Pending value: {formatCurrency(stats.pendingValue)}
            </p>
          </div>

          <div className="xl:col-span-8 rounded-3xl border border-violet-200 bg-violet-50 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
                <PieChart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Expense Insights</h3>
                <p className="text-xs text-slate-600">Top categories and payment activity</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600 uppercase">
                  Category Breakdown
                </p>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-600">No category data yet.</p>
                ) : (
                  categoryBreakdown.map((c) => (
                    <div key={c.category} className="flex justify-between rounded-2xl bg-blue-50 px-4 py-2">
                      <span className="text-sm">{c.category}</span>
                      <span className="font-data text-sm">{formatCurrency(c.amount)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600 uppercase">
                  Payment Methods
                </p>
                {paymentBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-600">No payment data yet.</p>
                ) : (
                  paymentBreakdown.map((p) => (
                    <div key={p.method} className="flex justify-between rounded-2xl bg-blue-50 px-4 py-2">
                      <span className="text-sm capitalize">{p.method}</span>
                      <span className="font-data text-sm">{p.count}</span>
                    </div>
                  ))
                )}

                <div className="rounded-2xl bg-amber-500/10 px-4 py-2 text-sm">
                  Top category: <span className="font-semibold">{stats.topCategory}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-6">
          <div className="xl:col-span-5 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <PieChart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Approval Control Score</h3>
                <p className="text-xs text-slate-600">Expense approval health and pending exposure</p>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div
                className="h-32 w-32 shrink-0 rounded-full p-3"
                style={{
                  background: `conic-gradient(${SHOPCORE_BLUE} ${stats.approvalRate * 3.6}deg, #dbeafe 0deg)`,
                }}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-center">
                  <div>
                    <p className="text-3xl font-black font-data">{stats.approvalRate}%</p>
                    <p className="text-[10px] uppercase text-slate-600">Approved</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 flex-1">
                {expenseControlCards.map((item) => (
                  <div key={item.label} className="rounded-2xl border bg-blue-50 p-3">
                    <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs text-slate-600">{item.label}</p>
                    <p className="font-bold font-data truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="xl:col-span-7 rounded-3xl border border-rose-200 bg-rose-50 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Monthly Spending Shape</h3>
                <p className="text-xs text-slate-600">Last available expense months from local and online records</p>
              </div>
            </div>

            <div className="space-y-3">
              {monthlyTrend.length === 0 ? (
                <div className="rounded-2xl border bg-blue-50 py-8 text-center text-sm text-slate-600">
                  No monthly expense data yet.
                </div>
              ) : (
                monthlyTrend.map((row) => (
                  <div key={row.month} className="rounded-2xl bg-blue-50 p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{row.month}</span>
                      <span className="font-data text-slate-600">{formatCurrency(row.amount)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
                      <div className="h-full rounded-full bg-rose-500" style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-4 mb-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl border border-blue-200 bg-blue-50">
              <Search className="w-4 h-4 text-blue-700" />
              <input
                type="text"
                placeholder="Search title, reference, paid to, branch, or category..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-blue-700/70"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select
                value={catFilter}
                onValueChange={(v) => {
                  setCatFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[155px] h-11 rounded-2xl text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
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
                <SelectTrigger className="w-[135px] h-11 rounded-2xl text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={dateFilter}
                onValueChange={(v) => {
                  setDateFilter(v as DateFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[130px] h-11 rounded-2xl text-xs">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={paymentFilter}
                onValueChange={(v) => {
                  setPaymentFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[145px] h-11 rounded-2xl text-xs">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method} className="capitalize">
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={syncFilter}
                onValueChange={(v) => {
                  setSyncFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[125px] h-11 rounded-2xl text-xs">
                  <SelectValue placeholder="Sync" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sync</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="ghost" className={`h-11 rounded-2xl ${BTN_WARNING}`} onClick={resetFilters}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>

              <ExportMenu
                onCSV={() => exportToCSV(exportRows, "expenses", exportCols)}
                onPDF={() =>
                  exportToPDF(exportRows, "expenses", "Expenses Report", exportCols, {
                    subtitle: `${filtered.length} expense records`,
                    summary: [
                      { label: "Total Expenses", value: formatCurrency(stats.total) },
                      { label: "Approved", value: formatCurrency(stats.approved) },
                      { label: "Pending", value: `${stats.pendingCount} (${formatCurrency(stats.pendingValue)})` },
                      { label: "Rejected", value: String(stats.rejectedCount) },
                      { label: "Pending Sync", value: String(stats.pendingSync) },
                    ],
                  })
                }
              />

              <Button
                className={`h-11 rounded-2xl ${BTN_PRIMARY}`}
                onClick={openCreate}
              >
                <Plus className="w-4 h-4 mr-2" />
                Record Expense
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-data text-xs">Ref</TableHead>
                <TableHead>
                  <SortHeader label="Title" sortKeyName="title" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Category" sortKeyName="category" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Amount" sortKeyName="amount" />
                </TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Paid To</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>
                  <SortHeader label="Status" sortKeyName="status" />
                </TableHead>
                <TableHead>Sync</TableHead>
                <TableHead>
                  <SortHeader label="Date" sortKeyName="date" />
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-slate-600">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No expenses found
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((e: any) => (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer hover:bg-blue-50/70"
                    onClick={() => setViewExpense(e)}
                  >
                    <TableCell className="font-data text-xs text-slate-600">
                      {e.reference}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{e.title}</span>
                        {e.is_recurring && <RefreshCw className="w-3 h-3 text-violet-600" />}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] rounded-full border-blue-200 bg-blue-50 text-blue-700">
                        {e.category}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-data text-sm font-medium">
                      {formatCurrency(safeNumber(e.amount))}
                    </TableCell>

                    <TableCell className="text-sm text-slate-600">
                      <Building2 className="w-3 h-3 inline mr-1 text-amber-600" />
                      {e.branch}
                    </TableCell>

                    <TableCell className="text-sm">{e.paid_to}</TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] capitalize rounded-full border-cyan-200 bg-cyan-50 text-cyan-700">
                        {e.payment_method}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize rounded-full ${
                          statusColors[e.status] || statusColors.pending
                        }`}
                      >
                        {e.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`gap-1 rounded-full text-[10px] ${
                          isPendingSync(e)
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        }`}
                      >
                        {isPendingSync(e) ? <UploadCloud className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                        {isPendingSync(e) ? "Pending" : "Synced"}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-data text-xs text-slate-600">
                      {formatDate(getExpenseDate(e))}
                    </TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={savingId === e.id}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setViewExpense(e);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-2" />
                            View
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openEdit(e);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>

                          {e.status === "pending" && (
                            <>
                              <DropdownMenuItem
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  approveExpense(e);
                                }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                Approve
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  rejectExpense(e);
                                }}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setDeleteExpense(e);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-slate-600">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    variant={n === currentPage ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setPage(n)}
                    style={n === currentPage ? { background: SHOPCORE_BLUE } : undefined}
                  >
                    {n}
                  </Button>
                ))}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <Dialog open={!!viewExpense} onOpenChange={() => setViewExpense(null)}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                {viewExpense?.title}
              </DialogTitle>
              <DialogDescription>
                {viewExpense?.reference} · {formatDate(getExpenseDate(viewExpense))}
              </DialogDescription>
            </DialogHeader>

            {viewExpense && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-gradient-to-br from-rose-500 to-[#0b3d5c] text-white p-5 text-center">
                  <p className="text-3xl font-bold font-data">
                    {formatCurrency(safeNumber(viewExpense.amount))}
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    <Badge
                      variant="outline"
                      className="capitalize bg-white/10 border-white/20 text-white"
                    >
                      {viewExpense.status}
                    </Badge>
                    {isPendingSync(viewExpense) && (
                      <Badge
                        variant="outline"
                        className="capitalize bg-white/10 border-white/20 text-white"
                      >
                        Pending Sync
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-600">Category</p>
                    <p>{viewExpense.category}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">Branch</p>
                    <p>{viewExpense.branch}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">Paid To</p>
                    <p>{viewExpense.paid_to || "—"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">Payment</p>
                    <p className="capitalize">{viewExpense.payment_method}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">Recurring</p>
                    <p>{viewExpense.is_recurring ? "Yes" : "No"}</p>
                  </div>

                  {viewExpense.approved_by && (
                    <div>
                      <p className="text-xs text-slate-600">Approved By</p>
                      <p>{viewExpense.approved_by}</p>
                    </div>
                  )}
                </div>

                {viewExpense.notes && (
                  <div className="border rounded-2xl p-3 bg-blue-50 text-sm">
                    <p className="text-xs text-slate-600 mb-1">Notes</p>
                    {viewExpense.notes}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {viewExpense?.status === "pending" && (
                <>
                  <Button variant="outline" onClick={() => viewExpense && approveExpense(viewExpense)}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button variant="outline" className="text-destructive" onClick={() => viewExpense && rejectExpense(viewExpense)}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setViewExpense(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editExpense ? "Edit Expense" : "Record Expense"}</DialogTitle>
              <DialogDescription>
                {editExpense ? "Update expense details." : "Record a new business expense."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Title *</label>
                <Input
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Office Supplies"
                  className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Amount (RWF) *
                  </label>
                  <Input
                    type="number"
                    value={form.amount || ""}
                    onChange={(e) => setForm({ ...form, amount: safeNumber(e.target.value) })}
                    placeholder="0.00"
                    className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Category</label>
                  <Select
                    value={form.category || "Miscellaneous"}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Date</label>
                  <Input
                    type="date"
                    value={(form as any).date || new Date().toISOString().split("T")[0]}
                    onChange={(e) => setForm({ ...form, date: e.target.value } as any)}
                    className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Payment Method
                  </label>
                  <Select
                    value={form.payment_method || "cash"}
                    onValueChange={(v) => setForm({ ...form, payment_method: v })}
                  >
                    <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="mobile">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Paid To</label>
                  <Input
                    value={form.paid_to || ""}
                    onChange={(e) => setForm({ ...form, paid_to: e.target.value })}
                    placeholder="Vendor name"
                    className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Branch</label>
                  <Input
                    value={form.branch || ""}
                    onChange={(e) => setForm({ ...form, branch: e.target.value })}
                    placeholder="Main Store"
                    className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Status</label>
                <Select
                  value={form.status || "pending"}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Recurring</label>
                <Select
                  value={form.is_recurring ? "yes" : "no"}
                  onValueChange={(v) => setForm({ ...form, is_recurring: v === "yes" })}
                >
                  <SelectTrigger className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">One-time Expense</SelectItem>
                    <SelectItem value="yes">Recurring Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Notes</label>
                <Input
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="rounded-xl border-blue-200 bg-blue-50/60 placeholder:text-blue-700/60"
                />
              </div>

              {offlineModeActive && (
                <div className="rounded-2xl border bg-amber-500/10 p-3 text-sm text-amber-700">
                  Expense will be saved locally first and synced when internet returns.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button className={BTN_WARNING} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={create.isPending || update.isPending || !!savingId}
                className={BTN_PRIMARY}
              >
                {savingId ? "Saving..." : editExpense ? "Update" : "Record Expense"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteExpense} onOpenChange={() => setDeleteExpense(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Archive Expense</DialogTitle>
              <DialogDescription>
                Are you sure you want to archive "{deleteExpense?.title}"? Archived expenses are hidden from active views while history stays protected.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button className={BTN_WARNING} onClick={() => setDeleteExpense(null)}>
                Cancel
              </Button>

              <Button
                className={BTN_DANGER}
                onClick={handleDelete}
                disabled={remove.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </PageBackground>
  );
}
