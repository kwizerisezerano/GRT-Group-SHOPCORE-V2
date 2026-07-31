import { useMemo, useState } from "react";
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  ShieldCheck,
  Building2,
  Wallet,
  Mail,
  Phone,
  CalendarDays,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock3,
  Database,
  UploadCloud,
  WifiOff,
  RotateCcw,
  AlertTriangle,
  Award,
  BarChart3,
  TrendingUp,
  FileText,
  Printer,
  Download,
  Receipt,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Badge } from "@/components/ui/badge";
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

const SHOPCORE_BLUE = "#2563eb";
const PAGE_SIZE = 10;

const BTN_PRIMARY = "bg-blue-600 text-white hover:bg-blue-700 border-blue-600";
const BTN_SUCCESS = "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600";
const BTN_WARNING = "bg-orange-600 text-white hover:bg-orange-700 border-orange-600";
const BTN_INFO = "bg-cyan-600 text-white hover:bg-cyan-700 border-cyan-600";
const BTN_DANGER = "bg-rose-600 text-white hover:bg-rose-700 border-rose-600";
const BTN_PURPLE = "bg-violet-600 text-white hover:bg-violet-700 border-violet-600";

type SortKey =
  | "created_at"
  | "full_name"
  | "position"
  | "branch"
  | "salary"
  | "hire_date";

type StaffWorkspaceView = "directory" | "payroll" | "attendance" | "leave";

interface StaffMember {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  position: string | null;
  salary: number | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  branch: string | null;
  status: string | null;
  hire_date: string | null;
  notes: string | null;
  operation?: string | null;
  sync_status?: string | null;
  offline_id?: string | null;
  created_offline_at?: string | null;
  updated_offline_at?: string | null;
}

interface PayrollAdjustment {
  id: string;
  tenant_id: string;
  staff_id: string;
  payroll_month: string;
  base_salary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  gross_pay: number;
  net_pay: number;
  payment_status: string;
  payment_method: string;
  notes: string | null;
  updated_at: string;
}

interface AttendanceRow {
  id: string;
  tenant_id: string;
  staff_id: string;
  staff_name: string | null;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
  operation?: string | null;
  sync_status?: string | null;
}

interface LeaveRequestRow {
  id: string;
  tenant_id: string;
  staff_id: string;
  staff_name: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
  operation?: string | null;
  sync_status?: string | null;
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

function dedupeStaff(rows: any[]) {
  const map = new Map<string, StaffMember>();

  for (const row of rows || []) {
    if (!row || isPendingDelete(row)) continue;

    const key = String(
      row.id ||
        row.offline_id ||
        row.email ||
        row.phone ||
        row.full_name ||
        Math.random(),
    );
    const existing = map.get(key);

    if (!existing) {
      map.set(key, row as StaffMember);
      continue;
    }

    const existingTime = new Date(
      existing.updated_offline_at || existing.created_at || 0,
    ).getTime();
    const incomingTime = new Date(
      row.updated_offline_at || row.created_at || 0,
    ).getTime();

    map.set(
      key,
      incomingTime >= existingTime
        ? { ...existing, ...row }
        : { ...row, ...existing },
    );
  }

  return Array.from(map.values());
}

function getInitials(name: string | null) {
  return (
    (name || "S")
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "S"
  );
}

function getStaffStatus(value?: string | null) {
  return String(value || "active").toLowerCase();
}

function statusClass(value: string | null | undefined) {
  const status = getStaffStatus(value);

  if (status === "active")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
  if (status === "pending")
    return "border-blue-500/30 bg-blue-500/10 text-blue-600";
  if (status === "deleted")
    return "border-rose-500/30 bg-rose-500/10 text-rose-600";

  return "border-rose-500/30 bg-rose-500/10 text-rose-600";
}

function normalizePayload({
  fullName,
  email,
  phone,
  role,
  position,
  branch,
  salary,
  status,
  hireDate,
  notes,
}: {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  position: string;
  branch: string;
  salary: string;
  status: string;
  hireDate: string;
  notes: string;
}) {
  const parsedSalary = safeNumber(salary);

  return {
    profile_id: null,
    full_name: fullName.trim(),
    email: email.trim() || null,
    phone: phone.trim() || null,
    role: role.trim() || null,
    position: position.trim(),
    branch: branch.trim() || null,
    salary: parsedSalary,
    status: status || "active",
    hire_date: hireDate || null,
    notes: notes.trim() || null,
  };
}

export default function Staff() {
  const { user, tenantId, session } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [workspaceView, setWorkspaceView] = useState<StaffWorkspaceView>("directory");
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [allowancePercent, setAllowancePercent] = useState("0");
  const [bonusAmount, setBonusAmount] = useState("0");
  const [deductionPercent, setDeductionPercent] = useState("0");
  const [payrollStatusFilter, setPayrollStatusFilter] = useState("all");
  const [payrollNewStaffId, setPayrollNewStaffId] = useState("all");
  const [payrollRunStatus, setPayrollRunStatus] = useState("draft");
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<string[]>([]);
  const [payrollEditorOpen, setPayrollEditorOpen] = useState(false);
  const [payrollEditorMember, setPayrollEditorMember] = useState<StaffMember | null>(null);
  const [payrollForm, setPayrollForm] = useState({
    baseSalary: "",
    allowances: "",
    bonus: "",
    deductions: "",
    paymentStatus: "unpaid",
    paymentMethod: "cash",
    notes: "",
  });

  const [attendanceStaffId, setAttendanceStaffId] = useState("all");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveStaffId, setLeaveStaffId] = useState("all");
  const [leaveType, setLeaveType] = useState("annual");
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [position, setPosition] = useState("");
  const [branch, setBranch] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState("active");
  const [hireDate, setHireDate] = useState("");
  const [notes, setNotes] = useState("");

  const offlineModeActive = !isOnline() || isOfflineMode();
  const canUseOnlineSupabase =
    isOnline() && !!session?.access_token && !isOfflineMode();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", tenantId, canUseOnlineSupabase ? "online" : "offline"],
    enabled: !!user && !!tenantId,
    retry: 0,
    refetchOnReconnect: canUseOnlineSupabase,
    refetchOnWindowFocus: canUseOnlineSupabase,
    queryFn: async () => {
      if (!tenantId) return [] as StaffMember[];

      const cachedStaff = await getCachedTable("staff");

      if (!canUseOnlineSupabase) {
        return dedupeStaff(Array.isArray(cachedStaff) ? cachedStaff : []);
      }

      try {
        const { data, error } = await (supabase as any)
          .from("staff")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const merged = dedupeStaff([
          ...(data || []),
          ...(Array.isArray(cachedStaff) ? cachedStaff : []),
        ]);
        await saveCachedTable("staff", merged);
        return merged;
      } catch (error: any) {
        if (isNetworkError(error)) {
          return dedupeStaff(Array.isArray(cachedStaff) ? cachedStaff : []);
        }
        throw error;
      }
    },
  });

  const payrollCacheKey = `staff_payroll_${tenantId || "workspace"}_${payrollMonth || "current"}`;

  const { data: payrollAdjustments = [] } = useQuery({
    queryKey: ["staff-payroll-adjustments", tenantId, payrollMonth],
    enabled: !!tenantId,
    retry: 0,
    queryFn: async () => {
      const rows = await getCachedTable(payrollCacheKey);
      return Array.isArray(rows) ? (rows as PayrollAdjustment[]) : [];
    },
  });

  const attendanceCacheKey = `staff_attendance_${tenantId || "workspace"}`;
  const leaveCacheKey = `staff_leave_requests_${tenantId || "workspace"}`;

  const { data: attendanceRows = [] } = useQuery({
    queryKey: ["staff-attendance", tenantId],
    enabled: !!tenantId,
    retry: 0,
    queryFn: async () => {
      const rows = await getCachedTable(attendanceCacheKey);
      return Array.isArray(rows) ? (rows as AttendanceRow[]) : [];
    },
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["staff-leave-requests", tenantId],
    enabled: !!tenantId,
    retry: 0,
    queryFn: async () => {
      const rows = await getCachedTable(leaveCacheKey);
      return Array.isArray(rows) ? (rows as LeaveRequestRow[]) : [];
    },
  });

  const cleanStaff = useMemo(
    () => dedupeStaff(staff as StaffMember[]),
    [staff],
  );

  const branches = useMemo(
    () =>
      [
        ...new Set(cleanStaff.map((member) => member.branch).filter(Boolean)),
      ] as string[],
    [cleanStaff],
  );

  const roles = useMemo(
    () =>
      [
        ...new Set(
          cleanStaff
            .map((member) => member.role || member.position)
            .filter(Boolean),
        ),
      ] as string[],
    [cleanStaff],
  );

  const filteredStaff = useMemo(() => {
    const query = search.toLowerCase().trim();

    const rows = cleanStaff.filter((member) => {
      const matchesSearch =
        !query ||
        (member.full_name || "").toLowerCase().includes(query) ||
        (member.email || "").toLowerCase().includes(query) ||
        (member.phone || "").toLowerCase().includes(query) ||
        (member.role || "").toLowerCase().includes(query) ||
        (member.position || "").toLowerCase().includes(query) ||
        (member.branch || "").toLowerCase().includes(query) ||
        (member.notes || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        getStaffStatus(member.status) === statusFilter;

      const matchesBranch =
        branchFilter === "all" || member.branch === branchFilter;
      const roleValue = member.role || member.position || "";
      const matchesRole = roleFilter === "all" || roleValue === roleFilter;
      const pending = isPendingSync(member);
      const matchesSync =
        syncFilter === "all" ||
        (syncFilter === "pending" && pending) ||
        (syncFilter === "synced" && !pending);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesBranch &&
        matchesRole &&
        matchesSync
      );
    });

    rows.sort((a: any, b: any) => {
      if (["created_at", "hire_date"].includes(sortKey)) {
        const av = new Date(a[sortKey] || 0).getTime();
        const bv = new Date(b[sortKey] || 0).getTime();
        return sortAsc ? av - bv : bv - av;
      }

      if (sortKey === "salary") {
        return sortAsc
          ? safeNumber(a.salary) - safeNumber(b.salary)
          : safeNumber(b.salary) - safeNumber(a.salary);
      }

      const av = String(a[sortKey] || "");
      const bv = String(b[sortKey] || "");
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return rows;
  }, [
    cleanStaff,
    search,
    statusFilter,
    branchFilter,
    roleFilter,
    syncFilter,
    sortKey,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedStaff = filteredStaff.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(() => {
    const active = cleanStaff.filter(
      (member) => getStaffStatus(member.status) === "active",
    ).length;
    const inactive = cleanStaff.filter(
      (member) => getStaffStatus(member.status) === "inactive",
    ).length;
    const rolesCount = new Set(
      cleanStaff
        .map((member) => member.role || member.position)
        .filter(Boolean),
    ).size;
    const branchesCount = new Set(
      cleanStaff.map((member) => member.branch).filter(Boolean),
    ).size;
    const monthlyPayroll = cleanStaff
      .filter((member) => getStaffStatus(member.status) === "active")
      .reduce((sum, member) => sum + safeNumber(member.salary), 0);

    const totalPayroll = cleanStaff.reduce(
      (sum, member) => sum + safeNumber(member.salary),
      0,
    );
    const activeRate =
      cleanStaff.length > 0
        ? Math.round((active / cleanStaff.length) * 100)
        : 0;
    const avgSalary = active > 0 ? Math.round(monthlyPayroll / active) : 0;
    const pendingSync = cleanStaff.filter(isPendingSync).length;
    const missingContact = cleanStaff.filter(
      (member) => !member.email && !member.phone,
    ).length;
    const readiness = cleanStaff.length
      ? Math.max(
          0,
          Math.round(
            (active / cleanStaff.length) * 45 +
              ((cleanStaff.length - missingContact) / cleanStaff.length) * 25 +
              (branchesCount > 0 ? 15 : 0) +
              (rolesCount > 0 ? 15 : 0),
          ),
        )
      : 0;

    return {
      total: cleanStaff.length,
      active,
      inactive,
      roles: rolesCount,
      branchesCount,
      monthlyPayroll,
      totalPayroll,
      activeRate,
      avgSalary,
      pendingSync,
      missingContact,
      readiness,
    };
  }, [cleanStaff]);

  const branchDistribution = useMemo(() => {
    const map = new Map<string, number>();
    cleanStaff.forEach((member) => {
      const key = member.branch || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return [...map.entries()]
      .map(([name, count]) => ({
        name,
        count,
        percent: stats.total ? Math.round((count / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [cleanStaff, stats.total]);

  const payrollByBranch = useMemo(() => {
    const map = new Map<string, number>();
    cleanStaff.forEach((member) => {
      const key = member.branch || "Unassigned";
      map.set(key, (map.get(key) || 0) + safeNumber(member.salary));
    });

    const maxPayroll = Math.max(...Array.from(map.values()), 0);

    return [...map.entries()]
      .map(([name, payroll]) => ({
        name,
        payroll,
        percent: maxPayroll ? Math.round((payroll / maxPayroll) * 100) : 0,
      }))
      .sort((a, b) => b.payroll - a.payroll)
      .slice(0, 6);
  }, [cleanStaff]);

  const roleDistribution = useMemo(() => {
    const map = new Map<string, number>();
    cleanStaff.forEach((member) => {
      const key = member.role || member.position || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()]
      .map(([name, count]) => ({
        name,
        count,
        percent: stats.total ? Math.round((count / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [cleanStaff, stats.total]);


  const allActiveStaffForPayroll = useMemo(
    () => cleanStaff.filter((member) => getStaffStatus(member.status) === "active"),
    [cleanStaff],
  );

  const payrollRows = useMemo(() => {
    const allowanceRate = Math.max(0, safeNumber(allowancePercent)) / 100;
    const deductionRate = Math.max(0, safeNumber(deductionPercent)) / 100;
    const sharedBonus = Math.max(0, safeNumber(bonusAmount));
    const adjustmentMap = new Map(
      payrollAdjustments.map((item: PayrollAdjustment) => [String(item.staff_id), item]),
    );

    return allActiveStaffForPayroll
      .map((member) => {
        const adjustment = adjustmentMap.get(String(member.id));
        const baseSalary = adjustment ? safeNumber(adjustment.base_salary) : safeNumber(member.salary);
        const allowances = adjustment ? safeNumber(adjustment.allowances) : Math.round(baseSalary * allowanceRate);
        const bonus = adjustment ? safeNumber(adjustment.bonus) : sharedBonus;
        const deductions = adjustment ? safeNumber(adjustment.deductions) : Math.round(baseSalary * deductionRate);
        const grossPay = baseSalary + allowances + bonus;
        const netPay = Math.max(0, grossPay - deductions);
        const paymentStatus = adjustment?.payment_status || "unpaid";
        const paymentMethod = adjustment?.payment_method || "cash";
        const payrollStatus = isPendingSync(member) ? "pending_sync" : paymentStatus;

        return {
          member,
          adjustment,
          baseSalary,
          allowances,
          bonus,
          deductions,
          grossPay,
          netPay,
          paymentStatus,
          paymentMethod,
          payrollStatus,
          notes: adjustment?.notes || "",
        };
      })
      .filter((row) => payrollStatusFilter === "all" || row.payrollStatus === payrollStatusFilter || row.paymentStatus === payrollStatusFilter);
  }, [allActiveStaffForPayroll, allowancePercent, bonusAmount, deductionPercent, payrollStatusFilter, payrollAdjustments]);

  const payrollStats = useMemo(() => {
    const baseSalary = payrollRows.reduce((sum, row) => sum + row.baseSalary, 0);
    const allowances = payrollRows.reduce((sum, row) => sum + row.allowances, 0);
    const bonuses = payrollRows.reduce((sum, row) => sum + row.bonus, 0);
    const deductions = payrollRows.reduce((sum, row) => sum + row.deductions, 0);
    const grossPay = payrollRows.reduce((sum, row) => sum + row.grossPay, 0);
    const netPay = payrollRows.reduce((sum, row) => sum + row.netPay, 0);
    const pending = payrollRows.filter((row) => row.payrollStatus === "pending_sync").length;
    const paid = payrollRows.filter((row) => row.paymentStatus === "paid").length;
    const unpaid = payrollRows.filter((row) => row.paymentStatus === "unpaid").length;
    const draft = payrollRows.filter((row) => row.paymentStatus === "draft").length;
    const paidAmount = payrollRows.filter((row) => row.paymentStatus === "paid").reduce((sum, row) => sum + row.netPay, 0);
    const unpaidAmount = Math.max(0, netPay - paidAmount);

    return {
      staffCount: payrollRows.length,
      baseSalary,
      allowances,
      bonuses,
      deductions,
      grossPay,
      netPay,
      pending,
      paid,
      unpaid,
      draft,
      paidAmount,
      unpaidAmount,
      averageNet: payrollRows.length > 0 ? Math.round(netPay / payrollRows.length) : 0,
      deductionRate: grossPay > 0 ? Math.round((deductions / grossPay) * 100) : 0,
    };
  }, [payrollRows]);

  const selectedPayrollRows = useMemo(
    () => payrollRows.filter((row) => selectedPayrollIds.includes(String(row.member.id))),
    [payrollRows, selectedPayrollIds],
  );

  const allVisiblePayrollSelected =
    payrollRows.length > 0 && payrollRows.every((row) => selectedPayrollIds.includes(String(row.member.id)));

  const payrollByRole = useMemo(() => {
    const map = new Map<string, number>();

    payrollRows.forEach((row) => {
      const key = row.member.role || row.member.position || "Unassigned";
      map.set(key, (map.get(key) || 0) + row.netPay);
    });

    const maxAmount = Math.max(...Array.from(map.values()), 0);

    return [...map.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        percent: maxAmount ? Math.round((amount / maxAmount) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [payrollRows]);

  const todayAttendanceRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return attendanceRows.filter((row) => row.work_date === today && (attendanceStatusFilter === "all" || row.status === attendanceStatusFilter));
  }, [attendanceRows, attendanceStatusFilter]);

  const attendanceStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = attendanceRows.filter((row) => row.work_date === today);
    return {
      today: todayRows.length,
      clockedIn: todayRows.filter((row) => row.clock_in && !row.clock_out).length,
      completed: todayRows.filter((row) => row.clock_in && row.clock_out).length,
      totalHours: Math.round(todayRows.reduce((sum, row) => sum + safeNumber(row.hours_worked), 0) * 10) / 10,
      pendingSync: attendanceRows.filter(isPendingSync).length,
    };
  }, [attendanceRows]);

  const leaveStats = useMemo(() => ({
    total: leaveRequests.length,
    pending: leaveRequests.filter((row) => row.status === "pending").length,
    approved: leaveRequests.filter((row) => row.status === "approved").length,
    rejected: leaveRequests.filter((row) => row.status === "rejected").length,
    pendingSync: leaveRequests.filter(isPendingSync).length,
  }), [leaveRequests]);

  const exportPayrollCsv = () => {
    const header = [
      "Payroll Month",
      "Staff Name",
      "Position",
      "Branch",
      "Base Salary",
      "Allowances",
      "Bonus",
      "Deductions",
      "Gross Pay",
      "Net Pay",
      "Status",
    ];

    const rows = payrollRows.map((row) => [
      payrollMonth,
      row.member.full_name || "",
      row.member.position || "",
      row.member.branch || "",
      row.baseSalary,
      row.allowances,
      row.bonus,
      row.deductions,
      row.grossPay,
      row.netPay,
      row.payrollStatus,
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `staff_payroll_${payrollMonth || "preview"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printPayrollSummary = () => {
    const lines = payrollRows
      .map(
        (row) => `
          <tr>
            <td>${row.member.full_name || "-"}</td>
            <td>${row.member.position || "-"}</td>
            <td>${row.member.branch || "-"}</td>
            <td>${formatCurrency(row.baseSalary)}</td>
            <td>${formatCurrency(row.allowances + row.bonus)}</td>
            <td>${formatCurrency(row.deductions)}</td>
            <td><strong>${formatCurrency(row.netPay)}</strong></td>
          </tr>
        `,
      )
      .join("");

    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) {
      toast.error("Unable to open payroll print window.");
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Staff Payroll - ${payrollMonth}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${SHOPCORE_BLUE}; padding-bottom: 16px; margin-bottom: 20px; }
            h1 { margin: 0; color: ${SHOPCORE_BLUE}; font-size: 24px; }
            .meta { color: #64748b; font-size: 12px; line-height: 1.6; text-align: right; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
            .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px; }
            .label { color: #64748b; font-size: 11px; text-transform: uppercase; }
            .value { font-size: 16px; font-weight: 800; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th { background: ${SHOPCORE_BLUE}; color: white; text-align: left; padding: 10px; font-size: 12px; }
            td { border-bottom: 1px solid #e5e7eb; padding: 10px; font-size: 12px; }
            .footer { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; font-size: 12px; }
            .signature { border-top: 1px solid #111827; padding-top: 8px; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>ShopCore Staff Payroll</h1>
              <p>Payroll preview generated from Staff module salary records.</p>
            </div>
            <div class="meta">
              Period: ${payrollMonth || "Current"}<br/>
              Generated: ${formatDateTime(new Date().toISOString())}<br/>
              Staff Included: ${payrollStats.staffCount}
            </div>
          </div>

          <div class="summary">
            <div class="card"><div class="label">Base Salary</div><div class="value">${formatCurrency(payrollStats.baseSalary)}</div></div>
            <div class="card"><div class="label">Gross Pay</div><div class="value">${formatCurrency(payrollStats.grossPay)}</div></div>
            <div class="card"><div class="label">Deductions</div><div class="value">${formatCurrency(payrollStats.deductions)}</div></div>
            <div class="card"><div class="label">Net Payroll</div><div class="value">${formatCurrency(payrollStats.netPay)}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Position</th>
                <th>Branch</th>
                <th>Base Salary</th>
                <th>Allowances/Bonus</th>
                <th>Deductions</th>
                <th>Net Pay</th>
              </tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>

          <div class="footer">
            <div class="signature">Prepared By</div>
            <div class="signature">Approved By</div>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);

    win.document.close();
  };

  const openPayrollEditor = (row: any) => {
    setPayrollEditorMember(row.member);
    setPayrollForm({
      baseSalary: String(row.baseSalary || 0),
      allowances: String(row.allowances || 0),
      bonus: String(row.bonus || 0),
      deductions: String(row.deductions || 0),
      paymentStatus: row.paymentStatus || "unpaid",
      paymentMethod: row.paymentMethod || "cash",
      notes: row.notes || "",
    });
    setPayrollEditorOpen(true);
  };

  const closePayrollEditor = () => {
    setPayrollEditorOpen(false);
    setPayrollEditorMember(null);
  };

  const createPayrollEntryForStaff = () => {
    const selectedMember =
      payrollNewStaffId === "all"
        ? filteredStaff.find((member) => getStaffStatus(member.status) === "active")
        : filteredStaff.find((member) => String(member.id) === String(payrollNewStaffId));

    if (!selectedMember) {
      toast.error("Select an active staff member first.");
      return;
    }

    const existingRow = payrollRows.find((row) => String(row.member.id) === String(selectedMember.id));
    const baseSalary = safeNumber(existingRow?.baseSalary ?? selectedMember.salary);
    const defaultAllowances = existingRow?.allowances ?? Math.round(baseSalary * (Math.max(0, safeNumber(allowancePercent)) / 100));
    const defaultBonus = existingRow?.bonus ?? Math.max(0, safeNumber(bonusAmount));
    const defaultDeductions = existingRow?.deductions ?? Math.round(baseSalary * (Math.max(0, safeNumber(deductionPercent)) / 100));

    openPayrollEditor({
      member: selectedMember,
      baseSalary,
      allowances: defaultAllowances,
      bonus: defaultBonus,
      deductions: defaultDeductions,
      paymentStatus: existingRow?.paymentStatus || "unpaid",
      paymentMethod: existingRow?.paymentMethod || "cash",
      notes: existingRow?.notes || "",
    });
  };

  const savePayrollAdjustmentRows = async (rowsToSave: PayrollAdjustment[], successMessage?: string) => {
    const existing = await getCachedTable(payrollCacheKey);
    const incomingIds = new Set(rowsToSave.map((item) => String(item.staff_id)));
    const preserved = Array.isArray(existing)
      ? existing.filter((item: any) => !incomingIds.has(String(item.staff_id)))
      : [];
    const next = [...rowsToSave, ...preserved];

    await saveCachedTable(payrollCacheKey, next);
    await Promise.all(rowsToSave.map((row) => savePending("staff_payroll", { ...row, operation: "upsert", sync_status: "pending", updated_offline_at: new Date().toISOString() }).catch(() => undefined)));
    queryClient.setQueryData(["staff-payroll-adjustments", tenantId, payrollMonth], next);

    if (successMessage) toast.success(successMessage);
  };

  const buildPayrollAdjustment = (row: any, overrides: Partial<PayrollAdjustment> = {}): PayrollAdjustment => {
    const baseSalary = safeNumber(overrides.base_salary ?? row.baseSalary);
    const allowances = safeNumber(overrides.allowances ?? row.allowances);
    const bonus = safeNumber(overrides.bonus ?? row.bonus);
    const deductions = safeNumber(overrides.deductions ?? row.deductions);
    const grossPay = baseSalary + allowances + bonus;
    const netPay = Math.max(0, grossPay - deductions);

    return {
      id: `${payrollMonth}-${row.member.id}`,
      tenant_id: tenantId || row.member.tenant_id,
      staff_id: row.member.id,
      payroll_month: payrollMonth,
      base_salary: baseSalary,
      allowances,
      bonus,
      deductions,
      gross_pay: grossPay,
      net_pay: netPay,
      payment_status: overrides.payment_status || row.paymentStatus || "unpaid",
      payment_method: overrides.payment_method || row.paymentMethod || "cash",
      notes: overrides.notes === undefined ? row.notes || null : overrides.notes,
      updated_at: new Date().toISOString(),
    };
  };

  const generatePayrollForAllActiveStaff = async () => {
    if (!tenantId) {
      toast.error("No active workspace");
      return;
    }

    if (allActiveStaffForPayroll.length === 0) {
      toast.error("No active staff found for payroll generation.");
      return;
    }

    const rowsToSave = allActiveStaffForPayroll.map((member) => {
      const existingRow = payrollRows.find((row) => String(row.member.id) === String(member.id));
      const baseSalary = safeNumber(existingRow?.baseSalary ?? member.salary);
      const allowances = existingRow?.allowances ?? Math.round(baseSalary * (Math.max(0, safeNumber(allowancePercent)) / 100));
      const bonus = existingRow?.bonus ?? Math.max(0, safeNumber(bonusAmount));
      const deductions = existingRow?.deductions ?? Math.round(baseSalary * (Math.max(0, safeNumber(deductionPercent)) / 100));

      return buildPayrollAdjustment(
        {
          member,
          baseSalary,
          allowances,
          bonus,
          deductions,
          paymentStatus: existingRow?.paymentStatus || "unpaid",
          paymentMethod: existingRow?.paymentMethod || "cash",
          notes: existingRow?.notes || "Generated payroll run",
        },
        { payment_status: "unpaid", notes: existingRow?.notes || "Generated payroll run" },
      );
    });

    await savePayrollAdjustmentRows(rowsToSave, `Payroll generated for ${rowsToSave.length} active staff members.`);
    setSelectedPayrollIds(rowsToSave.map((row) => String(row.staff_id)));
  };

  const togglePayrollSelection = (staffId: string) => {
    setSelectedPayrollIds((current) =>
      current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId],
    );
  };

  const toggleAllVisiblePayrollRows = () => {
    if (allVisiblePayrollSelected) {
      setSelectedPayrollIds((current) =>
        current.filter((id) => !payrollRows.some((row) => String(row.member.id) === id)),
      );
      return;
    }

    setSelectedPayrollIds((current) =>
      Array.from(new Set([...current, ...payrollRows.map((row) => String(row.member.id))])),
    );
  };

  const markSelectedPayrollPaid = async () => {
    if (selectedPayrollRows.length === 0) {
      toast.error("Select payroll rows first.");
      return;
    }

    const rowsToSave = selectedPayrollRows.map((row) =>
      buildPayrollAdjustment(row, { payment_status: "paid", notes: row.notes || "Bulk marked as paid" }),
    );

    await savePayrollAdjustmentRows(rowsToSave, `${rowsToSave.length} payroll rows marked as paid.`);
  };

  const deleteSelectedPayrollRows = async () => {
    if (selectedPayrollRows.length === 0) {
      toast.error("Select payroll rows first.");
      return;
    }

    const selectedIds = new Set(selectedPayrollRows.map((row) => String(row.member.id)));
    const existing = await getCachedTable(payrollCacheKey);
    const next = Array.isArray(existing)
      ? existing.filter((item: any) => !selectedIds.has(String(item.staff_id)))
      : [];

    await saveCachedTable(payrollCacheKey, next);
    queryClient.setQueryData(["staff-payroll-adjustments", tenantId, payrollMonth], next);
    setSelectedPayrollIds([]);
    toast.success(`${selectedIds.size} payroll entries deleted for this month.`);
  };

  const printSelectedPayslips = () => {
    if (selectedPayrollRows.length === 0) {
      toast.error("Select payroll rows first.");
      return;
    }

    selectedPayrollRows.forEach((row, index) => {
      window.setTimeout(() => printPayslip(row), index * 250);
    });
  };

  const deletePayrollEntry = async (row: any) => {
    const existing = await getCachedTable(payrollCacheKey);
    const next = Array.isArray(existing)
      ? existing.filter((item: any) => String(item.staff_id) !== String(row.member.id))
      : [];

    await saveCachedTable(payrollCacheKey, next);
    queryClient.setQueryData(["staff-payroll-adjustments", tenantId, payrollMonth], next);
    toast.success("Payroll entry deleted for this month. The staff record was not deleted.");
  };


  const savePayrollEntry = async () => {
    if (!tenantId) {
      toast.error("No active workspace");
      return;
    }
    if (!payrollEditorMember) return;

    const baseSalary = safeNumber(payrollForm.baseSalary);
    const allowances = safeNumber(payrollForm.allowances);
    const bonus = safeNumber(payrollForm.bonus);
    const deductions = safeNumber(payrollForm.deductions);
    const grossPay = baseSalary + allowances + bonus;
    const netPay = Math.max(0, grossPay - deductions);
    const now = new Date().toISOString();

    const row: PayrollAdjustment = {
      id: `${payrollMonth}-${payrollEditorMember.id}`,
      tenant_id: tenantId,
      staff_id: payrollEditorMember.id,
      payroll_month: payrollMonth,
      base_salary: baseSalary,
      allowances,
      bonus,
      deductions,
      gross_pay: grossPay,
      net_pay: netPay,
      payment_status: payrollForm.paymentStatus,
      payment_method: payrollForm.paymentMethod,
      notes: payrollForm.notes.trim() || null,
      updated_at: now,
    };

    const existing = await getCachedTable(payrollCacheKey);
    const next = [
      row,
      ...(Array.isArray(existing) ? existing.filter((item: any) => String(item.staff_id) !== String(row.staff_id)) : []),
    ];

    await saveCachedTable(payrollCacheKey, next);
    queryClient.setQueryData(["staff-payroll-adjustments", tenantId, payrollMonth], next);
    toast.success("Payroll entry saved.");
    closePayrollEditor();
  };

  const markPayrollPaid = async (row: any) => {
    setPayrollEditorMember(row.member);
    setPayrollForm({
      baseSalary: String(row.baseSalary || 0),
      allowances: String(row.allowances || 0),
      bonus: String(row.bonus || 0),
      deductions: String(row.deductions || 0),
      paymentStatus: "paid",
      paymentMethod: row.paymentMethod || "cash",
      notes: row.notes || "Marked as paid from payroll sheet",
    });

    const baseSalary = safeNumber(row.baseSalary);
    const allowances = safeNumber(row.allowances);
    const bonus = safeNumber(row.bonus);
    const deductions = safeNumber(row.deductions);
    const grossPay = baseSalary + allowances + bonus;
    const netPay = Math.max(0, grossPay - deductions);
    const paidRow: PayrollAdjustment = {
      id: `${payrollMonth}-${row.member.id}`,
      tenant_id: tenantId || row.member.tenant_id,
      staff_id: row.member.id,
      payroll_month: payrollMonth,
      base_salary: baseSalary,
      allowances,
      bonus,
      deductions,
      gross_pay: grossPay,
      net_pay: netPay,
      payment_status: "paid",
      payment_method: row.paymentMethod || "cash",
      notes: row.notes || "Marked as paid from payroll sheet",
      updated_at: new Date().toISOString(),
    };
    await savePayrollAdjustmentRows([paidRow], "Payroll row marked as paid.");
  };

  const resetPayrollEntry = async (row: any) => {
    const existing = await getCachedTable(payrollCacheKey);
    const next = Array.isArray(existing)
      ? existing.filter((item: any) => String(item.staff_id) !== String(row.member.id))
      : [];
    await saveCachedTable(payrollCacheKey, next);
    queryClient.setQueryData(["staff-payroll-adjustments", tenantId, payrollMonth], next);
    toast.success("Payroll row reset to staff salary defaults.");
  };

  const savePayrollRun = async () => {
    if (!tenantId) {
      toast.error("No active workspace");
      return;
    }

    const run = {
      id: `payroll-run-${payrollMonth}-${Date.now()}`,
      tenant_id: tenantId,
      payroll_month: payrollMonth,
      status: payrollRunStatus,
      staff_count: payrollStats.staffCount,
      base_salary: payrollStats.baseSalary,
      allowances: payrollStats.allowances,
      bonuses: payrollStats.bonuses,
      deductions: payrollStats.deductions,
      gross_pay: payrollStats.grossPay,
      net_pay: payrollStats.netPay,
      paid_amount: payrollStats.paidAmount,
      unpaid_amount: payrollStats.unpaidAmount,
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      items: payrollRows.map((row) => ({
        staff_id: row.member.id,
        staff_name: row.member.full_name,
        branch: row.member.branch,
        position: row.member.position,
        base_salary: row.baseSalary,
        allowances: row.allowances,
        bonus: row.bonus,
        deductions: row.deductions,
        gross_pay: row.grossPay,
        net_pay: row.netPay,
        payment_status: row.paymentStatus,
        payment_method: row.paymentMethod,
        notes: row.notes,
      })),
    };

    const key = `staff_payroll_runs_${tenantId}`;
    const existingRuns = await getCachedTable(key);
    const nextRuns = [run, ...(Array.isArray(existingRuns) ? existingRuns : [])];
    await saveCachedTable(key, nextRuns);
    await savePending("staff_payroll_runs", { ...run, operation: "create", sync_status: "pending" }).catch(() => undefined);
    toast.success("Payroll run saved and queued for synchronization.");
  };

  const printPayslip = (row: any) => {
    const win = window.open("", "_blank", "width=760,height=820");
    if (!win) {
      toast.error("Unable to open payslip window.");
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Payslip - ${row.member.full_name || "Staff"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            .header { border-bottom: 3px solid ${SHOPCORE_BLUE}; padding-bottom: 16px; margin-bottom: 20px; }
            h1 { margin: 0; color: ${SHOPCORE_BLUE}; font-size: 24px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
            .label { color: #64748b; font-size: 11px; text-transform: uppercase; }
            .value { font-size: 16px; font-weight: 800; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            td { border-bottom: 1px solid #e5e7eb; padding: 12px; }
            .total { background: #f8fafc; font-weight: 800; }
            .signature { margin-top: 50px; border-top: 1px solid #111827; padding-top: 8px; width: 45%; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ShopCore Payslip</h1>
            <p>Period: ${payrollMonth || "Current"} · Generated: ${formatDateTime(new Date().toISOString())}</p>
          </div>
          <div class="grid">
            <div class="card"><div class="label">Employee</div><div class="value">${row.member.full_name || "-"}</div></div>
            <div class="card"><div class="label">Position</div><div class="value">${row.member.position || "-"}</div></div>
            <div class="card"><div class="label">Branch</div><div class="value">${row.member.branch || "Unassigned"}</div></div>
            <div class="card"><div class="label">Payment Status</div><div class="value">${row.paymentStatus}</div></div>
          </div>
          <table>
            <tr><td>Base salary</td><td>${formatCurrency(row.baseSalary)}</td></tr>
            <tr><td>Allowances</td><td>${formatCurrency(row.allowances)}</td></tr>
            <tr><td>Bonus</td><td>${formatCurrency(row.bonus)}</td></tr>
            <tr><td>Deductions</td><td>${formatCurrency(row.deductions)}</td></tr>
            <tr class="total"><td>Net pay</td><td>${formatCurrency(row.netPay)}</td></tr>
          </table>
          <div class="signature">Employee Signature</div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const queueAttendanceRow = async (row: AttendanceRow) => {
    const existing = await getCachedTable(attendanceCacheKey);
    const next = [row, ...(Array.isArray(existing) ? existing.filter((item: any) => String(item.id) !== String(row.id)) : [])];
    await saveCachedTable(attendanceCacheKey, next);
    await savePending("staff_attendance", { ...row, sync_status: "pending", updated_offline_at: new Date().toISOString() }).catch(() => undefined);
    queryClient.setQueryData(["staff-attendance", tenantId], next);
  };

  const selectedAttendanceMember = () => {
    if (attendanceStaffId !== "all") return cleanStaff.find((member) => String(member.id) === String(attendanceStaffId));
    return cleanStaff.find((member) => getStaffStatus(member.status) === "active");
  };

  const clockInStaff = async () => {
    if (!tenantId) return toast.error("No active workspace");
    const member = selectedAttendanceMember();
    if (!member) return toast.error("Select an active staff member first.");
    const today = new Date().toISOString().slice(0, 10);
    const existing = attendanceRows.find((row) => row.staff_id === member.id && row.work_date === today && !row.clock_out);
    if (existing) return toast.info("This staff member is already clocked in today.");
    const now = new Date().toISOString();
    const row: AttendanceRow = { id: makeLocalId("staff-attendance"), tenant_id: tenantId, staff_id: member.id, staff_name: member.full_name, work_date: today, clock_in: now, clock_out: null, hours_worked: 0, status: "clocked_in", notes: null, created_at: now, updated_at: now, operation: "create", sync_status: "pending" };
    await queueAttendanceRow(row);
    toast.success(`${member.full_name || "Staff"} clocked in offline-ready.`);
  };

  const clockOutStaff = async (row?: AttendanceRow) => {
    const target = row || attendanceRows.find((item) => item.staff_id === selectedAttendanceMember()?.id && item.clock_in && !item.clock_out);
    if (!target?.clock_in) return toast.error("No active clock-in record found.");
    const now = new Date().toISOString();
    const hours = Math.max(0, (new Date(now).getTime() - new Date(target.clock_in).getTime()) / 3600000);
    const updated: AttendanceRow = { ...target, clock_out: now, hours_worked: Math.round(hours * 10) / 10, status: "completed", updated_at: now, operation: target.id.startsWith("staff-attendance") ? "create" : "update", sync_status: "pending" };
    await queueAttendanceRow(updated);
    toast.success("Clock-out saved and queued for sync.");
  };

  const createLeaveRequest = async () => {
    if (!tenantId) return toast.error("No active workspace");
    const member = leaveStaffId === "all" ? cleanStaff.find((item) => getStaffStatus(item.status) === "active") : cleanStaff.find((item) => String(item.id) === String(leaveStaffId));
    if (!member) return toast.error("Select a staff member first.");
    const start = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return toast.error("Enter a valid leave date range.");
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const now = new Date().toISOString();
    const row: LeaveRequestRow = { id: makeLocalId("staff-leave"), tenant_id: tenantId, staff_id: member.id, staff_name: member.full_name, leave_type: leaveType, start_date: leaveStartDate, end_date: leaveEndDate, days, reason: leaveReason.trim() || null, status: "pending", created_by: user?.id || null, created_at: now, updated_at: now, operation: "create", sync_status: "pending" };
    const existing = await getCachedTable(leaveCacheKey);
    const next = [row, ...(Array.isArray(existing) ? existing : [])];
    await saveCachedTable(leaveCacheKey, next);
    await savePending("staff_leave_requests", row).catch(() => undefined);
    queryClient.setQueryData(["staff-leave-requests", tenantId], next);
    setLeaveDialogOpen(false);
    setLeaveReason("");
    toast.success("Leave request saved and queued for sync.");
  };

  const updateLeaveStatus = async (row: LeaveRequestRow, newStatus: string) => {
    const updated = { ...row, status: newStatus, operation: row.id.startsWith("staff-leave") ? "create" : "update", sync_status: "pending", updated_at: new Date().toISOString() };
    const existing = await getCachedTable(leaveCacheKey);
    const next = [updated, ...(Array.isArray(existing) ? existing.filter((item: any) => String(item.id) !== String(row.id)) : [])];
    await saveCachedTable(leaveCacheKey, next);
    await savePending("staff_leave_requests", updated).catch(() => undefined);
    queryClient.setQueryData(["staff-leave-requests", tenantId], next);
    toast.success(`Leave request ${newStatus}.`);
  };

  const refreshStaffQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["profiles"] }),
    ]).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }
  };

  const saveStaffOffline = async (payload: any) => {
    if (!tenantId) throw new Error("No active workspace");

    const now = new Date().toISOString();
    const cachedStaff = await getCachedTable("staff");

    if (editing) {
      const isOfflineStaff =
        String(editing.id || "").startsWith("offline-") || !!editing.offline_id;
      const updatedStaff: StaffMember = {
        ...editing,
        ...payload,
        id: editing.id,
        tenant_id: editing.tenant_id || tenantId,
        operation: isOfflineStaff ? "create" : "update",
        sync_status: isOfflineStaff ? "pending" : "pending_update",
        updated_offline_at: now,
      };

      const nextRows = dedupeStaff([
        updatedStaff,
        ...(Array.isArray(cachedStaff) ? cachedStaff : []),
      ]);
      await saveCachedTable("staff", nextRows);
      await savePending("staff", updatedStaff);
      toast.success(
        "Staff updated offline. It will sync when internet returns.",
      );
    } else {
      const offlineStaff: StaffMember = {
        ...payload,
        id: makeLocalId("offline-staff"),
        tenant_id: tenantId,
        profile_id: null,
        operation: "create",
        sync_status: "pending",
        created_at: now,
        created_offline_at: now,
        updated_offline_at: now,
      };

      const nextRows = dedupeStaff([
        offlineStaff,
        ...(Array.isArray(cachedStaff) ? cachedStaff : []),
      ]);
      await saveCachedTable("staff", nextRows);
      await savePending("staff", offlineStaff);
      toast.success("Staff saved offline. It will sync when internet returns.");
    }

    closeDialog();
    await refreshStaffQueries();
  };

  const createStaff = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!fullName.trim()) throw new Error("Full name is required");
      if (!position.trim()) throw new Error("Position is required");

      const payload = normalizePayload({
        fullName,
        email,
        phone,
        role,
        position,
        branch,
        salary,
        status,
        hireDate,
        notes,
      });

      if (!canUseOnlineSupabase) {
        await saveStaffOffline(payload);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("staff")
        .insert({ tenant_id: tenantId, ...payload })
        .select()
        .single();

      if (error) throw error;

      const cachedStaff = await getCachedTable("staff");
      await saveCachedTable(
        "staff",
        dedupeStaff([data, ...(Array.isArray(cachedStaff) ? cachedStaff : [])]),
      );
    },
    onSuccess: async () => {
      await refreshStaffQueries();
      toast.success("Staff added successfully.");
      closeDialog();
    },
    onError: async (error: any) => {
      if (isNetworkError(error) || !isOnline()) {
        const payload = normalizePayload({
          fullName,
          email,
          phone,
          role,
          position,
          branch,
          salary,
          status,
          hireDate,
          notes,
        });
        await saveStaffOffline(payload);
        return;
      }
      toast.error(error?.message || "Failed to add staff");
    },
  });

  const updateStaff = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No active workspace");
      if (!editing) throw new Error("No staff selected");
      if (!fullName.trim()) throw new Error("Full name is required");
      if (!position.trim()) throw new Error("Position is required");

      const payload = normalizePayload({
        fullName,
        email,
        phone,
        role,
        position,
        branch,
        salary,
        status,
        hireDate,
        notes,
      });

      if (
        !canUseOnlineSupabase ||
        String(editing.id || "").startsWith("offline-") ||
        !!editing.offline_id
      ) {
        await saveStaffOffline(payload);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("staff")
        .update(payload)
        .eq("id", editing.id)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;

      const cachedStaff = await getCachedTable("staff");
      const nextRows = dedupeStaff([
        data,
        ...(Array.isArray(cachedStaff) ? cachedStaff : []),
      ]);
      await saveCachedTable("staff", nextRows);
    },
    onSuccess: async () => {
      await refreshStaffQueries();
      toast.success("Staff updated successfully.");
      closeDialog();
    },
    onError: async (error: any) => {
      if (isNetworkError(error) || !isOnline()) {
        const payload = normalizePayload({
          fullName,
          email,
          phone,
          role,
          position,
          branch,
          salary,
          status,
          hireDate,
          notes,
        });
        await saveStaffOffline(payload);
        return;
      }
      toast.error(error?.message || "Failed to update staff");
    },
  });

  const quickStatusUpdate = useMutation({
    mutationFn: async ({
      member,
      newStatus,
    }: {
      member: StaffMember;
      newStatus: string;
    }) => {
      if (!tenantId) throw new Error("No active workspace");

      if (
        !canUseOnlineSupabase ||
        String(member.id || "").startsWith("offline-")
      ) {
        const cachedStaff = await getCachedTable("staff");
        const patched = {
          ...member,
          status: newStatus,
          operation: String(member.id || "").startsWith("offline-")
            ? "create"
            : "update",
          sync_status: "pending_update",
          updated_offline_at: new Date().toISOString(),
        };

        await saveCachedTable(
          "staff",
          dedupeStaff([
            patched,
            ...(Array.isArray(cachedStaff) ? cachedStaff : []),
          ]),
        );
        await savePending("staff", patched);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("staff")
        .update({ status: newStatus })
        .eq("id", member.id)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;

      const cachedStaff = await getCachedTable("staff");
      await saveCachedTable(
        "staff",
        dedupeStaff([data, ...(Array.isArray(cachedStaff) ? cachedStaff : [])]),
      );
    },
    onSuccess: async () => {
      await refreshStaffQueries();
      toast.success("Staff status updated.");
    },
    onError: (error: any) =>
      toast.error(error?.message || "Failed to update staff status"),
  });

  const deleteStaff = useMutation({
    mutationFn: async (member: StaffMember) => {
      if (!tenantId) throw new Error("No active workspace");

      const cachedStaff = await getCachedTable("staff");

      if (!canUseOnlineSupabase || String(member.id || "").startsWith("offline-")) {
        if (String(member.id || "").startsWith("offline-")) {
          await saveCachedTable("staff", (Array.isArray(cachedStaff) ? cachedStaff : []).filter((row: any) => String(row.id) !== String(member.id)));
          return;
        }

        const archived = { ...member, operation: "update", sync_status: "pending_update", status: "inactive", notes: member.notes ? `${member.notes}
Archived from staff directory` : "Archived from staff directory", updated_offline_at: new Date().toISOString() };
        await savePending("staff", archived);
        await saveCachedTable("staff", (Array.isArray(cachedStaff) ? cachedStaff : []).map((row: any) => String(row.id) === String(member.id) ? archived : row));
        return;
      }

      const archivedPayload = { status: "inactive", notes: member.notes ? `${member.notes}
Archived from staff directory` : "Archived from staff directory" };
      const { data, error } = await (supabase as any).from("staff").update(archivedPayload).eq("id", member.id).eq("tenant_id", tenantId).select().single();
      if (error) throw error;
      await saveCachedTable("staff", dedupeStaff([data, ...(Array.isArray(cachedStaff) ? cachedStaff : [])]));
    },
    onSuccess: async () => {
      await refreshStaffQueries();
      toast.success("Staff archived successfully.");
      setDeleteTarget(null);
    },
    onError: async (error: any, member) => {
      if (isNetworkError(error) && member) {
        await savePending("staff", {
          ...member,
          operation: "delete",
          sync_status: "pending_delete",
          status: "deleted",
          updated_offline_at: new Date().toISOString(),
        });
        await refreshStaffQueries();
        toast.success("Network failed. Staff archive was queued offline.");
        setDeleteTarget(null);
        return;
      }
      toast.error(error?.message || "Failed to archive staff");
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setRole("Staff");
    setPosition("");
    setBranch("");
    setSalary("");
    setStatus("active");
    setHireDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setDialogOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setFullName(member.full_name || "");
    setEmail(member.email || "");
    setPhone(member.phone || "");
    setRole(member.role || "");
    setPosition(member.position || "");
    setBranch(member.branch || "");
    setSalary(member.salary ? String(member.salary) : "");
    setStatus(member.status || "active");
    setHireDate(member.hire_date || "");
    setNotes(member.notes || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (editing) updateStaff.mutate();
    else createStaff.mutate();
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setBranchFilter("all");
    setRoleFilter("all");
    setSyncFilter("all");
    setSortKey("created_at");
    setSortAsc(false);
    setPage(1);
  };

  const kpis = [
    {
      label: "Total Staff",
      value: stats.total,
      icon: Users,
      color: "bg-blue-600 text-white border-blue-600",
      helper: "team records",
    },
    {
      label: "Active Team",
      value: stats.active,
      icon: CheckCircle2,
      color: "bg-emerald-600 text-white border-emerald-600",
      helper: "available workforce",
    },
    {
      label: "Monthly Payroll",
      value: formatCurrency(stats.monthlyPayroll),
      icon: Wallet,
      color: "bg-orange-600 text-white border-orange-600",
      helper: "salary exposure",
    },
    {
      label: "Readiness",
      value: `${stats.readiness}%`,
      icon: ShieldCheck,
      color: "bg-violet-600 text-white border-violet-600",
      helper: "workforce controls",
    },
  ];

  return (
    <PageShell
      title="Staff"
      description="Manage team members, roles, branches, payroll, workforce readiness, and offline staff records."
    >
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="space-y-6">
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
                        ? "Staff module is using offline cache"
                        : "Staff changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Pending staff records: {stats.pendingSync}. Team data
                      remains available for branch operations while offline.
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

          <div className="rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-2">
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <Button variant="outline" className={`h-12 rounded-2xl ${workspaceView === "directory" ? BTN_PRIMARY : "border-blue-200 bg-white text-blue-700 hover:bg-blue-100"}`} onClick={() => setWorkspaceView("directory")}><Users className="mr-2 h-4 w-4" /> Staff Directory</Button>
              <Button variant="outline" className={`h-12 rounded-2xl ${workspaceView === "payroll" ? BTN_PURPLE : "border-violet-200 bg-white text-violet-700 hover:bg-violet-100"}`} onClick={() => setWorkspaceView("payroll")}><Receipt className="mr-2 h-4 w-4" /> Staff Payroll</Button>
              <Button variant="outline" className={`h-12 rounded-2xl ${workspaceView === "attendance" ? BTN_INFO : "border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-100"}`} onClick={() => setWorkspaceView("attendance")}><Clock3 className="mr-2 h-4 w-4" /> Attendance</Button>
              <Button variant="outline" className={`h-12 rounded-2xl ${workspaceView === "leave" ? BTN_WARNING : "border-orange-200 bg-white text-orange-700 hover:bg-orange-100"}`} onClick={() => setWorkspaceView("leave")}><CalendarDays className="mr-2 h-4 w-4" /> Leave Requests</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5 overflow-hidden relative">
              <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-100" />
              <div className="absolute -right-8 top-20 h-20 w-20 rounded-full bg-orange-100" />

              <div className="relative flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0"
                >
                  <UserCog className="w-7 h-7" />
                </div>

                <div className="min-w-0">
                  <Badge className="rounded-full bg-blue-600 text-white border-blue-600 mb-3">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    Team Operations Center
                  </Badge>
                  <h2 className="text-2xl font-bold tracking-tight">
                    Staff Workforce Control Room
                  </h2>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                    Manage staff records, roles, branch assignments, payroll
                    exposure, employment status, contact readiness, and offline
                    HR updates.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                      <p className="text-xs text-slate-600">
                        Active Rate
                      </p>
                      <p className="text-sm font-semibold font-data">
                        {stats.activeRate}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-orange-800">
                      <p className="text-xs text-slate-600">
                        Avg Salary
                      </p>
                      <p className="text-sm font-semibold font-data">
                        {formatCurrency(stats.avgSalary)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-cyan-800">
                      <p className="text-xs text-slate-600">
                        Filtered Staff
                      </p>
                      <p className="text-sm font-semibold font-data">
                        {filteredStaff.length}
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
                    className={`rounded-3xl border shadow-sm p-4 ${item.color}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium opacity-80">
                          {item.label}
                        </p>
                        <p className={`${valueClass} font-bold font-data mt-1`}>
                          {item.value}
                        </p>
                        <p className="text-[11px] opacity-75 truncate">{item.helper}</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-4 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center"
                >
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Staff Readiness</h3>
                  <p className="text-xs text-slate-600">
                    Workforce health score
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div
                  className="h-32 w-32 shrink-0 rounded-full bg-blue-100 p-3"
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-center">
                    <div>
                      <p className="text-3xl font-black font-data">
                        {stats.readiness}%
                      </p>
                      <p className="text-[10px] uppercase text-slate-600">
                        Ready
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  <div className="rounded-2xl bg-cyan-50 p-3">
                    <p className="text-xs text-slate-600">
                      Missing Contacts
                    </p>
                    <p className="font-bold font-data">
                      {stats.missingContact}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-cyan-50 p-3">
                    <p className="text-xs text-slate-600">
                      Inactive Staff
                    </p>
                    <p className="font-bold font-data">{stats.inactive}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-cyan-200 bg-cyan-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Branch Coverage</h3>
                  <p className="text-xs text-slate-600">
                    Staff distribution by branch
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {branchDistribution.length === 0 ? (
                  <div className="rounded-2xl border bg-violet-50 py-8 text-center text-sm text-slate-600">
                    No branch data
                  </div>
                ) : (
                  branchDistribution.map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="truncate">{item.name}</span>
                        <span className="font-data text-slate-600">
                          {item.count} · {item.percent}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-blue-50 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.percent}%`,
                            background: SHOPCORE_BLUE,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="xl:col-span-4 rounded-3xl border border-orange-200 bg-orange-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Payroll Shape</h3>
                  <p className="text-xs text-slate-600">
                    Payroll weight by branch
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {payrollByBranch.length === 0 ? (
                  <div className="rounded-2xl border bg-violet-50 py-8 text-center text-sm text-slate-600">
                    No payroll data
                  </div>
                ) : (
                  payrollByBranch.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-2xl bg-blue-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium">
                          {item.name}
                        </span>
                        <span className="font-data text-slate-600">
                          {formatCurrency(item.payroll)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-background overflow-hidden">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 rounded-3xl border border-violet-200 bg-violet-50 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Role Mix</h3>
                  <p className="text-xs text-slate-600">
                    Operational team composition
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {roleDistribution.length === 0 ? (
                  <div className="col-span-full rounded-2xl border bg-violet-50 py-8 text-center text-sm text-slate-600">
                    No role data
                  </div>
                ) : (
                  roleDistribution.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-2xl border bg-blue-50 p-3"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <Award className="w-4 h-4 text-violet-600" />
                        <span className="text-xs font-data text-slate-600">
                          {item.percent}%
                        </span>
                      </div>
                      <p className="truncate text-sm font-semibold">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {item.count} staff
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="xl:col-span-7 rounded-3xl border border-emerald-200 bg-emerald-50 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">Workforce Intelligence</h3>
                  <p className="text-xs text-slate-600">
                    Smart operational observations from the current team data
                  </p>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border bg-blue-50 p-4">
                      <p className="text-xs text-slate-600">
                        Coverage Risk
                      </p>
                      <p className="mt-1 font-bold">
                        {stats.branchesCount === 0
                          ? "No branches"
                          : stats.active === 0
                            ? "No active staff"
                            : "Controlled"}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-blue-50 p-4">
                      <p className="text-xs text-slate-600">
                        Payroll Load
                      </p>
                      <p className="mt-1 font-bold font-data">
                        {formatCurrency(stats.totalPayroll)}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-blue-50 p-4">
                      <p className="text-xs text-slate-600">
                        Action Needed
                      </p>
                      <p className="mt-1 font-bold">
                        {stats.missingContact > 0
                          ? `${stats.missingContact} contact gaps`
                          : stats.pendingSync > 0
                            ? "Sync pending"
                            : "None"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {workspaceView === "payroll" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7 rounded-3xl border border-blue-200 bg-blue-50 shadow-sm p-5 overflow-hidden relative">
                  <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-500/10" />
                  <div className="absolute right-24 -bottom-14 h-32 w-32 rounded-full bg-blue-500/10" />

                  <div className="relative flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
                      <Receipt className="w-7 h-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Badge className="rounded-full bg-orange-500/10 text-orange-600 border-orange-500/20 mb-3">
                        Payroll Workspace
                      </Badge>
                      <h2 className="text-2xl font-bold tracking-tight">
                        Staff Payroll Manager
                      </h2>
                      <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                        Create, edit, approve, pay, print payslips, and export payroll directly from staff salary records with per-employee overrides.
                      </p>

                      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Payroll Month
                          </label>
                          <Input
                            type="month"
                            value={payrollMonth}
                            onChange={(event) => setPayrollMonth(event.target.value)}
                            className="mt-1 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Allowance %
                          </label>
                          <Input
                            type="number"
                            value={allowancePercent}
                            onChange={(event) => setAllowancePercent(event.target.value)}
                            className="mt-1 rounded-xl"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Bonus / Staff
                          </label>
                          <Input
                            type="number"
                            value={bonusAmount}
                            onChange={(event) => setBonusAmount(event.target.value)}
                            className="mt-1 rounded-xl"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Deduction %
                          </label>
                          <Input
                            type="number"
                            value={deductionPercent}
                            onChange={(event) => setDeductionPercent(event.target.value)}
                            className="mt-1 rounded-xl"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Select value={payrollStatusFilter} onValueChange={setPayrollStatusFilter}>
                          <SelectTrigger className="h-11 w-[180px] rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Payroll Rows</SelectItem>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="pending_sync">Pending Sync</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={payrollRunStatus} onValueChange={setPayrollRunStatus}>
                          <SelectTrigger className="h-11 w-[170px] rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Run: Draft</SelectItem>
                            <SelectItem value="approved">Run: Approved</SelectItem>
                            <SelectItem value="paid">Run: Paid</SelectItem>
                            <SelectItem value="locked">Run: Locked</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={payrollNewStaffId} onValueChange={setPayrollNewStaffId}>
                          <SelectTrigger className="h-11 w-[220px] rounded-2xl">
                            <SelectValue placeholder="Choose staff" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">First Active Staff</SelectItem>
                            {allActiveStaffForPayroll.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.full_name || "Unnamed Staff"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button className={`h-11 rounded-2xl ${BTN_PRIMARY}`} onClick={generatePayrollForAllActiveStaff}>
                          <Users className="mr-2 h-4 w-4" />
                          Generate Payroll for All Active Staff
                        </Button>

                        <Button variant="outline" className="h-11 rounded-2xl" onClick={createPayrollEntryForStaff}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add / Edit One Staff
                        </Button>

                        <Button variant="outline" className="h-11 rounded-2xl" onClick={printPayrollSummary}>
                          <Printer className="mr-2 h-4 w-4" />
                          Print Payroll
                        </Button>

                        <Button variant="outline" className="h-11 rounded-2xl" onClick={exportPayrollCsv}>
                          <Download className="mr-2 h-4 w-4" />
                          Download CSV
                        </Button>

                        <Button className={`h-11 rounded-2xl ${BTN_PRIMARY}`} onClick={savePayrollRun}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Create / Save Payroll Run
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-5 grid grid-cols-2 gap-3">
                  {[
                    { label: "Staff Included", value: payrollStats.staffCount, icon: Users, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
                    { label: "Net Payroll", value: formatCurrency(payrollStats.netPay), icon: Wallet, color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
                    { label: "Paid Amount", value: formatCurrency(payrollStats.paidAmount), icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
                    { label: "Unpaid Amount", value: formatCurrency(payrollStats.unpaidAmount), icon: AlertTriangle, color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
                  ].map((item) => {
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-4 rounded-3xl border bg-white shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Payroll Breakdown</h3>
                      <p className="text-xs text-slate-600">Gross to net preview</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Base Salary", value: payrollStats.baseSalary, tone: "bg-blue-500" },
                      { label: "Allowances", value: payrollStats.allowances, tone: "bg-emerald-500" },
                      { label: "Bonuses", value: payrollStats.bonuses, tone: "bg-violet-500" },
                      { label: "Deductions", value: payrollStats.deductions, tone: "bg-rose-500" },
                    ].map((item) => {
                      const maxValue = Math.max(payrollStats.grossPay, 1);
                      const width = Math.min(100, Math.round((item.value / maxValue) * 100));
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>{item.label}</span>
                            <span className="font-data text-slate-600">
                              {formatCurrency(item.value)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-blue-50 overflow-hidden">
                            <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="xl:col-span-4 rounded-3xl border bg-white shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Payroll by Role</h3>
                      <p className="text-xs text-slate-600">Net pay weight per role</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {payrollByRole.length === 0 ? (
                      <div className="rounded-2xl border bg-violet-50 py-8 text-center text-sm text-slate-600">
                        No payroll role data
                      </div>
                    ) : (
                      payrollByRole.map((item) => (
                        <div key={item.name} className="rounded-2xl bg-blue-50 p-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate font-medium">{item.name}</span>
                            <span className="font-data text-slate-600">
                              {formatCurrency(item.amount)}
                            </span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-background overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${item.percent}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="xl:col-span-4 rounded-3xl border bg-white shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Payroll Controls</h3>
                      <p className="text-xs text-slate-600">Current payroll readiness</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-blue-50 p-4">
                      <p className="text-xs text-slate-600">Average Net</p>
                      <p className="mt-1 font-bold font-data">{formatCurrency(payrollStats.averageNet)}</p>
                    </div>
                    <div className="rounded-2xl border bg-blue-50 p-4">
                      <p className="text-xs text-slate-600">Pending Rows</p>
                      <p className="mt-1 font-bold font-data">{payrollStats.pending}</p>
                    </div>
                    <div className="col-span-2 rounded-2xl border bg-blue-50 p-4">
                      <p className="text-xs text-slate-600">Payroll Note</p>
                      <p className="mt-1 text-sm">
                        Use Generate Payroll for All Active Staff for large teams, then edit only exceptions. Selected rows can be paid, deleted, printed, or exported in bulk.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b p-4">
                  <div>
                    <h3 className="font-semibold">Payroll Sheet</h3>
                    <p className="text-xs text-slate-600">
                      Period {payrollMonth || "current"} · {payrollRows.length} active staff rows
                    </p>
                  </div>
                  <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 capitalize">
                    {payrollRunStatus} Run
                  </Badge>
                </div>

                <div className="border-b bg-violet-50 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={toggleAllVisiblePayrollRows}>
                        {allVisiblePayrollSelected ? "Clear Visible" : "Select Visible"}
                      </Button>
                      <Badge variant="outline" className="rounded-full">
                        {selectedPayrollRows.length} selected
                      </Badge>
                      <Badge variant="outline" className="rounded-full">
                        {allActiveStaffForPayroll.length} active staff available
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={markSelectedPayrollPaid}>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                        Mark Selected Paid
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={printSelectedPayslips}>
                        <Receipt className="mr-2 h-4 w-4" />
                        Print Selected Payslips
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl text-rose-600" onClick={deleteSelectedPayrollRows}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-50/50 text-xs text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">
                          <input
                            type="checkbox"
                            checked={allVisiblePayrollSelected}
                            onChange={toggleAllVisiblePayrollRows}
                            aria-label="Select all visible payroll rows"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-medium">Staff</th>
                        <th className="px-4 py-3 text-left font-medium">Branch</th>
                        <th className="px-4 py-3 text-right font-medium">Base</th>
                        <th className="px-4 py-3 text-right font-medium">Allowances</th>
                        <th className="px-4 py-3 text-right font-medium">Bonus</th>
                        <th className="px-4 py-3 text-right font-medium">Deductions</th>
                        <th className="px-4 py-3 text-right font-medium">Net Pay</th>
                        <th className="px-4 py-3 text-right font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-slate-600">
                            No active payroll rows found.
                          </td>
                        </tr>
                      ) : (
                        payrollRows.map((row) => (
                          <tr key={row.member.id} className="border-t">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedPayrollIds.includes(String(row.member.id))}
                                onChange={() => togglePayrollSelection(String(row.member.id))}
                                aria-label={`Select payroll for ${row.member.full_name || "staff"}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{row.member.full_name || "-"}</div>
                              <div className="text-xs text-slate-600">{row.member.position || "No position"}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{row.member.branch || "Unassigned"}</td>
                            <td className="px-4 py-3 text-right font-data">{formatCurrency(row.baseSalary)}</td>
                            <td className="px-4 py-3 text-right font-data">{formatCurrency(row.allowances)}</td>
                            <td className="px-4 py-3 text-right font-data">{formatCurrency(row.bonus)}</td>
                            <td className="px-4 py-3 text-right font-data text-rose-600">{formatCurrency(row.deductions)}</td>
                            <td className="px-4 py-3 text-right font-bold font-data">{formatCurrency(row.netPay)}</td>
                            <td className="px-4 py-3 text-right">
                              <Badge
                                variant="outline"
                                className={
                                  row.payrollStatus === "pending_sync"
                                    ? "rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30"
                                    : row.paymentStatus === "paid"
                                      ? "rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                      : row.paymentStatus === "draft"
                                        ? "rounded-full bg-blue-50 text-slate-600 border-muted"
                                        : "rounded-full bg-amber-500/10 text-amber-600 border-amber-500/30"
                                }
                              >
                                {row.payrollStatus === "pending_sync"
                                  ? "Pending Sync"
                                  : row.paymentStatus.replace(/_/g, " ")}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openPayrollEditor(row)}>
                                  <Pencil className="mr-1 h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => markPayrollPaid(row)}>
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                                  Pay
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => printPayslip(row)}>
                                  <Receipt className="mr-1 h-3.5 w-3.5" />
                                  Slip
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => resetPayrollEntry(row)}>
                                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                  Reset
                                </Button>
                                <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => deletePayrollEntry(row)}>
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {workspaceView === "attendance" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                  <div className="flex items-start gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-white"><Clock3 className="h-7 w-7" /></div><div className="min-w-0 flex-1"><Badge className="mb-3 rounded-full bg-cyan-600 text-white hover:bg-cyan-600">Attendance Control</Badge><h2 className="text-2xl font-bold tracking-tight">Attendance & Shift Register</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Clock staff in and out, review working hours, and keep attendance records available offline for branch operations.</p><div className="mt-4 flex flex-wrap gap-2"><Select value={attendanceStaffId} onValueChange={setAttendanceStaffId}><SelectTrigger className="h-11 w-[220px] rounded-2xl bg-white"><SelectValue placeholder="Choose staff" /></SelectTrigger><SelectContent><SelectItem value="all">First Active Staff</SelectItem>{allActiveStaffForPayroll.map((member) => <SelectItem key={member.id} value={member.id}>{member.full_name || "Unnamed Staff"}</SelectItem>)}</SelectContent></Select><Select value={attendanceStatusFilter} onValueChange={setAttendanceStatusFilter}><SelectTrigger className="h-11 w-[170px] rounded-2xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Today</SelectItem><SelectItem value="clocked_in">Clocked In</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select><Button className={`h-11 rounded-2xl ${BTN_INFO}`} onClick={clockInStaff}><Clock3 className="mr-2 h-4 w-4" /> Clock In</Button><Button className={`h-11 rounded-2xl ${BTN_SUCCESS}`} onClick={() => clockOutStaff()}><CheckCircle2 className="mr-2 h-4 w-4" /> Clock Out</Button></div></div></div>
                </div>
                <div className="xl:col-span-5 grid grid-cols-2 gap-3">
                  {[{ label: "Today Records", value: attendanceStats.today, icon: Clock3, color: "bg-cyan-600 text-white border-cyan-600" }, { label: "Clocked In", value: attendanceStats.clockedIn, icon: Users, color: "bg-blue-600 text-white border-blue-600" }, { label: "Completed", value: attendanceStats.completed, icon: CheckCircle2, color: "bg-emerald-600 text-white border-emerald-600" }, { label: "Hours", value: attendanceStats.totalHours, icon: BarChart3, color: "bg-violet-600 text-white border-violet-600" }].map((item) => { const Icon = item.icon; return <div key={item.label} className={`rounded-3xl border p-4 shadow-sm ${item.color}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs opacity-80">{item.label}</p><p className="mt-1 text-2xl font-bold font-data">{item.value}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"><Icon className="h-5 w-5" /></div></div></div>; })}
                </div>
              </div>
              <div className="rounded-3xl border border-cyan-200 bg-white shadow-sm overflow-hidden"><div className="border-b bg-cyan-50 p-4"><h3 className="font-semibold">Today's Attendance</h3><p className="text-xs text-slate-600">Offline-safe clock-in and clock-out register.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-cyan-50 text-xs text-slate-600"><tr><th className="px-4 py-3 text-left">Staff</th><th className="px-4 py-3 text-left">Clock In</th><th className="px-4 py-3 text-left">Clock Out</th><th className="px-4 py-3 text-right">Hours</th><th className="px-4 py-3 text-right">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{todayAttendanceRows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">No attendance records for this view.</td></tr> : todayAttendanceRows.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-3 font-medium">{row.staff_name || row.staff_id}</td><td className="px-4 py-3 text-slate-600">{formatDateTime(row.clock_in)}</td><td className="px-4 py-3 text-slate-600">{formatDateTime(row.clock_out)}</td><td className="px-4 py-3 text-right font-data">{row.hours_worked}</td><td className="px-4 py-3 text-right"><Badge variant="outline" className={`rounded-full ${row.status === "completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-cyan-500/10 text-cyan-600 border-cyan-500/30"}`}>{row.status.replace(/_/g, " ")}</Badge></td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" disabled={!!row.clock_out} onClick={() => clockOutStaff(row)}>Clock Out</Button></td></tr>)}</tbody></table></div></div>
            </div>
          )}

          {workspaceView === "leave" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7 rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm"><div className="flex items-start gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white"><CalendarDays className="h-7 w-7" /></div><div className="min-w-0 flex-1"><Badge className="mb-3 rounded-full bg-orange-600 text-white hover:bg-orange-600">Leave Management</Badge><h2 className="text-2xl font-bold tracking-tight">Leave Request Desk</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Create, approve, reject, and synchronize leave requests without leaving the Staff module.</p><div className="mt-4"><Button className={`h-11 rounded-2xl ${BTN_WARNING}`} onClick={() => setLeaveDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Leave Request</Button></div></div></div></div>
                <div className="xl:col-span-5 grid grid-cols-2 gap-3">
                  {[{ label: "Requests", value: leaveStats.total, icon: FileText, color: "bg-blue-600 text-white border-blue-600" }, { label: "Pending", value: leaveStats.pending, icon: AlertTriangle, color: "bg-orange-600 text-white border-orange-600" }, { label: "Approved", value: leaveStats.approved, icon: CheckCircle2, color: "bg-emerald-600 text-white border-emerald-600" }, { label: "Rejected", value: leaveStats.rejected, icon: XCircle, color: "bg-rose-600 text-white border-rose-600" }].map((item) => { const Icon = item.icon; return <div key={item.label} className={`rounded-3xl border p-4 shadow-sm ${item.color}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs opacity-80">{item.label}</p><p className="mt-1 text-2xl font-bold font-data">{item.value}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"><Icon className="h-5 w-5" /></div></div></div>; })}
                </div>
              </div>
              <div className="rounded-3xl border border-orange-200 bg-white shadow-sm overflow-hidden"><div className="border-b bg-orange-50 p-4"><h3 className="font-semibold">Leave Requests</h3><p className="text-xs text-slate-600">Requests are cached locally and queued for synchronization.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-orange-50 text-xs text-slate-600"><tr><th className="px-4 py-3 text-left">Staff</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Dates</th><th className="px-4 py-3 text-right">Days</th><th className="px-4 py-3 text-right">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{leaveRequests.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">No leave requests yet.</td></tr> : leaveRequests.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-3 font-medium">{row.staff_name || row.staff_id}<p className="text-xs text-slate-600">{row.reason || "No reason provided"}</p></td><td className="px-4 py-3 capitalize text-slate-600">{row.leave_type.replace(/_/g, " ")}</td><td className="px-4 py-3 text-slate-600">{formatDate(row.start_date)} → {formatDate(row.end_date)}</td><td className="px-4 py-3 text-right font-data">{row.days}</td><td className="px-4 py-3 text-right"><Badge variant="outline" className={`rounded-full ${row.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : row.status === "rejected" ? "bg-rose-500/10 text-rose-600 border-rose-500/30" : "bg-orange-500/10 text-orange-600 border-orange-500/30"}`}>{row.status}</Badge></td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => updateLeaveStatus(row, "approved")}>Approve</Button><Button variant="ghost" size="sm" className="text-rose-600" onClick={() => updateLeaveStatus(row, "rejected")}>Reject</Button></div></td></tr>)}</tbody></table></div></div>
            </div>
          )}

          {workspaceView === "directory" && (
            <>
          <div className="rounded-3xl border border-blue-200 bg-white shadow-sm p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-2xl bg-blue-50/50 px-4">
                <Search className="h-5 w-5 text-slate-600" />
                <input
                  placeholder="Search name, email, phone, role, position, branch, or notes..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-12 w-full rounded-2xl xl:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={branchFilter}
                onValueChange={(value) => {
                  setBranchFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-12 w-full rounded-2xl xl:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branchName) => (
                    <SelectItem key={branchName} value={branchName}>
                      {branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-12 w-full rounded-2xl xl:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((roleName) => (
                    <SelectItem key={roleName} value={roleName}>
                      {roleName}
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
                <SelectTrigger className="h-12 w-full rounded-2xl xl:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sync</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortKey}
                onValueChange={(value) => setSortKey(value as SortKey)}
              >
                <SelectTrigger className="h-12 w-full rounded-2xl xl:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Newest</SelectItem>
                  <SelectItem value="full_name">Name</SelectItem>
                  <SelectItem value="position">Position</SelectItem>
                  <SelectItem value="branch">Branch</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                  <SelectItem value="hire_date">Hire Date</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="h-12 rounded-2xl"
                onClick={() => setSortAsc(!sortAsc)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                {sortAsc ? "Asc" : "Desc"}
              </Button>

              <Button
                variant="ghost"
                className="h-12 rounded-2xl text-blue-700"
                onClick={resetFilters}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>

              <Button
                onClick={openCreate}
                className={`h-12 rounded-2xl px-5 ${BTN_PRIMARY}`}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {isLoading ? (
              <div className="rounded-3xl border border-cyan-200 bg-cyan-50 py-12 text-center text-slate-600">
                Loading staff...
              </div>
            ) : pagedStaff.length === 0 ? (
              <div className="rounded-3xl border border-blue-200 bg-blue-50 py-16 text-center text-slate-600">
                <UserCog className="mx-auto mb-3 h-12 w-12 opacity-30" />
                No staff found
              </div>
            ) : (
              pagedStaff.map((member) => {
                const memberStatus = getStaffStatus(member.status);
                const pending = isPendingSync(member);

                return (
                  <div
                    key={member.id}
                    className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                      <div className="flex items-center gap-3 lg:col-span-3">
                        <div
                          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 font-bold text-white"
                        >
                          {getInitials(member.full_name)}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {member.full_name || "-"}
                          </p>
                          <p className="text-xs text-slate-600">
                            {member.position || "No position"}
                          </p>
                          {pending && (
                            <Badge
                              variant="outline"
                              className="mt-1 rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30"
                            >
                              <UploadCloud className="mr-1 h-3 w-3" />
                              Pending Sync
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="lg:col-span-2">
                        <p className="text-xs text-slate-600">Contact</p>
                        <p className="flex items-center gap-1 truncate text-xs">
                          <Mail className="h-3 w-3" />
                          {member.email || "No email"}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-slate-600">
                          <Phone className="h-3 w-3" />
                          {member.phone || "No phone"}
                        </p>
                      </div>

                      <div className="lg:col-span-2">
                        <p className="text-xs text-slate-600">Role</p>
                        <p className="flex items-center gap-1 text-sm">
                          <Briefcase className="h-3 w-3 text-slate-600" />
                          {member.role || "-"}
                        </p>
                      </div>

                      <div className="lg:col-span-2">
                        <p className="text-xs text-slate-600">Branch</p>
                        <p className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-slate-600" />
                          {member.branch || "Unassigned"}
                        </p>
                      </div>

                      <div className="lg:col-span-1">
                        <Badge
                          variant="outline"
                          className={`rounded-full capitalize ${statusClass(member.status)}`}
                        >
                          {memberStatus === "active" ? (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          ) : (
                            <XCircle className="mr-1 h-3 w-3" />
                          )}
                          {member.status || "active"}
                        </Badge>
                      </div>

                      <div className="lg:col-span-1">
                        <p className="text-xs text-slate-600">Salary</p>
                        <p className="text-sm font-semibold font-data">
                          {formatCurrency(safeNumber(member.salary))}
                        </p>
                      </div>

                      <div className="flex justify-end gap-1 lg:col-span-1">
                        {memberStatus === "active" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              quickStatusUpdate.mutate({
                                member,
                                newStatus: "inactive",
                              })
                            }
                            disabled={quickStatusUpdate.isPending}
                          >
                            <XCircle className="h-4 w-4 text-rose-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              quickStatusUpdate.mutate({
                                member,
                                newStatus: "active",
                              })
                            }
                            disabled={quickStatusUpdate.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(member)}
                        >
                          <Pencil className="h-4 w-4 text-sky-600" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(member)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-4">
                      <div className="flex items-center gap-2 rounded-2xl bg-cyan-50 px-4 py-2">
                        <CalendarDays className="h-3 w-3" />
                        Hired: {formatDate(member.hire_date)}
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl bg-cyan-50 px-4 py-2">
                        <Clock3 className="h-3 w-3" />
                        Created: {formatDateTime(member.created_at)}
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl bg-cyan-50 px-4 py-2">
                        <Wallet className="h-3 w-3" />
                        Annual: {formatCurrency(safeNumber(member.salary) * 12)}
                      </div>
                      <div className="truncate rounded-2xl bg-cyan-50 px-4 py-2">
                        Notes: {member.notes || "No notes"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-blue-200 bg-blue-50 shadow-sm px-4 py-3">
              <p className="text-xs text-slate-600">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredStaff.length)} of{" "}
                {filteredStaff.length}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Badge variant="outline" className="rounded-full">
                  Page {currentPage} / {totalPages}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Staff" : "Add Staff"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update team member information. Offline changes will sync later."
                  : "Create a new team member for this workspace. Full name and position are required."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Full Name *
                </label>
                <Input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="rounded-xl"
                  placeholder="Employee name"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Email
                </label>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded-xl"
                  placeholder="name@email.com"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Phone
                </label>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="rounded-xl"
                  placeholder="+250..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Role
                </label>
                <Input
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="Cashier"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Position *
                </label>
                <Input
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  className="rounded-xl"
                  placeholder="Store Manager"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Branch
                </label>
                <Input
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  placeholder="Main Branch"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Salary
                </label>
                <Input
                  type="number"
                  value={salary}
                  onChange={(event) => setSalary(event.target.value)}
                  className="rounded-xl"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Hire Date
                </label>
                <Input
                  type="date"
                  value={hireDate}
                  onChange={(event) => setHireDate(event.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Notes
                </label>
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="rounded-xl"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            {offlineModeActive && (
              <div className="rounded-2xl border bg-amber-500/10 p-3 text-sm text-amber-700">
                Staff changes will be saved locally first and synced when
                internet returns.
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createStaff.isPending || updateStaff.isPending}
                className={BTN_PRIMARY}
              >
                {createStaff.isPending || updateStaff.isPending
                  ? "Saving..."
                  : editing
                    ? "Update"
                    : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
          <DialogContent className="max-w-xl rounded-3xl">
            <DialogHeader><DialogTitle>New Leave Request</DialogTitle><DialogDescription>Create an offline-ready leave request for approval and synchronization.</DialogDescription></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="text-xs font-medium text-slate-600">Staff Member</label><Select value={leaveStaffId} onValueChange={setLeaveStaffId}><SelectTrigger className="rounded-xl border-blue-200 bg-blue-50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">First Active Staff</SelectItem>{allActiveStaffForPayroll.map((member) => <SelectItem key={member.id} value={member.id}>{member.full_name || "Unnamed Staff"}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs font-medium text-slate-600">Leave Type</label><Select value={leaveType} onValueChange={setLeaveType}><SelectTrigger className="rounded-xl border-orange-200 bg-orange-50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="annual">Annual Leave</SelectItem><SelectItem value="sick">Sick Leave</SelectItem><SelectItem value="emergency">Emergency Leave</SelectItem><SelectItem value="unpaid">Unpaid Leave</SelectItem><SelectItem value="maternity">Maternity Leave</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs font-medium text-slate-600">Start Date</label><Input type="date" value={leaveStartDate} onChange={(event) => setLeaveStartDate(event.target.value)} className="rounded-xl border-cyan-200 bg-cyan-50" /></div>
              <div><label className="text-xs font-medium text-slate-600">End Date</label><Input type="date" value={leaveEndDate} onChange={(event) => setLeaveEndDate(event.target.value)} className="rounded-xl border-violet-200 bg-violet-50" /></div>
              <div className="sm:col-span-2"><label className="text-xs font-medium text-slate-600">Reason</label><Input value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} className="rounded-xl border-emerald-200 bg-emerald-50" placeholder="Reason for leave" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>Cancel</Button><Button className={BTN_WARNING} onClick={createLeaveRequest}>Save Leave Request</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={payrollEditorOpen} onOpenChange={setPayrollEditorOpen}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{payrollEditorMember ? "Create / Edit Payroll Entry" : "Payroll Entry"}</DialogTitle>
              <DialogDescription>
                Modify payroll for {payrollEditorMember?.full_name || "this staff member"} for {payrollMonth}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Base Salary</label>
                <Input type="number" value={payrollForm.baseSalary} onChange={(e) => setPayrollForm({ ...payrollForm, baseSalary: e.target.value })} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Allowances</label>
                <Input type="number" value={payrollForm.allowances} onChange={(e) => setPayrollForm({ ...payrollForm, allowances: e.target.value })} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Bonus</label>
                <Input type="number" value={payrollForm.bonus} onChange={(e) => setPayrollForm({ ...payrollForm, bonus: e.target.value })} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Deductions</label>
                <Input type="number" value={payrollForm.deductions} onChange={(e) => setPayrollForm({ ...payrollForm, deductions: e.target.value })} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Payment Status</label>
                <Select value={payrollForm.paymentStatus} onValueChange={(value) => setPayrollForm({ ...payrollForm, paymentStatus: value })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Payment Method</label>
                <Select value={payrollForm.paymentMethod} onValueChange={(value) => setPayrollForm({ ...payrollForm, paymentMethod: value })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Payroll Notes</label>
                <Input value={payrollForm.notes} onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })} className="rounded-xl" placeholder="Optional payroll notes" />
              </div>
            </div>

            <div className="rounded-2xl border bg-blue-50 p-4">
              <p className="text-xs text-slate-600">Net Pay Preview</p>
              <p className="mt-1 text-2xl font-bold font-data">
                {formatCurrency(Math.max(0, safeNumber(payrollForm.baseSalary) + safeNumber(payrollForm.allowances) + safeNumber(payrollForm.bonus) - safeNumber(payrollForm.deductions)))}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closePayrollEditor}>Cancel</Button>
              <Button className={BTN_PRIMARY} onClick={savePayrollEntry}>Save Payroll Entry</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!deleteTarget}
          onOpenChange={() => setDeleteTarget(null)}
        >
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                Archive Staff
              </DialogTitle>
              <DialogDescription>
                Archive "{deleteTarget?.full_name}"? This keeps payroll and audit history safe. Offline archives will be queued for sync.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteStaff.mutate(deleteTarget)}
                disabled={deleteStaff.isPending}
              >
                {deleteStaff.isPending ? "Archiving..." : "Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBackground>
    </PageShell>
  );
}
