import { useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Star,
  MapPin,
  Phone,
  Mail,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Store,
  Warehouse,
  Clock,
  BadgeCheck,
  ShieldCheck,
  Search,
  RotateCcw,
  Eye,
  MoreHorizontal,
  Download,
  Printer,
  UploadCloud,
  AlertTriangle,
  XCircle,
  CalendarDays,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { branchesApi, expensesApi, purchasesApi, salesApi } from "@/lib/apiClient";
import UpgradeRequired from "@/components/UpgradeRequired";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import {
  PageContainer,
  PageToolbar,
  StatGrid,
  SectionCard,
  TablePagination,  EmptyState,
  type StatItem,
} from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ExportMenu";
import { PageSkeleton } from "@/components/skeletons";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/currency";
import { isOnline, getCachedTable, saveCachedTable, savePending, isNetworkError } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import {
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

const NAVY = "hsl(var(--primary))";
const PAGE_SIZE = 9;

const PIE_COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#14b8a6", "#fb923c"];

const branchChartConfig: ChartConfig = {
  revenue: { label: "Revenue" },
  transactions: { label: "Transactions" },
  expenses: { label: "Expenses" },
  purchases: { label: "Purchases" },
};

type SortKey = "name" | "revenue" | "transactions" | "averageSale" | "health" | "created_at";

interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  manager: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  status: string | null;
  created_at: string;
  type: string | null;
  opening_date: string | null;
  operating_hours: string | null;
  tax_number: string | null;
  notes: string | null;
  is_default: boolean | null;
  operation?: string | null;
  sync_status?: string | null;
  offline_id?: string | null;
  created_offline_at?: string | null;
  updated_offline_at?: string | null;
}

interface Sale {
  id: string;
  tenant_id: string;
  branch: string | null;
  total: number | null;
  subtotal?: number | null;
  gross_profit?: number | null;
  profit?: number | null;
  net_profit?: number | null;
  cost_total?: number | null;
  status?: string | null;
  created_at: string;
}

type AnyRow = Record<string, any>;

interface BranchPerformance {
  branch: Branch;
  revenue: number;
  profit: number;
  expenses: number;
  purchases: number;
  transactions: number;
  averageSale: number;
  netPosition: number;
  health: number;
}

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

function withTimeout<T>(
  operation: PromiseLike<T>,
  message = "Operation timed out",
  timeoutMs = 12000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    Promise.resolve(operation).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }),
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeText(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getBranchKey(value?: string | null) {
  return normalizeText(value || "Unassigned");
}

function getBranchIcon(type?: string | null) {
  const normalized = (type || "store").toLowerCase();
  if (normalized.includes("warehouse")) return Warehouse;
  if (normalized.includes("outlet")) return Store;
  return Building2;
}

function getBranchStatus(value?: string | null) {
  return String(value || "active").toLowerCase();
}

function getStatusClass(value?: string | null) {
  const status = getBranchStatus(value);
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
  if (status === "inactive") return "border-rose-500/30 bg-rose-500/10 text-rose-600";
  if (status.includes("maintenance")) return "border-amber-500/30 bg-amber-500/10 text-amber-600";
  return "border-primary/30 bg-primary/10 text-muted-foreground";
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

function dedupeBranches(rows: any[]) {
  const map = new Map<string, Branch>();

  for (const row of rows || []) {
    if (!row || isPendingDelete(row)) continue;

    const key = String(row.id || row.offline_id || row.code || row.name || Math.random());
    const existing = map.get(key);

    if (!existing) {
      map.set(key, row as Branch);
      continue;
    }

    const existingTime = new Date(existing.updated_offline_at || existing.created_at || 0).getTime();
    const incomingTime = new Date(row.updated_offline_at || row.created_at || 0).getTime();

    map.set(key, incomingTime >= existingTime ? { ...existing, ...row } : { ...row, ...existing });
  }

  return Array.from(map.values());
}

function getSaleTotal(sale: any) {
  const status = String(sale?.status || "").toLowerCase();
  if (status.includes("cancel") || status.includes("refund") || status.includes("void")) return 0;
  return Math.max(0, safeNumber(sale?.total ?? sale?.grand_total ?? sale?.amount ?? sale?.subtotal));
}

function getSaleProfit(sale: any) {
  const total = getSaleTotal(sale);
  const storedProfit = safeNumber(sale?.gross_profit ?? sale?.profit ?? sale?.net_profit);
  if (storedProfit > 0) return storedProfit;
  const cost = safeNumber(sale?.cost_total ?? sale?.cogs_total ?? sale?.total_cost);
  return cost > 0 ? Math.max(0, total - cost) : 0;
}

function calcBranchHealth(branch: Branch) {
  let score = 0;
  if (branch.name) score += 15;
  if (branch.manager) score += 15;
  if (branch.phone) score += 12;
  if (branch.email) score += 10;
  if (branch.address || branch.city) score += 12;
  if (branch.operating_hours) score += 12;
  if (branch.tax_number) score += 10;
  if (getBranchStatus(branch.status) === "active") score += 14;
  return Math.min(100, score);
}

function getHealthLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Needs Work";
  return "Critical";
}

function getHealthClass(score: number) {
  if (score >= 85) return "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
  if (score >= 65) return "text-muted-foreground bg-primary/10 border-primary/30";
  if (score >= 45) return "text-amber-600 bg-amber-500/10 border-amber-500/30";
  return "text-rose-600 bg-rose-500/10 border-rose-500/30";
}

function normalizePayload(form: {
  name: string;
  code: string;
  manager: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  status: string;
  type: string;
  openingDate: string;
  operatingHours: string;
  taxNumber: string;
  notes: string;
  isDefault: boolean;
}) {
  return {
    name: form.name.trim(),
    code: form.code.trim() || null,
    manager: form.manager.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    city: form.city.trim() || null,
    status: form.status || "active",
    type: form.type.trim() || "store",
    opening_date: form.openingDate || null,
    operating_hours: form.operatingHours.trim() || null,
    tax_number: form.taxNumber.trim() || null,
    notes: form.notes.trim() || null,
    is_default: form.isDefault,
  };
}

export default function Branches() {
  const {
    user,
    tenantId,
    session,
    refreshEntitlements,
  } = useAuth();
  const queryClient = useQueryClient();

  const branchPlanAccess = usePlanAccess(
    "branches",
    "branches",
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [viewBranch, setViewBranch] = useState<Branch | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [manager, setManager] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("active");
  const [type, setType] = useState("store");
  const [openingDate, setOpeningDate] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const offlineModeActive = !isOnline() || isOfflineMode();
  // Named for Supabase until this page stopped using it. The gate itself was
  // always about having a live session and a working connection, not about
  // which backend answered.
  const canUseOnline = isOnline() && !!session?.access_token && !isOfflineMode();

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches", tenantId, canUseOnline ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    refetchOnReconnect: canUseOnline,
    refetchOnWindowFocus: canUseOnline,
    queryFn: async () => {
      if (!tenantId) return [] as Branch[];
      const cachedBranches = await getCachedTable("branches");

      if (!canUseOnline) {
        return dedupeBranches(Array.isArray(cachedBranches) ? cachedBranches : []);
      }

      try {
        const { data } = await withTimeout<any>(
          branchesApi.list(),
          "Branch list request timed out"
        );

        const merged = dedupeBranches([...(data || []), ...(Array.isArray(cachedBranches) ? cachedBranches : [])]);
        await saveCachedTable("branches", merged);
        return merged;
      } catch (error: any) {
        if (isNetworkError(error)) return dedupeBranches(Array.isArray(cachedBranches) ? cachedBranches : []);
        throw error;
      }
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["branch-sales", tenantId, canUseOnline ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    queryFn: async () => {
      const cachedSales = await getCachedTable("sales");
      if (!canUseOnline) return Array.isArray(cachedSales) ? cachedSales : [];

      try {
        const { data } = await withTimeout<any>(salesApi.list(), "Branch sales request timed out");
        await saveCachedTable("sales", Array.isArray(data) ? data : []);
        return data as Sale[];
      } catch (error: any) {
        if (isNetworkError(error)) return Array.isArray(cachedSales) ? cachedSales : [];
        throw error;
      }
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["branch-expenses-lite", tenantId, canUseOnline ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    queryFn: async () => {
      const cachedExpenses = await getCachedTable("expenses");
      if (!canUseOnline) return Array.isArray(cachedExpenses) ? cachedExpenses : [];

      try {
        const { data } = await withTimeout<any>(
          expensesApi.list(),
          "Branch expenses request timed out"
        );
        await saveCachedTable("expenses", Array.isArray(data) ? data : []);
        return data || [];
      } catch {
        return Array.isArray(cachedExpenses) ? cachedExpenses : [];
      }
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["branch-purchases-lite", tenantId, canUseOnline ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    queryFn: async () => {
      const cachedPurchases = await getCachedTable("purchases");
      if (!canUseOnline) return Array.isArray(cachedPurchases) ? cachedPurchases : [];

      try {
        const { data } = await withTimeout<any>(
          purchasesApi.list(),
          "Branch purchases request timed out"
        );
        await saveCachedTable("purchases", Array.isArray(data) ? data : []);
        return data || [];
      } catch {
        return Array.isArray(cachedPurchases) ? cachedPurchases : [];
      }
    },
  });

  const cleanBranches = useMemo<Branch[]>(() => dedupeBranches(Array.isArray(branches) ? (branches as Branch[]) : []), [branches]);

  const branchLimit = branchPlanAccess.limit;
  const effectiveBranchUsage = cleanBranches.length;
  const branchLimitValue = branchLimit?.value ?? null;
  const branchesUnlimited = !branchLimit || branchLimit.is_unlimited;

  const effectiveRemainingBranches =
    branchesUnlimited || branchLimitValue === null
      ? null
      : Math.max(branchLimitValue - effectiveBranchUsage, 0);

  const branchCapacityReached =
    !branchesUnlimited &&
    branchLimitValue !== null &&
    effectiveBranchUsage >= branchLimitValue;

  const branchFeatureAvailable =
    branchPlanAccess.workspaceActive &&
    branchPlanAccess.decision.allowed;

  const canCreateNewBranch =
    branchFeatureAvailable &&
    !branchCapacityReached &&
    !branchPlanAccess.loading;

  const branchRestrictionReason = !branchFeatureAvailable
    ? branchPlanAccess.reason ||
      "Branch Management is not available for the current subscription."
    : branchCapacityReached
      ? `The current subscription allows ${branchLimitValue ?? 0} branch${
          branchLimitValue === 1 ? "" : "es"
        }, and that capacity has been reached.`
      : null;

  const salesRows = useMemo<AnyRow[]>(() => (Array.isArray(sales) ? (sales as AnyRow[]) : []), [sales]);
  const expenseRows = useMemo<AnyRow[]>(() => (Array.isArray(expenses) ? (expenses as AnyRow[]) : []), [expenses]);
  const purchaseRows = useMemo<AnyRow[]>(() => (Array.isArray(purchases) ? (purchases as AnyRow[]) : []), [purchases]);

  const branchPerformance = useMemo<BranchPerformance[]>(() => {
    return cleanBranches.map((branch): BranchPerformance => {
      const branchKey = getBranchKey(branch.name);
      const branchSales = salesRows.filter((sale) => getBranchKey(String(sale.branch || "")) === branchKey);
      const branchExpenses = expenseRows.filter((expense) => getBranchKey(String(expense.branch || "")) === branchKey);
      const branchPurchases = purchaseRows.filter((purchase) => getBranchKey(String(purchase.branch || "")) === branchKey);

      const revenue = branchSales.reduce<number>((sum, sale) => sum + getSaleTotal(sale), 0);
      const profit = branchSales.reduce<number>((sum, sale) => sum + getSaleProfit(sale), 0);
      const expenseValue = branchExpenses.reduce<number>((sum, expense) => sum + safeNumber(expense.amount), 0);
      const purchaseValue = branchPurchases.reduce<number>((sum, purchase) => sum + safeNumber(purchase.total), 0);
      const transactions = branchSales.filter((sale) => getSaleTotal(sale) > 0).length;
      const averageSale = transactions > 0 ? revenue / transactions : 0;
      const netPosition = profit - expenseValue;
      const health = calcBranchHealth(branch);

      return {
        branch,
        revenue,
        profit,
        expenses: expenseValue,
        purchases: purchaseValue,
        transactions,
        averageSale,
        netPosition,
        health,
      };
    });
  }, [cleanBranches, salesRows, expenseRows, purchaseRows]);

  const totals = useMemo(() => {
    const totalRevenue = branchPerformance.reduce<number>((sum, item) => sum + safeNumber(item.revenue), 0);
    const totalProfit = branchPerformance.reduce<number>((sum, item) => sum + safeNumber(item.profit), 0);
    const totalExpenses = branchPerformance.reduce<number>((sum, item) => sum + safeNumber(item.expenses), 0);
    const totalPurchases = branchPerformance.reduce<number>((sum, item) => sum + safeNumber(item.purchases), 0);
    const totalTransactions = branchPerformance.reduce<number>((sum, item) => sum + safeNumber(item.transactions), 0);
    const activeBranches = cleanBranches.filter((branch) => getBranchStatus(branch.status) === "active").length;
    const inactiveBranches = cleanBranches.filter((branch) => getBranchStatus(branch.status) === "inactive").length;
    const pendingSync = cleanBranches.filter(isPendingSync).length;
    const healthTotal = branchPerformance.reduce<number>((sum, item) => sum + safeNumber(item.health), 0);
    const avgHealth = cleanBranches.length ? Math.round(healthTotal / cleanBranches.length) : 0;
    const averageSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    return { totalRevenue, totalProfit, totalExpenses, totalPurchases, totalTransactions, activeBranches, inactiveBranches, pendingSync, avgHealth, averageSale };
  }, [branchPerformance, cleanBranches]);

  const defaultBranch = cleanBranches.find((branch) => branch.is_default);
  const topBranch = useMemo<BranchPerformance | undefined>(() => [...branchPerformance].sort((a, b) => safeNumber(b.revenue) - safeNumber(a.revenue))[0], [branchPerformance]);
  const lowestBranch = useMemo<BranchPerformance | undefined>(() => [...branchPerformance].filter((i) => safeNumber(i.transactions) > 0 || safeNumber(i.revenue) > 0).sort((a, b) => safeNumber(a.revenue) - safeNumber(b.revenue))[0], [branchPerformance]);

  const uniqueTypes = useMemo<string[]>(() => [...new Set(cleanBranches.map((b) => String(b.type || "store")).filter(Boolean))], [cleanBranches]);

  const filteredPerformance = useMemo<BranchPerformance[]>(() => {
    const q = search.toLowerCase().trim();
    const rows = branchPerformance.filter((item) => {
      const b = item.branch;
      const matchesSearch =
        !q ||
        (b.name || "").toLowerCase().includes(q) ||
        (b.code || "").toLowerCase().includes(q) ||
        (b.manager || "").toLowerCase().includes(q) ||
        (b.city || "").toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q) ||
        (b.email || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || getBranchStatus(b.status) === statusFilter;
      const matchesType = typeFilter === "all" || (b.type || "store") === typeFilter;
      const pending = isPendingSync(b);
      const matchesSync = syncFilter === "all" || (syncFilter === "pending" && pending) || (syncFilter === "synced" && !pending);
      return matchesSearch && matchesStatus && matchesType && matchesSync;
    });

    rows.sort((a, b) => {
      if (sortKey === "created_at") {
        const av = new Date(a.branch.created_at || 0).getTime();
        const bv = new Date(b.branch.created_at || 0).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "name") {
        return sortAsc ? a.branch.name.localeCompare(b.branch.name) : b.branch.name.localeCompare(a.branch.name);
      }

      const av = safeNumber((a as any)[sortKey]);
      const bv = safeNumber((b as any)[sortKey]);
      return sortAsc ? av - bv : bv - av;
    });

    return rows;
  }, [branchPerformance, search, statusFilter, typeFilter, syncFilter, sortKey, sortAsc]);

  const statCards: StatItem[] = [
    {
      label: "All Branches",
      value: cleanBranches.length,
      icon: Building2,
      tone: "indigo",
      helper: "location records",
    },
    {
      label: "Active",
      value: totals.activeBranches,
      icon: BadgeCheck,
      tone: "emerald",
      helper: "operating now",
    },
    {
      label: "Inactive",
      value: totals.inactiveBranches,
      icon: XCircle,
      tone: totals.inactiveBranches > 0 ? "amber" : "sky",
      helper: "needs review",
    },
    {
      label: "Revenue",
      value: formatCurrency(totals.totalRevenue),
      icon: DollarSign,
      tone: "violet",
      helper: "branch sales",
    },
    {
      label: "Pending Sync",
      value: totals.pendingSync,
      icon: UploadCloud,
      tone: totals.pendingSync > 0 ? "amber" : "cyan",
      helper: "offline queue",
    },
  ];

  const totalPages = Math.max(1, Math.ceil(filteredPerformance.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPerformance = filteredPerformance.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const revenuePieData = useMemo<{ name: string; value: number }[]>(
    () => branchPerformance.filter((item) => safeNumber(item.revenue) > 0).map((item) => ({ name: item.branch.name, value: safeNumber(item.revenue) })).sort((a, b) => safeNumber(b.value) - safeNumber(a.value)).slice(0, 8),
    [branchPerformance]
  );

  const performanceChartData = useMemo<Array<{ name: string; revenue: number; expenses: number; purchases: number; transactions: number }>>(
    () => branchPerformance.map((item) => ({
      name: item.branch.name.length > 18 ? `${item.branch.name.slice(0, 18)}…` : item.branch.name,
      revenue: item.revenue,
      expenses: item.expenses,
      purchases: item.purchases,
      transactions: item.transactions,
    })).sort((a, b) => safeNumber(b.revenue) - safeNumber(a.revenue)).slice(0, 8),
    [branchPerformance]
  );

  const exportRows = filteredPerformance.map((item) => ({
    name: item.branch.name,
    code: item.branch.code || "",
    type: item.branch.type || "store",
    status: item.branch.status || "active",
    manager: item.branch.manager || "",
    phone: item.branch.phone || "",
    email: item.branch.email || "",
    city: item.branch.city || "",
    default: item.branch.is_default ? "Yes" : "No",
    revenue: formatCurrency(item.revenue),
    profit: formatCurrency(item.profit),
    expenses: formatCurrency(item.expenses),
    purchases: formatCurrency(item.purchases),
    transactions: item.transactions,
    average_sale: formatCurrency(item.averageSale),
    health: `${item.health}%`,
    sync_status: isPendingSync(item.branch) ? "Pending" : "Synced",
  }));

  const exportCols = [
    { key: "name" as const, label: "Branch" },
    { key: "code" as const, label: "Code" },
    { key: "type" as const, label: "Type" },
    { key: "status" as const, label: "Status" },
    { key: "manager" as const, label: "Manager" },
    { key: "phone" as const, label: "Phone" },
    { key: "email" as const, label: "Email" },
    { key: "city" as const, label: "City" },
    { key: "revenue" as const, label: "Revenue" },
    { key: "profit" as const, label: "Profit" },
    { key: "expenses" as const, label: "Expenses" },
    { key: "purchases" as const, label: "Purchases" },
    { key: "transactions" as const, label: "Transactions" },
    { key: "average_sale" as const, label: "Average Sale" },
    { key: "health" as const, label: "Health" },
    { key: "sync_status" as const, label: "Sync" },
  ];

  const refreshBranchQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["branches"] }),
      queryClient.invalidateQueries({ queryKey: ["branch-sales"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]).catch(() => undefined);

    if (!isOfflineMode()) {
      await refreshEntitlements().catch((error) => {
        console.warn("Branch capacity could not be refreshed:", error);
      });
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const assertBranchCreationAllowed = () => {
    if (editing) return;

    if (branchPlanAccess.loading) {
      throw new Error(
        "Subscription access is still being checked. Please try again in a moment.",
      );
    }

    if (!branchFeatureAvailable) {
      throw new Error(
        branchRestrictionReason ||
          "Branch creation is not available for the current subscription.",
      );
    }

    if (branchCapacityReached) {
      throw new Error(
        branchRestrictionReason ||
          "The branch allowance for the current subscription has been reached.",
      );
    }
  };

  const saveBranchOffline = async (payload: any) => {
    if (!tenantId) throw new Error("No active workspace");
    if (!editing) assertBranchCreationAllowed();
    const now = new Date().toISOString();
    const cachedBranches = await getCachedTable("branches");

    let nextRows: Branch[];

    if (editing) {
      const isOfflineBranch = String(editing.id || "").startsWith("offline-") || !!editing.offline_id;
      const updatedBranch: Branch = {
        ...editing,
        ...payload,
        id: editing.id,
        tenant_id: editing.tenant_id || tenantId,
        operation: isOfflineBranch ? "create" : "update",
        sync_status: isOfflineBranch ? "pending" : "pending_update",
        updated_offline_at: now,
      };
      nextRows = dedupeBranches([updatedBranch, ...(Array.isArray(cachedBranches) ? cachedBranches : [])]);
      await savePending("branches", updatedBranch);
      toast.success("Branch updated offline. It will sync when internet returns.");
    } else {
      const offlineBranch: Branch = {
        ...payload,
        id: makeLocalId("offline-branch"),
        tenant_id: tenantId,
        created_at: now,
        operation: "create",
        sync_status: "pending",
        created_offline_at: now,
        updated_offline_at: now,
      };
      nextRows = dedupeBranches([offlineBranch, ...(Array.isArray(cachedBranches) ? cachedBranches : [])]);
      await savePending("branches", offlineBranch);
      toast.success("Branch saved offline. It will sync when internet returns.");
    }

    if (payload.is_default) {
      nextRows = nextRows.map((row) => (row.name === payload.name ? row : { ...row, is_default: false }));
    }

    await saveCachedTable("branches", nextRows);
    closeDialog();
    await refreshBranchQueries();
  };

  const createBranch = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      assertBranchCreationAllowed();
      if (!name.trim()) throw new Error("Branch name is required");
      const payload = normalizePayload({ name, code, manager, phone, email, address, city, status, type, openingDate, operatingHours, taxNumber, notes, isDefault });

      if (!canUseOnline) {
        await saveBranchOffline(payload);
        return;
      }

      /*
       * No manual "clear the other defaults" pass any more. That was two
       * writes with no atomicity — if the insert then failed its unique-name
       * check, the workspace was left with no default at all. The server does
       * both in one transaction now, so this sends one request.
       */
      const { data } = await withTimeout<any>(
        branchesApi.create(payload as Record<string, unknown>),
        "Branch save request timed out"
      );

      const cachedBranches = await getCachedTable("branches");
      await saveCachedTable("branches", dedupeBranches([data, ...(Array.isArray(cachedBranches) ? cachedBranches : [])]));
    },
    onSuccess: async () => {
      await refreshBranchQueries();
      toast.success("Branch added successfully.");
      closeDialog();
    },
    onError: async (error: any) => {
      if (isNetworkError(error) || !isOnline()) {
        const payload = normalizePayload({ name, code, manager, phone, email, address, city, status, type, openingDate, operatingHours, taxNumber, notes, isDefault });
        await saveBranchOffline(payload);
        return;
      }
      toast.error(error?.message || "Failed to add branch");
    },
  });

  const updateBranch = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!editing) throw new Error("No branch selected");
      if (!name.trim()) throw new Error("Branch name is required");
      const payload = normalizePayload({ name, code, manager, phone, email, address, city, status, type, openingDate, operatingHours, taxNumber, notes, isDefault });

      if (!canUseOnline || String(editing.id || "").startsWith("offline-") || !!editing.offline_id) {
        await saveBranchOffline(payload);
        return;
      }

      const { data } = await withTimeout<any>(
        branchesApi.update(String(editing.id), payload as Record<string, unknown>),
        "Branch update request timed out"
      );

      const cachedBranches = await getCachedTable("branches");
      await saveCachedTable("branches", dedupeBranches([data, ...(Array.isArray(cachedBranches) ? cachedBranches : [])]));
    },
    onSuccess: async () => {
      await refreshBranchQueries();
      toast.success("Branch updated successfully.");
      closeDialog();
    },
    onError: async (error: any) => {
      if (isNetworkError(error) || !isOnline()) {
        const payload = normalizePayload({ name, code, manager, phone, email, address, city, status, type, openingDate, operatingHours, taxNumber, notes, isDefault });
        await saveBranchOffline(payload);
        return;
      }
      toast.error(error?.message || "Failed to update branch");
    },
  });

  const deleteBranch = useMutation({
    mutationFn: async (branch: Branch) => {
      if (!tenantId) throw new Error("No active workspace");
      const cachedBranches = await getCachedTable("branches");

      if (!canUseOnline || String(branch.id || "").startsWith("offline-")) {
        if (String(branch.id || "").startsWith("offline-")) {
          await saveCachedTable("branches", (Array.isArray(cachedBranches) ? cachedBranches : []).filter((row: any) => String(row.id) !== String(branch.id)));
          return;
        }

        const deleted = { ...branch, operation: "delete", sync_status: "pending_delete", status: "deleted", updated_offline_at: new Date().toISOString() };
        await savePending("branches", deleted);
        await saveCachedTable("branches", (Array.isArray(cachedBranches) ? cachedBranches : []).map((row: any) => String(row.id) === String(branch.id) ? deleted : row));
        return;
      }

      // Archived, not deleted: a branch with sales history behind it should
      // stop being offered without taking that history's context with it.
      await withTimeout<any>(
        branchesApi.update(String(branch.id), { status: "inactive" }),
        "Branch delete request timed out"
      );
      await saveCachedTable("branches", (Array.isArray(cachedBranches) ? cachedBranches : []).filter((row: any) => String(row.id) !== String(branch.id)));
    },
    onSuccess: async () => {
      await refreshBranchQueries();
      toast.success("Branch archived successfully.");
      setDeleteTarget(null);
    },
    onError: async (error: any, branch) => {
      if (isNetworkError(error) && branch) {
        await savePending("branches", { ...branch, operation: "delete", sync_status: "pending_delete", status: "deleted", updated_offline_at: new Date().toISOString() });
        await refreshBranchQueries();
        toast.success("Network failed. Branch deletion was queued offline.");
        setDeleteTarget(null);
        return;
      }
      toast.error(error?.message || "Failed to delete branch");
    },
  });

  const openCreate = () => {
    if (!canCreateNewBranch) {
      toast.error(
        branchRestrictionReason ||
          "The current subscription does not allow another branch.",
        { duration: 8000 },
      );
      return;
    }

    setEditing(null);
    setName("");
    setCode("");
    setManager("");
    setPhone("");
    setEmail("");
    setAddress("");
    setCity("");
    setStatus("active");
    setType("store");
    setOpeningDate("");
    setOperatingHours("");
    setTaxNumber("");
    setNotes("");
    setIsDefault(false);
    setDialogOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setName(branch.name || "");
    setCode(branch.code || "");
    setManager(branch.manager || "");
    setPhone(branch.phone || "");
    setEmail(branch.email || "");
    setAddress(branch.address || "");
    setCity(branch.city || "");
    setStatus(branch.status || "active");
    setType(branch.type || "store");
    setOpeningDate(branch.opening_date || "");
    setOperatingHours(branch.operating_hours || "");
    setTaxNumber(branch.tax_number || "");
    setNotes(branch.notes || "");
    setIsDefault(!!branch.is_default);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (editing) {
      updateBranch.mutate();
      return;
    }

    if (!canCreateNewBranch) {
      toast.error(
        branchRestrictionReason ||
          "The current subscription does not allow another branch.",
      );
      return;
    }

    createBranch.mutate();
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSyncFilter("all");
    setSortKey("revenue");
    setSortAsc(false);
    setPage(1);
  };

  const printDirectory = () => {
    const rows = exportRows.map((row) => `
      <tr>
        <td>${row.name}</td><td>${row.code}</td><td>${row.manager}</td><td>${row.phone}</td><td>${row.city}</td><td>${row.status}</td><td>${row.revenue}</td><td>${row.health}</td>
      </tr>`).join("");

    const html = `
      <html><head><title>Branch Directory</title><style>
      body{font-family:Arial;padding:28px;color:#0f172a} h1{margin:0 0 6px} p{color:#64748b} table{width:100%;border-collapse:collapse;margin-top:18px} th,td{border:1px solid #e2e8f0;padding:9px;text-align:left;font-size:12px} th{background:#f8fafc} .summary{display:flex;gap:12px;margin-top:18px}.card{border:1px solid #e2e8f0;border-radius:14px;padding:12px;min-width:150px}.value{font-weight:800;font-size:18px}</style></head>
      <body><h1>ShopCore Branch Directory</h1><p>Generated ${new Date().toLocaleString()}</p>
      <div class="summary"><div class="card"><div>Total Branches</div><div class="value">${cleanBranches.length}</div></div><div class="card"><div>Active</div><div class="value">${totals.activeBranches}</div></div><div class="card"><div>Revenue</div><div class="value">${formatCurrency(totals.totalRevenue)}</div></div></div>
      <table><thead><tr><th>Branch</th><th>Code</th><th>Manager</th><th>Phone</th><th>City</th><th>Status</th><th>Revenue</th><th>Health</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <PageShell title="Branches" description="Manage trading locations, their managers and how each branch is performing.">
        <PageSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell title="Branches" description="Manage store branches, locations, default branch, and branch performance.">
      <PageBackground image={warehouseBg} opacity={0}>
        <PageContainer>
          <PageToolbar>
            <Button variant="outline" className="h-9 rounded-xl" onClick={() => setSortAsc(!sortAsc)}>
              {sortAsc ? <TrendingUp className="mr-2 h-4 w-4" /> : <TrendingDown className="mr-2 h-4 w-4" />}
              {sortAsc ? "Asc" : "Desc"}
            </Button>

            <Button variant="ghost" className="h-9 rounded-xl text-foreground" onClick={resetFilters}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>

            <ExportMenu
              onCSV={() => exportToCSV(exportRows, "branches", exportCols)}
              onPDF={() => exportToPDF(exportRows, "branches", "Branch Operations Report", exportCols, {
                subtitle: `${filteredPerformance.length} branches`,
                summary: [
                  { label: "Total Branches", value: String(cleanBranches.length) },
                  { label: "Active", value: String(totals.activeBranches) },
                  { label: "Revenue", value: formatCurrency(totals.totalRevenue) },
                  { label: "Transactions", value: String(totals.totalTransactions) },
                  { label: "Average Health", value: `${totals.avgHealth}%` },
                ],
              })}
            />

            <Button variant="outline" className="h-9 rounded-xl" onClick={printDirectory}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>

            <Button
              type="button"
              onClick={openCreate}
              disabled={!canCreateNewBranch}
              title={branchRestrictionReason || "Create another branch"}
              className={[
                "h-10 rounded-xl px-5 font-black",
                !canCreateNewBranch
                  ? "cursor-not-allowed bg-slate-300 text-muted-foreground hover:bg-slate-300"
                  : "",
              ].join(" ")}
              style={canCreateNewBranch ? { background: NAVY } : undefined}
            >
              {branchCapacityReached ? (
                <AlertTriangle className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {branchPlanAccess.loading
                ? "Checking capacity..."
                : branchCapacityReached
                  ? "Branch limit reached"
                  : "Add Branch"}
            </Button>
          </PageToolbar>


          {branchCapacityReached ? (
            <UpgradeRequired
              variant="capacity"
              featureName="Branches"
              title="Branch capacity reached"
              description={
                branchRestrictionReason ||
                "The current subscription branch allowance has been reached."
              }
              limit={branchLimit}
              usage={effectiveBranchUsage}
              remaining={effectiveRemainingBranches}
              requiredPlan="Professional"
              compact
              embedded
              primaryActionLabel="Increase branch capacity"
              primaryActionTo="/billing"
              secondaryActionLabel="Compare editions"
              secondaryActionTo="/#pricing"
              onRefresh={async () => {
                await refreshEntitlements();
                await queryClient.invalidateQueries({ queryKey: ["branches"] });
              }}
            />
          ) : branchLimit ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
                  <div>
                    <p className="text-sm font-black text-foreground">
                      Branch subscription capacity
                    </p>
                    <p className="mt-1 text-xs font-medium leading-5 text-foreground">
                      {branchesUnlimited
                        ? `${effectiveBranchUsage.toLocaleString("en-RW")} branches currently registered. Your edition has no configured branch limit.`
                        : `${effectiveBranchUsage.toLocaleString("en-RW")} of ${Number(
                            branchLimitValue || 0,
                          ).toLocaleString("en-RW")} branches are currently in use.`}
                    </p>
                  </div>
                </div>

                <Badge className="w-fit rounded-full border border-border bg-card text-foreground hover:bg-card">
                  {branchesUnlimited
                    ? "Unlimited"
                    : `${effectiveRemainingBranches ?? 0} remaining`}
                </Badge>
              </div>
            </div>
          ) : null}

          <StatGrid items={statCards} columns={5} />

          <SectionCard
            icon={Building2}
            title="Branch Directory"
            description="Search and manage every trading location in this workspace."
          >
            <div className="flex flex-col gap-3 xl:flex-row">
            <div className="flex min-h-[40px] flex-1 items-center gap-3 rounded-xl bg-muted/40 px-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                placeholder="Search branch, code, manager, city, phone, or email..."
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="h-12 w-full rounded-2xl xl:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="h-12 w-full rounded-2xl xl:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((branchType) => <SelectItem key={branchType} value={branchType}>{branchType}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={syncFilter} onValueChange={(value) => { setSyncFilter(value); setPage(1); }}>
              <SelectTrigger className="h-12 w-full rounded-2xl xl:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sync</SelectItem>
                <SelectItem value="synced">Synced</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
              <SelectTrigger className="h-12 w-full rounded-2xl xl:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="transactions">Transactions</SelectItem>
                <SelectItem value="averageSale">Average Sale</SelectItem>
                <SelectItem value="health">Health</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="created_at">Newest</SelectItem>
              </SelectContent>
            </Select>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {pagedPerformance.length === 0 ? (
                <div className="xl:col-span-3">
                  <EmptyState
                    icon={Building2}
                    title="No branches found"
                    description="Create your first branch to start managing locations."
                  />
                </div>
              ) : (
                pagedPerformance.map((item) => {
                  const branch = item.branch;
                  const Icon = getBranchIcon(branch.type);
                  const healthLabel = getHealthLabel(item.health);
                  return (
                    <div key={branch.id} className="overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition hover:shadow-md">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-lg font-semibold">
                              {branch.name}
                              {branch.is_default && <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />}
                            </p>
                            <p className="text-xs text-muted-foreground">{branch.code || "No code"} · {branch.type || "store"}</p>
                            {isPendingSync(branch) && (
                              <Badge variant="outline" className="mt-1 rounded-full bg-primary/10 text-muted-foreground border-primary/30">
                                <UploadCloud className="mr-1 h-3 w-3" /> Pending Sync
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={`rounded-full capitalize ${getStatusClass(branch.status)}`}>{branch.status || "active"}</Badge>
                      </div>

                      <div className="mb-3 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-emerald-500/10 p-2.5">
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="font-bold font-data text-emerald-700">{formatCurrency(item.revenue)}</p>
                        </div>
                        <div className="rounded-xl bg-primary/10 p-2.5">
                          <p className="text-xs text-muted-foreground">Sales</p>
                          <p className="font-bold font-data text-foreground">{item.transactions}</p>
                        </div>
                        <div className="rounded-xl bg-orange-500/10 p-2.5">
                          <p className="text-xs text-muted-foreground">Avg Sale</p>
                          <p className="font-bold font-data text-orange-700">{formatCurrency(item.averageSale)}</p>
                        </div>
                        <div className={`rounded-xl border p-2.5 ${getHealthClass(item.health)}`}>
                          <p className="text-xs opacity-80">Health</p>
                          <p className="font-bold font-data">{item.health}% · {healthLabel}</p>
                        </div>
                      </div>

                      <div className="space-y-2.5 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="truncate">{branch.manager || "No manager assigned"}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /><span className="truncate">{branch.city || branch.address || "No location added"}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /><span className="truncate">{branch.phone || "No phone"}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /><span className="truncate">{branch.email || "No email"}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span className="truncate">{branch.operating_hours || "No hours set"}</span></div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setViewBranch(branch)}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(branch)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => printDirectory()}><Printer className="mr-2 h-4 w-4" />Print Directory</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportToCSV(exportRows, "branches", exportCols)}><Download className="mr-2 h-4 w-4" />Download CSV</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(branch)}><Trash2 className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <TablePagination
              page={currentPage}
              perPage={PAGE_SIZE}
              total={filteredPerformance.length}
              onPageChange={setPage}
              noun="branches"
            />
          </SectionCard>
        </PageContainer>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle>
              <DialogDescription>{editing ? "Update this branch location and operational details. Offline changes will sync later." : "Create a new store, outlet, or warehouse branch."}</DialogDescription>
            </DialogHeader>

            <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <div><label className="text-xs font-medium text-muted-foreground">Branch Name *</label><Input className="rounded-2xl" value={name} onChange={(event) => setName(event.target.value)} placeholder="Main Branch" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Code</label><Input className="rounded-2xl" value={code} onChange={(event) => setCode(event.target.value)} placeholder="BR-001" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Type</label><Select value={type} onValueChange={setType}><SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="store">Store</SelectItem><SelectItem value="warehouse">Warehouse</SelectItem><SelectItem value="outlet">Outlet</SelectItem><SelectItem value="kiosk">Kiosk</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs font-medium text-muted-foreground">Manager</label><Input className="rounded-2xl" value={manager} onChange={(event) => setManager(event.target.value)} placeholder="Branch manager name" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Phone</label><Input className="rounded-2xl" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250..." /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Email</label><Input className="rounded-2xl" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="branch@shopcore.com" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">City</label><Input className="rounded-2xl" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Kigali" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Address</label><Input className="rounded-2xl" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street / neighborhood" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Operating Hours</label><Input className="rounded-2xl" value={operatingHours} onChange={(event) => setOperatingHours(event.target.value)} placeholder="8:00 AM - 8:00 PM" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Opening Date</label><Input className="rounded-2xl" type="date" value={openingDate} onChange={(event) => setOpeningDate(event.target.value)} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Tax Number</label><Input className="rounded-2xl" value={taxNumber} onChange={(event) => setTaxNumber(event.target.value)} placeholder="TIN / VAT number" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={status} onValueChange={setStatus}><SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="maintenance">Under Maintenance</SelectItem></SelectContent></Select></div>
              <div className="md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Notes</label><Input className="rounded-2xl" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Internal notes about this branch" /></div>
              <label className="flex items-center gap-3 rounded-2xl border p-4 text-sm md:col-span-2"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /><div><p className="font-medium">Set as default branch</p><p className="text-xs text-muted-foreground">This branch will become the primary location for this workspace.</p></div></label>
            </div>

            {offlineModeActive && <div className="rounded-2xl border bg-amber-500/10 p-3 text-sm text-amber-700">Branch changes will be saved locally first and synced when internet returns.</div>}

            <DialogFooter>
              <Button variant="outline" className="rounded-2xl" onClick={closeDialog}>Cancel</Button>
              <Button
                type="button"
                className="rounded-2xl bg-primary font-black hover:bg-primary"
                onClick={handleSave}
                disabled={
                  createBranch.isPending ||
                  updateBranch.isPending ||
                  (!editing && !canCreateNewBranch)
                }
              >
                {createBranch.isPending || updateBranch.isPending
                  ? "Saving..."
                  : editing
                    ? "Update Branch"
                    : branchCapacityReached
                      ? "Branch limit reached"
                      : "Save Branch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewBranch} onOpenChange={() => setViewBranch(null)}>
          <DialogContent className="max-w-3xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{viewBranch?.name}</DialogTitle>
              <DialogDescription>{viewBranch?.code || "No code"} · {viewBranch?.type || "store"} · {viewBranch?.city || "No city"}</DialogDescription>
            </DialogHeader>
            {viewBranch && (() => {
              const item = branchPerformance.find((row) => row.branch.id === viewBranch.id);
              const health = item?.health || calcBranchHealth(viewBranch);
              return (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="font-bold font-data text-emerald-600">{formatCurrency(safeNumber(item?.revenue))}</p></div>
                    <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Profit</p><p className="font-bold font-data text-muted-foreground">{formatCurrency(safeNumber(item?.profit))}</p></div>
                    <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Transactions</p><p className="font-bold font-data">{item?.transactions || 0}</p></div>
                    <div className={`rounded-2xl border p-4 ${getHealthClass(health)}`}><p className="text-xs opacity-80">Health</p><p className="font-bold font-data">{health}%</p></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-2xl border bg-card p-4 space-y-2"><p className="font-semibold">Manager & Contact</p><p><Users className="inline mr-2 h-4 w-4" />{viewBranch.manager || "No manager"}</p><p><Phone className="inline mr-2 h-4 w-4" />{viewBranch.phone || "No phone"}</p><p><Mail className="inline mr-2 h-4 w-4" />{viewBranch.email || "No email"}</p></div>
                    <div className="rounded-2xl border bg-card p-4 space-y-2"><p className="font-semibold">Operations</p><p><MapPin className="inline mr-2 h-4 w-4" />{viewBranch.address || viewBranch.city || "No location"}</p><p><Clock className="inline mr-2 h-4 w-4" />{viewBranch.operating_hours || "No hours"}</p><p><CalendarDays className="inline mr-2 h-4 w-4" />Opened: {formatDate(viewBranch.opening_date)}</p></div>
                  </div>
                  {viewBranch.notes && <div className="rounded-2xl border bg-card p-4 text-sm"><p className="font-semibold mb-1">Notes</p>{viewBranch.notes}</div>}
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewBranch(null)}>Close</Button>
              <Button style={{ background: NAVY }} onClick={() => { if (viewBranch) { openEdit(viewBranch); setViewBranch(null); } }}>Edit Branch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-600" />Archive Branch</DialogTitle>
              <DialogDescription>Are you sure you want to delete "{deleteTarget?.name}"? Offline deletions are queued for sync.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteTarget && deleteBranch.mutate(deleteTarget)} disabled={deleteBranch.isPending}>{deleteBranch.isPending ? "Deleting..." : "Delete"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}
