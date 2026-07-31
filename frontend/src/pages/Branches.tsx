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
  ShoppingCart,
  DollarSign,
  Store,
  Warehouse,
  Clock,
  BadgeCheck,
  Activity,
  Target,
  FileText,
  ShieldCheck,
  Search,
  RotateCcw,
  Eye,
  MoreHorizontal,
  Download,
  Printer,
  Wifi,
  WifiOff,
  Database,
  UploadCloud,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  Trophy,
  CheckCircle2,
  XCircle,
  Layers3,
  CalendarDays,
  CircleDollarSign,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpgradeRequired from "@/components/UpgradeRequired";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
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
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/currency";
import { isOnline, getCachedTable, saveCachedTable, savePending, isNetworkError } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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

const NAVY = "#2563eb";
const PAGE_SIZE = 9;

const PIE_COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#14b8a6", "#fb923c"];

const branchChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "#2563eb" },
  transactions: { label: "Transactions", color: "#0ea5e9" },
  expenses: { label: "Expenses", color: "#f43f5e" },
  purchases: { label: "Purchases", color: "#f59e0b" },
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
  return "border-blue-500/30 bg-blue-500/10 text-blue-600";
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
  if (score >= 65) return "text-blue-600 bg-blue-500/10 border-blue-500/30";
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
  const canUseOnlineSupabase = isOnline() && !!session?.access_token && !isOfflineMode();

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches", tenantId, canUseOnlineSupabase ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    refetchOnReconnect: canUseOnlineSupabase,
    refetchOnWindowFocus: canUseOnlineSupabase,
    queryFn: async () => {
      if (!tenantId) return [] as Branch[];
      const cachedBranches = await getCachedTable("branches");

      if (!canUseOnlineSupabase) {
        return dedupeBranches(Array.isArray(cachedBranches) ? cachedBranches : []);
      }

      try {
        const { data, error } = await withTimeout<any>(
          (supabase as any)
            .from("branches")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false }),
          "Branch list request timed out"
        );

        if (error) throw error;
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
    queryKey: ["branch-sales", tenantId, canUseOnlineSupabase ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    queryFn: async () => {
      const cachedSales = await getCachedTable("sales");
      if (!canUseOnlineSupabase) return Array.isArray(cachedSales) ? cachedSales : [];

      try {
        const { data, error } = await withTimeout<any>(
          (supabase as any)
            .from("sales")
            .select("id, tenant_id, branch, total, subtotal, gross_profit, profit, net_profit, cost_total, status, created_at")
            .eq("tenant_id", tenantId),
          "Branch sales request timed out"
        );
        if (error) throw error;
        await saveCachedTable("sales", Array.isArray(data) ? data : []);
        return data as Sale[];
      } catch (error: any) {
        if (isNetworkError(error)) return Array.isArray(cachedSales) ? cachedSales : [];
        throw error;
      }
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["branch-expenses-lite", tenantId, canUseOnlineSupabase ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    queryFn: async () => {
      const cachedExpenses = await getCachedTable("expenses");
      if (!canUseOnlineSupabase) return Array.isArray(cachedExpenses) ? cachedExpenses : [];

      try {
        const { data, error } = await withTimeout<any>(
          (supabase as any)
            .from("expenses")
            .select("id, tenant_id, branch, amount, status, created_at")
            .eq("tenant_id", tenantId),
          "Branch expenses request timed out"
        );
        if (error) throw error;
        await saveCachedTable("expenses", Array.isArray(data) ? data : []);
        return data || [];
      } catch {
        return Array.isArray(cachedExpenses) ? cachedExpenses : [];
      }
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["branch-purchases-lite", tenantId, canUseOnlineSupabase ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    queryFn: async () => {
      const cachedPurchases = await getCachedTable("purchases");
      if (!canUseOnlineSupabase) return Array.isArray(cachedPurchases) ? cachedPurchases : [];

      try {
        const { data, error } = await withTimeout<any>(
          (supabase as any)
            .from("purchases")
            .select("id, tenant_id, branch, total, status, created_at")
            .eq("tenant_id", tenantId),
          "Branch purchases request timed out"
        );
        if (error) throw error;
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

      if (!canUseOnlineSupabase) {
        await saveBranchOffline(payload);
        return;
      }

      if (isDefault) {
        await withTimeout(
          (supabase as any).from("branches").update({ is_default: false }).eq("tenant_id", tenantId),
          "Default branch update timed out"
        );
      }

      const { data, error } = await withTimeout<any>(
        (supabase as any).from("branches").insert({ tenant_id: tenantId, ...payload }).select().single(),
        "Branch save request timed out"
      );
      if (error) throw error;

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

      if (!canUseOnlineSupabase || String(editing.id || "").startsWith("offline-") || !!editing.offline_id) {
        await saveBranchOffline(payload);
        return;
      }

      if (isDefault) {
        await withTimeout(
          (supabase as any).from("branches").update({ is_default: false }).eq("tenant_id", tenantId),
          "Default branch update timed out"
        );
      }

      const { data, error } = await withTimeout<any>(
        (supabase as any)
          .from("branches")
          .update(payload)
          .eq("id", editing.id)
          .eq("tenant_id", tenantId)
          .select()
          .single(),
        "Branch update request timed out"
      );

      if (error) throw error;

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

      if (!canUseOnlineSupabase || String(branch.id || "").startsWith("offline-")) {
        if (String(branch.id || "").startsWith("offline-")) {
          await saveCachedTable("branches", (Array.isArray(cachedBranches) ? cachedBranches : []).filter((row: any) => String(row.id) !== String(branch.id)));
          return;
        }

        const deleted = { ...branch, operation: "delete", sync_status: "pending_delete", status: "deleted", updated_offline_at: new Date().toISOString() };
        await savePending("branches", deleted);
        await saveCachedTable("branches", (Array.isArray(cachedBranches) ? cachedBranches : []).map((row: any) => String(row.id) === String(branch.id) ? deleted : row));
        return;
      }

      const { error } = await withTimeout<any>(
        (supabase as any).from("branches").update({ status: "inactive", operation: null, sync_status: "synced", updated_offline_at: null }).eq("id", branch.id).eq("tenant_id", tenantId),
        "Branch delete request timed out"
      );
      if (error) throw error;
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
      <PageShell title="Branches" description="Loading branches...">
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Branches" description="Manage store branches, locations, default branch, and branch performance.">
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-6">
          {(offlineModeActive || totals.pendingSync > 0) && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">{offlineModeActive ? "Branches are using offline cache" : "Branch changes waiting to sync"}</p>
                    <p className="text-sm opacity-90">Pending branch records: {totals.pendingSync}. Location data stays available for POS, staff, inventory, and reports.</p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  <UploadCloud className="mr-1 h-3 w-3" />
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border border-blue-200 bg-blue-50/80 shadow-sm p-4 overflow-hidden relative">
              <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-blue-100/70" />
              <div className="absolute -bottom-16 right-28 h-32 w-32 rounded-full bg-cyan-100/70" />

              <div className="relative flex items-start gap-5">
                <div className="w-12 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <Badge className="rounded-full bg-blue-600 text-white border-blue-600 mb-2 px-3 py-1 hover:bg-blue-600">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    Branch Operations Center
                  </Badge>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">Branch Control Center</h2>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-5">
                    Manage branches, default locations, branch managers, operating hours, contact readiness, revenue performance, purchase activity, and offline branch records.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-semibold text-emerald-700">Default Branch</p>
                      <p className="mt-1 text-sm font-black truncate text-emerald-950">{defaultBranch?.name || "Not set"}</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
                      <p className="text-xs font-semibold text-violet-700">Top Branch</p>
                      <p className="mt-1 text-sm font-black truncate text-violet-950">{(topBranch?.revenue ?? 0) > 0 ? topBranch.branch.name : "No sales yet"}</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                      <p className="text-xs font-semibold text-cyan-700">Filtered Results</p>
                      <p className="mt-1 text-sm font-black font-data text-cyan-950">{filteredPerformance.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-2 gap-3">
              {[
                { label: "All Branches", value: cleanBranches.length, helper: "location records", icon: Building2, card: "bg-blue-600", chip: "bg-white/20" },
                { label: "Active", value: totals.activeBranches, helper: "operating now", icon: BadgeCheck, card: "bg-emerald-600", chip: "bg-white/20" },
                { label: "Inactive", value: totals.inactiveBranches, helper: "needs review", icon: XCircle, card: "bg-orange-600", chip: "bg-white/20" },
                { label: "Revenue", value: formatCurrency(totals.totalRevenue), helper: "branch sales", icon: DollarSign, card: "bg-violet-600", chip: "bg-white/20" },
                { label: "Transactions", value: totals.totalTransactions, helper: "sales count", icon: ShoppingCart, card: "bg-cyan-600", chip: "bg-white/20" },
                { label: "Pending Sync", value: totals.pendingSync, helper: "offline queue", icon: UploadCloud, card: "bg-rose-600", chip: "bg-white/20" },
              ].map((item) => {
                const Icon = item.icon;
                const valueClass = String(item.value).length > 12 ? "text-xl break-words" : "text-2xl";
                return (
                  <div key={item.label} className={`relative overflow-hidden rounded-3xl border border-white/10 ${item.card} p-3 text-white shadow-sm min-h-[94px]`}>
                    <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white/90">{item.label}</p>
                        <p className={`${valueClass} mt-1 font-black font-data leading-tight`}>{item.value}</p>
                        <p className="mt-2 text-xs font-medium text-white/80">{item.helper}</p>
                      </div>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.chip}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 rounded-3xl border border-cyan-200 bg-cyan-50/80 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950">Branch Network</h3>
                  <p className="text-sm text-slate-600">Status and performance overview</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-blue-600 p-3 text-center text-white shadow-sm">
                  <Building2 className="mx-auto mb-2 h-5 w-5" />
                  <p className="text-sm font-semibold">Branches</p>
                  <p className="mt-1 text-2xl font-black font-data">{cleanBranches.length}</p>
                </div>
                <div className="rounded-2xl bg-emerald-600 p-3 text-center text-white shadow-sm">
                  <CheckCircle2 className="mx-auto mb-2 h-5 w-5" />
                  <p className="text-sm font-semibold">Active</p>
                  <p className="mt-1 text-2xl font-black font-data">{totals.activeBranches}</p>
                </div>
                <div className="rounded-2xl bg-rose-600 p-3 text-center text-white shadow-sm">
                  <XCircle className="mx-auto mb-2 h-5 w-5" />
                  <p className="text-sm font-semibold">Inactive</p>
                  <p className="mt-1 text-2xl font-black font-data">{totals.inactiveBranches}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-cyan-700 p-3 text-white shadow-sm">
                <p className="text-sm font-semibold text-white/80">Network Revenue</p>
                <p className="mt-2 text-2xl font-black font-data">{formatCurrency(totals.totalRevenue)}</p>
              </div>
            </div>

            <div className="xl:col-span-7 rounded-3xl border border-violet-200 bg-violet-50/80 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950">Branch Workflow Controls</h3>
                  <p className="text-sm text-slate-600">Readiness, finance, and offline continuity</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-sm">
                  <p className="font-black">Location Readiness</p>
                  <p className="mt-2 text-sm text-white/85">Keep manager, contacts, tax number, and operating hours complete.</p>
                  <p className="mt-4 text-2xl font-black font-data">{totals.avgHealth}%</p>
                </div>
                <div className="rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
                  <p className="font-black">Performance Tracking</p>
                  <p className="mt-2 text-sm text-white/85">Monitor revenue, profit preview, average sale, and transaction count.</p>
                  <p className="mt-4 text-2xl font-black font-data">{formatCurrency(totals.averageSale)}</p>
                </div>
                <div className="rounded-2xl bg-orange-600 p-3 text-white shadow-sm">
                  <p className="font-black">Offline Continuity</p>
                  <p className="mt-2 text-sm text-white/85">Create and update branches locally until the workspace reconnects.</p>
                  <p className="mt-4 text-2xl font-black font-data">{totals.pendingSync}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border bg-white shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Branch Performance Chart</h3>
                  <p className="text-xs text-slate-600">Revenue, expenses, and purchases by branch</p>
                </div>
              </div>
              {performanceChartData.length === 0 ? (
                <div className="rounded-2xl border bg-cyan-50 py-12 text-center text-sm text-slate-600">No performance data yet.</div>
              ) : (
                <ChartContainer config={branchChartConfig} className="h-[330px] w-full">
                  <BarChart data={performanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(safeNumber(v))} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill={NAVY} radius={[9, 9, 0, 0]} />
                    <Bar dataKey="expenses" fill="#f43f5e" radius={[9, 9, 0, 0]} />
                    <Bar dataKey="purchases" fill="#f59e0b" radius={[9, 9, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>

            <div className="xl:col-span-5 rounded-3xl border bg-white shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <PieChartIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Revenue Distribution</h3>
                  <p className="text-xs text-slate-600">Share of total revenue</p>
                </div>
              </div>
              {revenuePieData.length === 0 ? (
                <div className="rounded-2xl border bg-cyan-50 py-12 text-center text-sm text-slate-600">No revenue data yet.</div>
              ) : (
                <>
                  <ChartContainer config={branchChartConfig} className="h-[250px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie data={revenuePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} innerRadius={52} paddingAngle={3}>
                        {revenuePieData.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="space-y-2 mt-3">
                    {revenuePieData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="font-data font-semibold">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-3xl border bg-white shadow-sm p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-h-[40px] flex-1 items-center gap-3 rounded-xl bg-blue-50 px-3">
                <Search className="h-5 w-5 text-slate-600" />
                <input
                  placeholder="Search branch, code, manager, city, phone, or email..."
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-xl xl:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-xl xl:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((branchType) => <SelectItem key={branchType} value={branchType}>{branchType}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={syncFilter} onValueChange={(value) => { setSyncFilter(value); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-xl xl:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sync</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="h-10 w-full rounded-xl xl:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="transactions">Transactions</SelectItem>
                  <SelectItem value="averageSale">Average Sale</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="created_at">Newest</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="h-10 rounded-xl" onClick={() => setSortAsc(!sortAsc)}>
                {sortAsc ? <TrendingUp className="mr-2 h-4 w-4" /> : <TrendingDown className="mr-2 h-4 w-4" />}
                {sortAsc ? "Asc" : "Desc"}
              </Button>

              <Button variant="ghost" className="h-10 rounded-xl text-blue-700" onClick={resetFilters}>
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

              <Button variant="outline" className="h-10 rounded-xl" onClick={printDirectory}>
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
                    ? "cursor-not-allowed bg-slate-300 text-slate-600 hover:bg-slate-300"
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
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {pagedPerformance.length === 0 ? (
              <div className="rounded-3xl border bg-white py-10 text-center text-slate-600 xl:col-span-3">
                <Building2 className="mx-auto mb-3 h-9 w-9 opacity-30" />
                <p className="font-medium">No branches found</p>
                <p className="text-sm">Create your first branch to start managing locations.</p>
              </div>
            ) : (
              pagedPerformance.map((item) => {
                const branch = item.branch;
                const Icon = getBranchIcon(branch.type);
                const healthLabel = getHealthLabel(item.health);
                return (
                  <div key={branch.id} className="overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/10 text-[#2563eb]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-lg font-semibold">
                            {branch.name}
                            {branch.is_default && <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />}
                          </p>
                          <p className="text-xs text-slate-600">{branch.code || "No code"} · {branch.type || "store"}</p>
                          {isPendingSync(branch) && (
                            <Badge variant="outline" className="mt-1 rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30">
                              <UploadCloud className="mr-1 h-3 w-3" /> Pending Sync
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={`rounded-full capitalize ${getStatusClass(branch.status)}`}>{branch.status || "active"}</Badge>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-emerald-500/10 p-2.5">
                        <p className="text-xs text-slate-600">Revenue</p>
                        <p className="font-bold font-data text-emerald-700">{formatCurrency(item.revenue)}</p>
                      </div>
                      <div className="rounded-xl bg-sky-500/10 p-2.5">
                        <p className="text-xs text-slate-600">Sales</p>
                        <p className="font-bold font-data text-sky-700">{item.transactions}</p>
                      </div>
                      <div className="rounded-xl bg-orange-500/10 p-2.5">
                        <p className="text-xs text-slate-600">Avg Sale</p>
                        <p className="font-bold font-data text-orange-700">{formatCurrency(item.averageSale)}</p>
                      </div>
                      <div className={`rounded-xl border p-2.5 ${getHealthClass(item.health)}`}>
                        <p className="text-xs opacity-80">Health</p>
                        <p className="font-bold font-data">{item.health}% · {healthLabel}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center gap-2 text-slate-600"><Users className="h-4 w-4" /><span className="truncate">{branch.manager || "No manager assigned"}</span></div>
                      <div className="flex items-center gap-2 text-slate-600"><MapPin className="h-4 w-4" /><span className="truncate">{branch.city || branch.address || "No location added"}</span></div>
                      <div className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4" /><span className="truncate">{branch.phone || "No phone"}</span></div>
                      <div className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4" /><span className="truncate">{branch.email || "No email"}</span></div>
                      <div className="flex items-center gap-2 text-slate-600"><Clock className="h-4 w-4" /><span className="truncate">{branch.operating_hours || "No hours set"}</span></div>
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

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border bg-white shadow-sm px-4 py-3">
              <p className="text-xs text-slate-600">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredPerformance.length)} of {filteredPerformance.length}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Badge variant="outline" className="rounded-full">Page {currentPage} / {totalPages}</Badge>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><FileText className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-black">Branch Directory</h3>
                  <p className="text-xs text-slate-600">Compact administrative list with performance, health, and sync status.</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[1050px]">
                <div className="grid grid-cols-12 gap-4 border-b bg-blue-50 px-5 py-3 text-xs font-semibold uppercase text-slate-600">
                  <div className="col-span-3">Branch</div><div className="col-span-2">Manager</div><div className="col-span-2">Contact</div><div className="col-span-2">Performance</div><div className="col-span-1">Health</div><div className="col-span-1">Status</div><div className="col-span-1 text-right">Actions</div>
                </div>
                {filteredPerformance.map((item) => {
                  const branch = item.branch;
                  return (
                    <div key={branch.id} className="grid grid-cols-12 items-center gap-4 border-b px-5 py-4 last:border-b-0 hover:bg-blue-50">
                      <div className="col-span-3"><p className="flex items-center gap-1 font-semibold">{branch.name}{branch.is_default && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}</p><p className="text-xs text-slate-600">{branch.code || "-"} · {branch.type || "store"}</p><p className="text-xs text-slate-600">{branch.city || ""}</p></div>
                      <div className="col-span-2 text-sm text-slate-600">{branch.manager || "-"}</div>
                      <div className="col-span-2 text-sm text-slate-600"><p>{branch.phone || "-"}</p><p className="truncate text-xs">{branch.email || ""}</p></div>
                      <div className="col-span-2 text-sm text-slate-600"><p className="font-data">{formatCurrency(item.revenue)}</p><p className="text-xs">{item.transactions} transactions</p></div>
                      <div className="col-span-1"><Badge variant="outline" className={`rounded-full ${getHealthClass(item.health)}`}>{item.health}%</Badge></div>
                      <div className="col-span-1"><Badge variant="outline" className={`rounded-full capitalize ${getStatusClass(branch.status)}`}>{branch.status || "active"}</Badge></div>
                      <div className="col-span-1 flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setViewBranch(branch)}><Eye className="h-4 w-4 text-slate-600" /></Button><Button variant="ghost" size="icon" onClick={() => openEdit(branch)}><Pencil className="h-4 w-4 text-sky-600" /></Button><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(branch)}><Trash2 className="h-4 w-4 text-rose-600" /></Button></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

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
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
                  <div>
                    <p className="text-sm font-black text-cyan-950">
                      Branch subscription capacity
                    </p>
                    <p className="mt-1 text-xs font-medium leading-5 text-cyan-800">
                      {branchesUnlimited
                        ? `${effectiveBranchUsage.toLocaleString("en-RW")} branches currently registered. Your edition has no configured branch limit.`
                        : `${effectiveBranchUsage.toLocaleString("en-RW")} of ${Number(
                            branchLimitValue || 0,
                          ).toLocaleString("en-RW")} branches are currently in use.`}
                    </p>
                  </div>
                </div>

                <Badge className="w-fit rounded-full border border-cyan-200 bg-white text-cyan-800 hover:bg-white">
                  {branchesUnlimited
                    ? "Unlimited"
                    : `${effectiveRemainingBranches ?? 0} remaining`}
                </Badge>
              </div>
            </div>
          ) : null}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle>
              <DialogDescription>{editing ? "Update this branch location and operational details. Offline changes will sync later." : "Create a new store, outlet, or warehouse branch."}</DialogDescription>
            </DialogHeader>

            <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <div><label className="text-xs font-medium text-slate-600">Branch Name *</label><Input className="rounded-2xl" value={name} onChange={(event) => setName(event.target.value)} placeholder="Main Branch" /></div>
              <div><label className="text-xs font-medium text-slate-600">Code</label><Input className="rounded-2xl" value={code} onChange={(event) => setCode(event.target.value)} placeholder="BR-001" /></div>
              <div><label className="text-xs font-medium text-slate-600">Type</label><Select value={type} onValueChange={setType}><SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="store">Store</SelectItem><SelectItem value="warehouse">Warehouse</SelectItem><SelectItem value="outlet">Outlet</SelectItem><SelectItem value="kiosk">Kiosk</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs font-medium text-slate-600">Manager</label><Input className="rounded-2xl" value={manager} onChange={(event) => setManager(event.target.value)} placeholder="Branch manager name" /></div>
              <div><label className="text-xs font-medium text-slate-600">Phone</label><Input className="rounded-2xl" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250..." /></div>
              <div><label className="text-xs font-medium text-slate-600">Email</label><Input className="rounded-2xl" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="branch@shopcore.com" /></div>
              <div><label className="text-xs font-medium text-slate-600">City</label><Input className="rounded-2xl" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Kigali" /></div>
              <div><label className="text-xs font-medium text-slate-600">Address</label><Input className="rounded-2xl" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street / neighborhood" /></div>
              <div><label className="text-xs font-medium text-slate-600">Operating Hours</label><Input className="rounded-2xl" value={operatingHours} onChange={(event) => setOperatingHours(event.target.value)} placeholder="8:00 AM - 8:00 PM" /></div>
              <div><label className="text-xs font-medium text-slate-600">Opening Date</label><Input className="rounded-2xl" type="date" value={openingDate} onChange={(event) => setOpeningDate(event.target.value)} /></div>
              <div><label className="text-xs font-medium text-slate-600">Tax Number</label><Input className="rounded-2xl" value={taxNumber} onChange={(event) => setTaxNumber(event.target.value)} placeholder="TIN / VAT number" /></div>
              <div><label className="text-xs font-medium text-slate-600">Status</label><Select value={status} onValueChange={setStatus}><SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="maintenance">Under Maintenance</SelectItem></SelectContent></Select></div>
              <div className="md:col-span-2"><label className="text-xs font-medium text-slate-600">Notes</label><Input className="rounded-2xl" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Internal notes about this branch" /></div>
              <label className="flex items-center gap-3 rounded-2xl border p-4 text-sm md:col-span-2"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /><div><p className="font-medium">Set as default branch</p><p className="text-xs text-slate-600">This branch will become the primary location for this workspace.</p></div></label>
            </div>

            {offlineModeActive && <div className="rounded-2xl border bg-amber-500/10 p-3 text-sm text-amber-700">Branch changes will be saved locally first and synced when internet returns.</div>}

            <DialogFooter>
              <Button variant="outline" className="rounded-2xl" onClick={closeDialog}>Cancel</Button>
              <Button
                type="button"
                className="rounded-2xl bg-blue-600 font-black hover:bg-blue-700"
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
                    <div className="rounded-2xl border bg-blue-50 p-4"><p className="text-xs text-slate-600">Revenue</p><p className="font-bold font-data text-emerald-600">{formatCurrency(safeNumber(item?.revenue))}</p></div>
                    <div className="rounded-2xl border bg-blue-50 p-4"><p className="text-xs text-slate-600">Profit</p><p className="font-bold font-data text-blue-600">{formatCurrency(safeNumber(item?.profit))}</p></div>
                    <div className="rounded-2xl border bg-blue-50 p-4"><p className="text-xs text-slate-600">Transactions</p><p className="font-bold font-data">{item?.transactions || 0}</p></div>
                    <div className={`rounded-2xl border p-4 ${getHealthClass(health)}`}><p className="text-xs opacity-80">Health</p><p className="font-bold font-data">{health}%</p></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-2xl border bg-cyan-50 p-4 space-y-2"><p className="font-semibold">Manager & Contact</p><p><Users className="inline mr-2 h-4 w-4" />{viewBranch.manager || "No manager"}</p><p><Phone className="inline mr-2 h-4 w-4" />{viewBranch.phone || "No phone"}</p><p><Mail className="inline mr-2 h-4 w-4" />{viewBranch.email || "No email"}</p></div>
                    <div className="rounded-2xl border bg-cyan-50 p-4 space-y-2"><p className="font-semibold">Operations</p><p><MapPin className="inline mr-2 h-4 w-4" />{viewBranch.address || viewBranch.city || "No location"}</p><p><Clock className="inline mr-2 h-4 w-4" />{viewBranch.operating_hours || "No hours"}</p><p><CalendarDays className="inline mr-2 h-4 w-4" />Opened: {formatDate(viewBranch.opening_date)}</p></div>
                  </div>
                  {viewBranch.notes && <div className="rounded-2xl border bg-cyan-50 p-4 text-sm"><p className="font-semibold mb-1">Notes</p>{viewBranch.notes}</div>}
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
