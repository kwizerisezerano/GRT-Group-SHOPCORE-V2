import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  UserPlus,
  ShieldCheck,
  Settings,
  Trash2,
  Save,
  Mail,
  Crown,
  XCircle,
  Lock,
  KeyRound,
  Clock,
  Copy,
  ExternalLink,
  WifiOff,
  Database,
  RefreshCcw,
  Search,
  Activity,
  BarChart3,
  ShieldAlert,
  UserX,
  UploadCloud,
  Download,
  FileSpreadsheet,
  QrCode,
  MessageCircle,
  BriefcaseBusiness,
  MapPin,
  WalletCards,
  Eye,
  SlidersHorizontal,
  Layers3,
  Fingerprint,
  MonitorCog,
  CalendarClock,
  AlertTriangle,
  Phone,
} from "lucide-react";
import { decryptData, encryptData } from "@/lib/encryption";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { branchesApi, lastSuccessMessage, usersApi } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const USER_MGMT_AUDIT_KEY = "user_management_audit";

type Role =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "accountant"
  | "inventory_officer"
  | "sales_staff"
  | "staff"
  | "viewer";

type PermissionKey =
  | "can_view"
  | "can_create"
  | "can_edit"
  | "can_delete"
  | "can_approve";

type UserStatus = "active" | "invited" | "suspended" | "locked" | "removed" | "offline_cached";

interface Member {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  status?: UserStatus;
  department?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  last_activity_at?: string | null;
  last_login_at?: string | null;
  payroll_status?: string | null;
  salary_preview?: number | null;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  status: string;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

interface ActivityLog {
  id: string;
  user_id?: string | null;
  user?: string | null;
  action?: string | null;
  module?: string | null;
  description?: string | null;
  created_at?: string | null;
}

interface RolePermission {
  id?: string;
  tenant_id: string;
  role: Role;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

const ROLES: Role[] = [
  "owner",
  "admin",
  "manager",
  "cashier",
  "accountant",
  "inventory_officer",
  "sales_staff",
  "staff",
  "viewer",
];

const MODULES = [
  "dashboard",
  "pos",
  "sales",
  "products",
  "inventory",
  "purchases",
  "suppliers",
  "customers",
  "expenses",
  "reports",
  "branches",
  "warehouses",
  "staff",
  "loyalty",
  "settings",
  "activity_logs",
  "qa",
  "ebm_settings",
  "workspace_chat",
];

const DEPARTMENTS = [
  "Operations",
  "Sales",
  "Inventory",
  "Procurement",
  "Finance",
  "Management",
  "HR",
  "Support",
];

const PERMISSION_GROUPS = [
  { key: "core", label: "Core", modules: ["dashboard", "settings", "activity_logs", "qa"] },
  { key: "sales", label: "Sales", modules: ["pos", "sales", "customers", "loyalty"] },
  { key: "inventory", label: "Inventory", modules: ["products", "inventory", "suppliers", "warehouses"] },
  { key: "finance", label: "Finance", modules: ["purchases", "expenses", "reports"] },
  { key: "admin", label: "Enterprise", modules: ["branches", "staff", "ebm_settings", "workspace_chat"] },
];

const ROLE_TEMPLATES: Record<Role, string> = {
  owner: "Full workspace ownership with every permission enabled.",
  admin: "Full administrative control except ownership transfer governance.",
  manager: "Operational management with approvals and broad business access.",
  cashier: "POS selling, customers, sales visibility, and loyalty operations.",
  accountant: "Finance, reports, purchases, expenses, and approval workflows.",
  inventory_officer: "Products, inventory, suppliers, warehouses, and stock readiness.",
  sales_staff: "Sales workflows, customer service, loyalty, and POS support.",
  staff: "General staff access for POS, customers, and basic sales workflow.",
  viewer: "Read-only dashboard access with limited visibility.",
};

function roleLabel(role: Role) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function moduleLabel(module: string) {
  return module.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeRole(value: string | null | undefined): Role {
  if (ROLES.includes(value as Role)) return value as Role;
  return "viewer";
}

function roleBadgeClass(role: Role) {
  switch (role) {
    case "owner":
      return "bg-purple-500/10 text-purple-700 border-purple-500/30";
    case "admin":
      return "bg-[#0b3d5c]/10 text-[#0b3d5c] border-[#0b3d5c]/30";
    case "manager":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "cashier":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "accountant":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    case "inventory_officer":
      return "bg-teal-500/10 text-teal-600 border-teal-500/30";
    case "sales_staff":
      return "bg-rose-500/10 text-rose-600 border-rose-500/30";
    case "staff":
      return "bg-indigo-500/10 text-indigo-600 border-indigo-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getRoleBadge(role: Role) {
  return (
    <Badge variant="outline" className={`rounded-full capitalize ${roleBadgeClass(role)}`}>
      {roleLabel(role)}
    </Badge>
  );
}

function statusBadge(status?: UserStatus) {
  if (status === "suspended" || status === "locked" || status === "removed") {
    return <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-rose-600">{status}</Badge>;
  }
  if (status === "invited") {
    return <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">Invited</Badge>;
  }
  if (status === "offline_cached") {
    return <Badge variant="outline" className="rounded-full border-blue-500/30 bg-blue-500/10 text-blue-600">Cached</Badge>;
  }
  return <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600">Active</Badge>;
}

function initials(name: string | null, fallback: string) {
  const source = name?.trim() || fallback;
  return source.slice(0, 2).toUpperCase();
}

function buildInviteLink(inviteId: string) {
  return `${window.location.origin}/accept-invite?invite=${inviteId}`;
}

function makeCacheKey(name: string, tenantId?: string | null) {
  return tenantId ? `${name}_${tenantId}` : name;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function canWorkOnline(sessionToken?: string | null) {
  return isOnline() && !isOfflineMode() && !!sessionToken;
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

function timeAgo(value?: string | null) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function safeNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getRoleAccessModules(targetRole: Role) {
  if (targetRole === "owner" || targetRole === "admin") return MODULES;

  if (targetRole === "manager") {
    return [
      "dashboard",
      "pos",
      "sales",
      "products",
      "inventory",
      "purchases",
      "suppliers",
      "customers",
      "expenses",
      "reports",
      "branches",
      "warehouses",
      "staff",
      "loyalty",
      "workspace_chat",
    ];
  }

  if (targetRole === "cashier") return ["dashboard", "pos", "sales", "customers", "loyalty"];
  if (targetRole === "accountant") return ["dashboard", "sales", "purchases", "expenses", "reports"];
  if (targetRole === "inventory_officer") return ["dashboard", "products", "inventory", "suppliers", "warehouses"];
  if (targetRole === "sales_staff") return ["dashboard", "pos", "sales", "customers", "loyalty"];
  if (targetRole === "staff") return ["dashboard", "pos", "sales", "customers", "workspace_chat"];

  return ["dashboard"];
}


function parseBulkEmails(raw: string, fallbackRole: Role) {
  return raw
    .split(/\n|,|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\t,]/).map((part) => part.trim()).filter(Boolean);
      const email = parts[0] || line;
      const role = normalizeRole(parts[1] || fallbackRole);
      const department = parts[2] || "Operations";
      const branch = parts[3] || "";
      return { email, role, department, branch };
    })
    .filter((row) => isValidEmail(row.email));
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { user, tenantId, role, session } = useAuth();
  const qc = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("cashier");
  const [selectedRole, setSelectedRole] = useState<Role>("cashier");
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [profileUser, setProfileUser] = useState<Member | null>(null);
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("Operations");

  const currentRole = normalizeRole(String(role || "viewer"));
  const onlineReady = canWorkOnline(session?.access_token);
  const offlineModeActive = !onlineReady;
  const canManage = (currentRole === "owner" || currentRole === "admin") && onlineReady;

  const membersQ = useQuery({
    queryKey: ["admin-members", tenantId, onlineReady ? "online" : "offline"],
    enabled: !!tenantId,
    retry: onlineReady ? 1 : 0,
    queryFn: async (): Promise<Member[]> => {
      const cacheKey = makeCacheKey("admin_members", tenantId);

      if (!onlineReady) {
        const cached = ((await getCachedTable(cacheKey)) as Member[]) || [];
        return cached.map((member) => ({ ...member, status: member.status || "offline_cached" }));
      }

      /*
       * One call. This was five Supabase queries stitched together in the
       * browser — memberships, then profiles, then user_roles, then branches,
       * then payroll — which is also where the module's worst bug lived: the
       * role came from `user_roles` while the API read `tenant_members`, so
       * changing someone's role here changed nothing the server believed.
       *
       * The endpoint joins and decrypts server-side and returns the role the
       * API actually enforces, alongside the permissions that role resolves to.
       */
      try {
        const { data } = await usersApi.members();

        const members = (data as any[]).map((row) => ({
          user_id: row.user_id,
          email: row.email ?? "",
          full_name: row.display_name ?? row.email ?? "",
          display_name: row.display_name ?? null,
          phone: row.phone ?? null,
          avatar_url: row.avatar_url ?? null,
          role: (row.role ?? "staff") as Role,
          permissions: row.permissions ?? [],
          status: "active",
          created_at: row.joined_at ?? row.created_at ?? null,
        })) as unknown as Member[];

        await saveCachedTable(cacheKey, members as any[]);
        return members;
      } catch (error) {
        const cached = ((await getCachedTable(cacheKey)) as Member[]) || [];
        if (cached.length > 0 || isNetworkError(error)) {
          return cached.map((m) => ({ ...m, status: m.status || "offline_cached" }));
        }
        throw error;
      }
    },
  });

  const branchesQ = useQuery({
    queryKey: ["iam-branches", tenantId, onlineReady ? "online" : "offline"],
    enabled: !!tenantId,
    queryFn: async (): Promise<Branch[]> => {
      const cacheKey = makeCacheKey("iam_branches", tenantId);
      if (!onlineReady) return ((await getCachedTable(cacheKey)) as Branch[]) || [];

      try {
        const { data } = await branchesApi.list();
        const branches = (data ?? []) as unknown as Branch[];
        await saveCachedTable(cacheKey, branches);
        return branches;
      } catch (error: any) {
        if (isNetworkError(error)) return ((await getCachedTable(cacheKey)) as Branch[]) || [];
        throw error;
      }
    },
  });

  const invitesQ = useQuery({
    queryKey: ["admin-invites", tenantId, onlineReady ? "online" : "offline"],
    enabled: !!tenantId,
    retry: onlineReady ? 1 : 0,
    queryFn: async (): Promise<Invite[]> => {
      const cacheKey = makeCacheKey("admin_invites", tenantId);

      if (!onlineReady) return ((await getCachedTable(cacheKey)) as Invite[]) || [];

      try {
        const { data } = await usersApi.invites();
        // The token is never in this payload — only its hash is stored, and
        // the plaintext is handed back exactly once at creation.
        await saveCachedTable(cacheKey, data as any[]);
        return data as unknown as Invite[];
      } catch (error) {
        const cached = ((await getCachedTable(cacheKey)) as Invite[]) || [];
        if (cached.length > 0 || isNetworkError(error)) return cached;
        throw error;
      }
    },
  });

  const activityQ = useQuery({
    queryKey: ["iam-user-activity", tenantId, profileUser?.user_id, onlineReady ? "online" : "offline"],
    enabled: !!tenantId && !!profileUser,
    retry: onlineReady ? 1 : 0,
    queryFn: async (): Promise<ActivityLog[]> => {
      if (!profileUser) return [];
      const cacheKey = makeCacheKey(`iam_activity_${profileUser.user_id}`, tenantId);

      if (!onlineReady) return ((await getCachedTable(cacheKey)) as ActivityLog[]) || [];

      try {
        // Written by the server on every authority change, so the trail cannot
        // be forgotten by a client that failed to log its own action.
        const { data } = await usersApi.activity(500);
        const mine = (data as any[]).filter((row) => row.user_id === profileUser.user_id
          || row.target_id === profileUser.user_id);

        await saveCachedTable(cacheKey, mine);
        return mine as unknown as ActivityLog[];
      } catch (error) {
        const cached = ((await getCachedTable(cacheKey)) as ActivityLog[]) || [];
        if (cached.length > 0 || isNetworkError(error)) return cached;
        throw error;
      }
    },
  });

  const permissionsQ = useQuery({
    queryKey: ["admin-role-permissions", tenantId, selectedRole, onlineReady ? "online" : "offline"],
    enabled: !!tenantId,
    retry: onlineReady ? 1 : 0,
    queryFn: async (): Promise<RolePermission[]> => {
      const cacheKey = makeCacheKey(`admin_role_permissions_${selectedRole}`, tenantId);

      if (!onlineReady) return ((await getCachedTable(cacheKey)) as RolePermission[]) || [];

      try {
        /*
         * The server answers with the whole resolved matrix — defaults merged
         * with this workspace's overrides — rather than just the differences.
         *
         * That is deliberate: a screen that merges those itself drifts from
         * what the API enforces the first time either side changes, and then
         * shows a checkbox that does not match reality. Here the checkboxes
         * are simply what the server said it will do.
         */
        const matrix = await usersApi.permissionMatrix();
        const effective = new Set(
          matrix.roles.find((r) => r.role === selectedRole)?.effective ?? []
        );

        const rows: RolePermission[] = MODULES.map((module) => ({
          tenant_id: tenantId!,
          role: selectedRole,
          module,
          can_view: effective.has(`${module}.view`),
          can_create: effective.has(`${module}.create`),
          can_edit: effective.has(`${module}.update`),
          can_delete: effective.has(`${module}.delete`),
          can_approve: false,
        })) as RolePermission[];

        await saveCachedTable(cacheKey, rows as any[]);
        return rows;
      } catch (error) {
        const cached = ((await getCachedTable(cacheKey)) as RolePermission[]) || [];
        if (cached.length > 0 || isNetworkError(error)) return cached;
        throw error;
      }
    },
  });

  function normalizeStatus(value: any): UserStatus {
    if (["active", "invited", "suspended", "locked", "removed", "offline_cached"].includes(String(value))) return value as UserStatus;
    return "active";
  }

  const stats = useMemo(() => {
    const members = membersQ.data ?? [];
    const invites = invitesQ.data ?? [];
    const activeToday = members.filter((m) => {
      if (!m.last_activity_at) return false;
      const d = new Date(m.last_activity_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;

    return {
      members: members.length,
      admins: members.filter((m) => m.role === "admin" || m.role === "owner").length,
      managers: members.filter((m) => m.role === "manager").length,
      cashiers: members.filter((m) => m.role === "cashier").length,
      inventory: members.filter((m) => m.role === "inventory_officer").length,
      accountants: members.filter((m) => m.role === "accountant").length,
      pending: invites.filter((i) => i.status === "pending").length,
      roles: new Set(members.map((m) => m.role)).size,
      activeToday,
      suspended: members.filter((m) => m.status === "suspended" || m.status === "locked").length,
      onlineNow: members.filter((m) => m.last_activity_at && Date.now() - new Date(m.last_activity_at).getTime() < 10 * 60 * 1000).length,
    };
  }, [membersQ.data, invitesQ.data]);

  const selectedPermissions = permissionsQ.data ?? [];
  const enabledPermissions = selectedPermissions.reduce((sum, p) => {
    return sum + Number(p.can_view) + Number(p.can_create) + Number(p.can_edit) + Number(p.can_delete) + Number(p.can_approve);
  }, 0);

  const securityScore = useMemo(() => {
    let score = 100;
    if (stats.admins > Math.max(2, Math.ceil(stats.members * 0.25))) score -= 12;
    if (stats.suspended > 0) score -= 8;
    if (stats.pending > 5) score -= 6;
    if (!onlineReady) score -= 5;
    return Math.max(0, score);
  }, [stats, onlineReady]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (membersQ.data ?? []).filter((member) => {
      const matchesSearch =
        !q ||
        String(member.display_name || "").toLowerCase().includes(q) ||
        String(member.phone || "").toLowerCase().includes(q) ||
        String(member.user_id || "").toLowerCase().includes(q) ||
        String(member.department || "").toLowerCase().includes(q) ||
        String(member.branch_name || "").toLowerCase().includes(q) ||
        roleLabel(member.role).toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesDept = departmentFilter === "all" || (member.department || "Operations") === departmentFilter;
      return matchesSearch && matchesRole && matchesDept;
    });
  }, [membersQ.data, search, roleFilter, departmentFilter]);

  const roleDistribution = useMemo(() => {
    const total = Math.max(1, stats.members);
    return ROLES.map((r) => {
      const count = (membersQ.data ?? []).filter((m) => m.role === r).length;
      return { role: r, count, percent: Math.round((count / total) * 100) };
    }).filter((item) => item.count > 0 || ["owner", "admin", "cashier", "staff"].includes(item.role));
  }, [membersQ.data, stats.members]);

  const departmentDistribution = useMemo(() => {
    const total = Math.max(1, stats.members);
    return DEPARTMENTS.map((department) => {
      const count = (membersQ.data ?? []).filter((m) => (m.department || "Operations") === department).length;
      return { department, count, percent: Math.round((count / total) * 100) };
    }).filter((item) => item.count > 0 || ["Operations", "Sales", "Inventory", "Finance"].includes(item.department));
  }, [membersQ.data, stats.members]);

  const copyInviteLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const createAudit = async (action: string, description: string, payload?: Record<string, any>) => {
    const row = {
      id: makeLocalId("iam-audit"),
      tenant_id: tenantId || null,
      user_id: user?.id || null,
      action,
      description,
      payload: payload || {},
      created_at: new Date().toISOString(),
      operation: "create",
      sync_status: onlineReady ? "synced" : "pending",
    };

    const cacheKey = makeCacheKey(USER_MGMT_AUDIT_KEY, tenantId);
    const cached = ((await getCachedTable(cacheKey)) as any[]) || [];
    await saveCachedTable(cacheKey, [row, ...cached].slice(0, 250));

    if (!onlineReady) {
      await savePending("activity_logs", {
        tenant_id: tenantId,
        user_id: user?.id,
        user: user?.email || "Admin",
        action,
        module: "User Management",
        description,
        operation: "create",
        sync_status: "pending",
        created_offline_at: new Date().toISOString(),
      } as any).catch(() => undefined);
    }
  };


  const inviteUser = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Role }) => {
      if (!onlineReady) throw new Error("Inviting people requires an internet connection.");
      if (!tenantId) throw new Error("No active workspace");

      /*
       * The server refuses to invite into a role at or above the inviter's,
       * or to invite someone who is already a member, and returns the invite
       * token exactly once — only its hash is stored, because an invite link
       * is a credential until it is used.
       */
      return usersApi.invite(email.trim(), role);
    },
    onSuccess: (invite) => {
      toast.success(lastSuccessMessage ?? "Invitation created");
      setLastInviteLink(`${window.location.origin}/accept-invite?token=${invite.token}`);
      qc.invalidateQueries({ queryKey: ["admin-invites", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkInvite = useMutation({
    mutationFn: async () => {
      if (!onlineReady) throw new Error("Inviting people requires an internet connection.");
      if (!tenantId) throw new Error("No active workspace");

      const rows = parseBulkEmails(bulkText, inviteRole);
      if (rows.length === 0) throw new Error("No valid email addresses found");

      /*
       * One at a time rather than one batch insert. Each invite is checked
       * individually — already a member, already invited, role above the
       * inviter's — and one bad address should not lose the rest, so failures
       * are collected and reported instead of aborting the run.
       */
      const failed: string[] = [];
      let created = 0;

      for (const row of rows) {
        try {
          await usersApi.invite(row.email, row.role);
          created += 1;
        } catch (error: any) {
          failed.push(`${row.email}: ${error?.message ?? "failed"}`);
        }
      }

      return { created, failed };
    },
    onSuccess: ({ created, failed }) => {
      if (created > 0) toast.success(`${created} invitation(s) created`);
      if (failed.length > 0) {
        toast.error(`${failed.length} could not be invited`, {
          description: failed.slice(0, 3).join("; "),
          duration: 10000,
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-invites", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: Role }) => {
      if (!onlineReady) throw new Error("Role changes require an internet connection.");
      if (!tenantId) throw new Error("No active workspace");

      /*
       * This wrote to `user_roles` while the API read `tenant_members`, so
       * changing someone's role here changed nothing the server believed: the
       * screen showed the new role and every request kept using the old one.
       *
       * One call to the endpoint that owns the decision. It enforces the rules
       * this screen cannot be trusted with — you may not change your own role,
       * assign one at or above your own, act on someone who outranks you, or
       * leave the workspace without an owner — and writes the change to the
       * audit log itself, so there is no separate bookkeeping to get wrong.
       */
      await usersApi.assignRole(userId, newRole);
      return { userId, newRole };
    },
    onSuccess: ({ userId, newRole }) => {
      toast.success(lastSuccessMessage ?? "Role updated");
      qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });
      qc.invalidateQueries({ queryKey: ["admin-role-permissions", tenantId] });
      qc.invalidateQueries({ queryKey: ["iam-user-activity", tenantId] });
      void userId;
      void newRole;
    },
    // The server's message names exactly which rule refused, so it is shown
    // rather than replaced with something vaguer.
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMemberProfile = useMutation({
    mutationFn: async ({ userId, branchId, department, status }: { userId: string; branchId?: string | null; department?: string; status?: UserStatus }) => {
      if (!onlineReady) throw new Error("Profile access changes require online login and internet.");
      if (!tenantId) throw new Error("No active workspace");

      const updatePayload: Record<string, any> = {};
      if (branchId !== undefined) updatePayload.branch_id = branchId === "all" ? null : branchId;
      if (department !== undefined) updatePayload.department = department;
      if (status !== undefined) updatePayload.status = status;

      /*
       * This used to write straight to Supabase, into `branch_id`, `department`
       * and `status` columns that `tenant_members` never had here. Every save
       * reported success and stored nothing. The server now owns the rules that
       * go with it — you cannot post someone senior to you, and you cannot
       * suspend yourself out of your own workspace.
       */
      await usersApi.updateMemberProfile(userId, updatePayload);
      return { userId, updatePayload };
    },
    onSuccess: async ({ userId, updatePayload }) => {
      await createAudit("member_profile_updated", "Member access profile updated", { userId, ...updatePayload });
      toast.success("Member access profile updated");
      setBranchDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!onlineReady) throw new Error("Removing members requires an internet connection.");
      if (!tenantId) throw new Error("No active workspace");

      // The server refuses to remove the last owner, to let anyone remove
      // themselves, or to let you act on someone senior to you.
      await usersApi.removeMember(userId);
      return userId;
    },
    onSuccess: () => {
      toast.success(lastSuccessMessage ?? "Member removed");
      qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });
      qc.invalidateQueries({ queryKey: ["iam-user-activity", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      if (!onlineReady) throw new Error("Cancelling invites requires an internet connection.");
      await usersApi.cancelInvite(id);
      return id;
    },
    onSuccess: () => {
      toast.success(lastSuccessMessage ?? "Invitation cancelled");
      qc.invalidateQueries({ queryKey: ["admin-invites", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * The page thinks in per-module checkboxes; the API thinks in
   * `module.action` permissions. They map one to one, so the translation is a
   * lookup rather than a reconciliation.
   *
   * `can_approve` has no general equivalent — approval means something
   * different in each module — so it maps only where the API has a specific
   * permission for it, and is otherwise not offered.
   */
  const PERMISSION_KEY_TO_ACTION: Record<PermissionKey, string | null> = {
    can_view: "view",
    can_create: "create",
    can_edit: "update",
    can_delete: "delete",
    can_approve: null,
  };

  const updatePermission = async (permission: RolePermission, key: PermissionKey, value: boolean) => {
    if (!canManage || !onlineReady) {
      toast.info("Permission changes require an internet connection.");
      return;
    }

    const action = PERMISSION_KEY_TO_ACTION[key];
    if (!action) {
      toast.info("That permission is not configurable for this module.");
      return;
    }

    try {
      /*
       * The server stores only the difference from the shipped default, and
       * deletes the row when a permission is set back to it — so a workspace
       * that customises one role still picks up sensible access to modules
       * released later. It also refuses edits to a role at or above the
       * caller's own, since "manage permissions" would otherwise be a way to
       * grant yourself anything.
       */
      await usersApi.setPermission(selectedRole, `${permission.module}.${action}`, value);
      toast.success(lastSuccessMessage ?? "Permissions updated");
      qc.invalidateQueries({ queryKey: ["admin-role-permissions", tenantId] });
      qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });
    } catch (error: any) {
      toast.error(error?.message ?? "Could not update permissions");
    }
  };

  /**
   * Puts the selected role back to the permissions it ships with.
   *
   * Implemented as "remove every customisation", which is what reset means
   * here: with the overrides gone the role resolves to the shipped defaults
   * again, and keeps up with whatever those defaults become in future
   * releases. Writing the defaults in as rows would freeze it instead.
   */
  const seedRoleDefaults = async () => {
    if (!canManage || !onlineReady) {
      toast.info("Permission changes require an internet connection.");
      return;
    }

    try {
      const matrix = await usersApi.permissionMatrix();
      const customised = matrix.roles.find((r) => r.role === selectedRole)?.customised ?? [];

      for (const override of customised) {
        // Setting a permission back to its default deletes the row.
        const isDefault = (matrix.roles.find((r) => r.role === selectedRole)?.defaults ?? [])
          .includes(override.permission);
        await usersApi.setPermission(selectedRole, override.permission, isDefault);
      }

      toast.success(
        customised.length > 0
          ? `${selectedRole} reset to its default permissions`
          : `${selectedRole} is already on its defaults`
      );
      qc.invalidateQueries({ queryKey: ["admin-role-permissions", tenantId] });
      qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });
    } catch (error: any) {
      toast.error(error?.message ?? "Could not reset permissions");
    }
  };

  const exportUsersCSV = () => {
    const header = ["name", "phone", "role", "status", "department", "branch", "last_activity", "payroll_status"].join(",");
    const rows = (membersQ.data ?? []).map((m) =>
      [
        m.display_name || "Unnamed User",
        m.phone || "",
        roleLabel(m.role),
        m.status || "active",
        m.department || "Operations",
        m.branch_name || "All Branches",
        m.last_activity_at || "",
        m.payroll_status || "",
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );
    downloadText(`shopcore-users-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join("\n"), "text/csv");
  };

  const openBranchEditor = (member: Member) => {
    setProfileUser(member);
    setSelectedBranchId(member.branch_id || "all");
    setSelectedDepartment(member.department || "Operations");
    setBranchDialogOpen(true);
  };

  const kpis = [
    {
      label: "Total Users",
      value: stats.members,
      helper: "workspace members",
      icon: Users,
      cardClass: "bg-blue-600 text-white border-blue-600",
      iconClass: "bg-white/20 text-white",
    },
    {
      label: "Online Now",
      value: stats.onlineNow,
      helper: "active terminals",
      icon: Activity,
      cardClass: "bg-emerald-600 text-white border-emerald-600",
      iconClass: "bg-white/20 text-white",
    },
    {
      label: "Admins",
      value: stats.admins,
      helper: "privileged access",
      icon: Crown,
      cardClass: "bg-orange-600 text-white border-orange-600",
      iconClass: "bg-white/20 text-white",
    },
    {
      label: "Pending Invites",
      value: stats.pending,
      helper: "awaiting acceptance",
      icon: Mail,
      cardClass: "bg-orange-600 text-white border-orange-600",
      iconClass: "bg-white/20 text-white",
    },
    {
      label: "Active Today",
      value: stats.activeToday,
      helper: "daily activity",
      icon: CalendarClock,
      cardClass: "bg-cyan-600 text-white border-cyan-600",
      iconClass: "bg-white/20 text-white",
    },
    {
      label: "Security Score",
      value: `${securityScore}%`,
      helper: "access governance",
      icon: ShieldCheck,
      cardClass: "bg-rose-600 text-white border-rose-600",
      iconClass: "bg-white/20 text-white",
    },
  ];

  return (
    <PageShell title="User Management" description="Manage users, roles, invitations, branch access, permissions, and security governance.">
      <PageBackground image={warehouseBg} opacity={0.04}>
        <div className="mx-auto max-w-[1480px] space-y-6 px-4 py-5 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/dashboard"))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>

            <span className="text-sm text-muted-foreground">Identity & Access Management</span>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl bg-cyan-600 text-white hover:bg-cyan-700"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });
                qc.invalidateQueries({ queryKey: ["admin-invites", tenantId] });
                qc.invalidateQueries({ queryKey: ["admin-role-permissions", tenantId] });
                qc.invalidateQueries({ queryKey: ["iam-branches", tenantId] });
                toast.info(onlineReady ? "Refreshing IAM data..." : "Showing cached offline data.");
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <Button variant="outline" size="sm" className="rounded-xl border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" onClick={exportUsersCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export Users
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-blue-200 bg-blue-50/90 p-5 shadow-sm xl:col-span-7">
              <div className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-blue-200/70" />
              <div className="pointer-events-none absolute -bottom-16 right-20 h-32 w-32 rounded-full bg-cyan-200/45" />

              <div className="relative flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                  <Fingerprint className="h-7 w-7" />
                  <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-blue-50 ${onlineReady ? "bg-emerald-500" : "bg-orange-500"}`} />
                </div>

                <div className="min-w-0">
                  <Badge className="mb-2 rounded-full bg-blue-600 px-4 py-1 text-white hover:bg-blue-600">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    Identity Operations Center
                  </Badge>

                  <h1 className="max-w-4xl text-2xl font-black leading-tight tracking-tight text-slate-950">
                    User Management Control Center
                  </h1>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Manage workforce identities, branch access, role permissions, invitations, security governance,
                    department scope, payroll context, and offline-safe administration from one workspace.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-300 p-3">
                      <p className="text-xs font-semibold text-emerald-700">Your Role</p>
                      <p className="mt-1 truncate text-sm font-black text-emerald-950">{roleLabel(currentRole)}</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-300 p-3">
                      <p className="text-xs font-semibold text-violet-700">Access Mode</p>
                      <p className="mt-1 truncate text-sm font-black text-violet-950">{canManage ? "Full Control" : "Read Only"}</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-300 p-3">
                      <p className="text-xs font-semibold text-orange-700">Enabled Permissions</p>
                      <p className="mt-1 text-sm font-black font-data text-orange-950">{enabledPermissions}</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-300 p-3">
                      <p className="text-xs font-semibold text-cyan-700">Mode</p>
                      <p className="mt-1 truncate text-sm font-black text-cyan-950">{onlineReady ? "Online Live" : "Offline Cache"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:col-span-5">
              {kpis.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`relative min-h-[106px] overflow-hidden rounded-[1.4rem] border p-4 shadow-sm ${item.cardClass}`}
                  >
                    <div className="pointer-events-none absolute -right-7 -top-10 h-24 w-24 rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute right-5 top-5 h-3 w-3 rounded-full bg-white/35" />

                    <div className={`relative mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${item.iconClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="relative">
                      <p className="text-sm font-bold text-white/90">{item.label}</p>
                      <p className="mt-1 text-2xl font-black font-data text-white">{item.value}</p>
                      <p className="mt-2 w-fit rounded-full border border-white/25 bg-white/15 px-3 py-0.5 text-xs font-semibold text-white">
                        {item.helper}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {offlineModeActive && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-800 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                    <WifiOff className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">User Management is in offline/read-only mode</p>
                    <p className="text-sm opacity-90">Members, invites, permissions, activity summaries, and branches are shown from cache. Online login is required for invites, role edits, removals, and permission changes.</p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/70 text-amber-900 hover:bg-white/70">
                  <Database className="mr-1 h-3 w-3" />
                  Cached Data
                </Badge>
              </div>
            </div>
          )}

          {!canManage && (
            <div className="flex items-center gap-3 rounded-3xl border bg-amber-500/10 p-4 text-amber-700">
              <Lock className="h-5 w-5" />
              {offlineModeActive ? "Online login is required before managing users and permissions." : "Only owners and admins can manage users and permissions."}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-12">
            <div className="space-y-5 xl:col-span-8">
              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-5 w-5 text-[#0b3d5c]" />
                        Workforce Directory
                      </CardTitle>
                      <CardDescription>Search users, review branch/department access, open profile drawers, and manage roles.</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" className="rounded-2xl" onClick={() => setBulkDialogOpen(true)} disabled={!canManage}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Bulk Invite
                      </Button>
                      <Button variant="outline" className="rounded-2xl" onClick={() => setSecurityDialogOpen(true)}>
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Security Center
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 xl:grid-cols-[1fr_170px_190px]">
                    <div className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4">
                      <Search className="h-5 w-5 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, phone, role, department, branch, or user ID..."
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </div>

                    <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "all")}>
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {DEPARTMENTS.map((department) => (
                          <SelectItem key={department} value={department}>{department}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {membersQ.isLoading ? (
                    <div className="py-12 text-center text-muted-foreground">Loading members...</div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="rounded-3xl border border-blue-200 bg-blue-50 py-12 text-center text-muted-foreground">
                      <Users className="mx-auto mb-2 h-10 w-10 opacity-30" />
                      No members found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {filteredMembers.map((member) => (
                        <div key={member.user_id} className="rounded-3xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative shrink-0">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b3d5c] font-semibold text-white">
                                  {initials(member.display_name, member.user_id)}
                                </div>
                                <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card ${member.last_activity_at && Date.now() - new Date(member.last_activity_at).getTime() < 10 * 60 * 1000 ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold">{member.display_name ?? "Unnamed User"}</p>
                                <p className="truncate text-xs text-muted-foreground">{member.phone || "No phone number"}</p>
                                <p className="truncate text-xs text-muted-foreground font-data">{member.user_id}</p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              {getRoleBadge(member.role)}
                              {statusBadge(member.status)}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                              <p className="text-xs text-muted-foreground">Department</p>
                              <p className="truncate text-sm font-medium">{member.department || "Operations"}</p>
                            </div>
                            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                              <p className="text-xs text-muted-foreground">Branch</p>
                              <p className="truncate text-sm font-medium">{member.branch_name || "All Branches"}</p>
                            </div>
                            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                              <p className="text-xs text-muted-foreground">Last Activity</p>
                              <p className="truncate text-sm font-medium">{timeAgo(member.last_activity_at)}</p>
                            </div>
                            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                              <p className="text-xs text-muted-foreground">Payroll</p>
                              <p className="truncate text-sm font-medium">{member.payroll_status || "Not linked"}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <Select
                              value={member.role}
                              disabled={!canManage || member.role === "owner"}
                              onValueChange={(value) => updateMemberRole.mutate({ userId: member.user_id, newRole: value as Role })}
                            >
                              <SelectTrigger className="flex-1 rounded-2xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Button variant="outline" className="rounded-2xl" onClick={() => setProfileUser(member)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Profile
                            </Button>

                            <Button variant="outline" className="rounded-2xl" disabled={!canManage} onClick={() => openBranchEditor(member)}>
                              <MapPin className="mr-2 h-4 w-4" />
                              Access
                            </Button>

                            <Button
                              variant="outline"
                              className="rounded-2xl text-destructive hover:text-destructive"
                              disabled={!canManage || member.role === "owner" || removeMember.isPending}
                              onClick={() => removeMember.mutate(member.user_id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Settings className="h-5 w-5 text-[#0b3d5c]" />
                        Role Permission Command Center
                      </CardTitle>
                      <CardDescription>Manage role templates by module group or use the compact enterprise matrix.</CardDescription>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as Role)}>
                        <SelectTrigger className="rounded-2xl sm:w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button variant="outline" className="rounded-2xl" disabled={!canManage} onClick={seedRoleDefaults}>
                        <Save className="mr-2 h-4 w-4" />
                        Defaults
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="mb-5 rounded-3xl border bg-gradient-to-br from-slate-50 to-white p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {getRoleBadge(selectedRole)}
                          <Badge variant="outline" className="rounded-full">{enabledPermissions} enabled permissions</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{ROLE_TEMPLATES[selectedRole]}</p>
                      </div>
                      <div className="grid grid-cols-5 gap-2 text-center text-xs">
                        {(["can_view", "can_create", "can_edit", "can_delete", "can_approve"] as PermissionKey[]).map((key) => (
                          <div key={key} className="rounded-2xl border bg-white p-2">
                            <p className="font-bold font-data">{selectedPermissions.filter((p) => p[key]).length}</p>
                            <p className="text-muted-foreground">{key.replace("can_", "")}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Tabs defaultValue="groups" className="w-full">
                    <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl bg-blue-50 p-1">
                      <TabsTrigger value="groups" className="rounded-xl px-4 py-2">Grouped Cards</TabsTrigger>
                      <TabsTrigger value="matrix" className="rounded-xl px-4 py-2">Matrix View</TabsTrigger>
                    </TabsList>

                    <TabsContent value="groups" className="mt-5">
                      <Tabs defaultValue="core" className="w-full">
                        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl bg-blue-50 p-1">
                          {PERMISSION_GROUPS.map((group) => (
                            <TabsTrigger key={group.key} value={group.key} className="rounded-xl px-4 py-2">{group.label}</TabsTrigger>
                          ))}
                        </TabsList>

                        {PERMISSION_GROUPS.map((group) => {
                          const groupPermissions = selectedPermissions.filter((permission) => group.modules.includes(permission.module));
                          return (
                            <TabsContent key={group.key} value={group.key} className="mt-5">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {groupPermissions.map((permission) => (
                                  <div key={permission.module} className="rounded-3xl border bg-card p-4">
                                    <div className="mb-4 flex items-center gap-3">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <div>
                                        <p className="font-semibold">{moduleLabel(permission.module)}</p>
                                        <p className="text-xs text-muted-foreground">{roleLabel(selectedRole)} access</p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                      {([
                                        ["can_view", "View"],
                                        ["can_create", "Create"],
                                        ["can_edit", "Edit"],
                                        ["can_delete", "Delete"],
                                        ["can_approve", "Approve"],
                                      ] as [PermissionKey, string][]).map(([key, label]) => (
                                        <div key={key} className="flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                                          <span className="text-sm">{label}</span>
                                          <Switch
                                            checked={!!permission[key]}
                                            disabled={!canManage || selectedRole === "owner"}
                                            onCheckedChange={(checked) => updatePermission(permission, key, checked)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </TabsContent>

                    <TabsContent value="matrix" className="mt-5">
                      <div className="overflow-x-auto rounded-3xl border">
                        <div className="min-w-[900px]">
                          <div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                            <div className="col-span-4">Module</div>
                            <div className="col-span-1 text-center">View</div>
                            <div className="col-span-1 text-center">Create</div>
                            <div className="col-span-1 text-center">Edit</div>
                            <div className="col-span-1 text-center">Delete</div>
                            <div className="col-span-1 text-center">Approve</div>
                            <div className="col-span-3 text-right">Template</div>
                          </div>
                          {selectedPermissions.map((permission) => (
                            <div key={`matrix-${permission.module}`} className="grid grid-cols-12 items-center gap-4 border-b px-5 py-3 last:border-b-0">
                              <div className="col-span-4 font-medium">{moduleLabel(permission.module)}</div>
                              {(["can_view", "can_create", "can_edit", "can_delete", "can_approve"] as PermissionKey[]).map((key) => (
                                <div key={key} className="col-span-1 flex justify-center">
                                  <Switch checked={!!permission[key]} disabled={!canManage || selectedRole === "owner"} onCheckedChange={(checked) => updatePermission(permission, key, checked)} />
                                </div>
                              ))}
                              <div className="col-span-3 text-right text-xs text-muted-foreground">{getRoleAccessModules(selectedRole).includes(permission.module) ? "Allowed" : "Restricted"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5 xl:col-span-4">
              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlus className="h-5 w-5 text-emerald-600" />
                    Invite User
                  </CardTitle>
                  <CardDescription>Create a pending invitation and share the invite link manually.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <Input className="rounded-2xl" placeholder="user@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />

                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => r !== "owner").map((r) => (
                        <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button className="w-full rounded-2xl bg-blue-600 text-white hover:bg-blue-700" disabled={!canManage || inviteUser.isPending} onClick={() => inviteUser.mutate({ email: inviteEmail, role: inviteRole })}>
                    <Mail className="mr-2 h-4 w-4" />
                    {inviteUser.isPending ? "Creating..." : "Create Invite Link"}
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="rounded-2xl" disabled={!canManage} onClick={() => setBulkDialogOpen(true)}>
                      <UploadCloud className="mr-2 h-4 w-4" />
                      Bulk
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => downloadText("shopcore-bulk-invite-template.csv", "email,role,department,branch\nsarah@example.com,cashier,Sales,Main Branch", "text/csv")}
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Template
                    </Button>
                  </div>

                  {lastInviteLink && (
                    <div className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Latest invite link</p>
                      <div className="break-all rounded-xl border bg-background p-2 text-xs font-data">{lastInviteLink}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => copyInviteLink(lastInviteLink)}><Copy className="mr-2 h-4 w-4" />Copy</Button>
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(lastInviteLink, "_blank")}><ExternalLink className="mr-2 h-4 w-4" />Open</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-5 w-5 text-[#0b3d5c]" />
                    IAM Analytics
                  </CardTitle>
                  <CardDescription>Role and department distribution.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Role Distribution</h4>
                      <Badge variant="outline" className="rounded-full">{stats.roles} roles</Badge>
                    </div>
                    <div className="space-y-3">
                      {roleDistribution.map((item) => (
                        <div key={item.role}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span>{roleLabel(item.role)}</span>
                            <span className="font-data text-muted-foreground">{item.count} · {item.percent}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-[#0b3d5c]" style={{ width: `${item.percent}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Department Mix</h4>
                      <Badge variant="outline" className="rounded-full">{DEPARTMENTS.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {departmentDistribution.map((item) => (
                        <div key={item.department}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span>{item.department}</span>
                            <span className="font-data text-muted-foreground">{item.count} · {item.percent}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.percent}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-5 w-5 text-amber-600" />Pending Invites</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(invitesQ.data ?? []).length === 0 && !invitesQ.isLoading ? (
                    <div className="rounded-3xl border bg-muted/30 py-10 text-center text-muted-foreground">
                      <Mail className="mx-auto mb-2 h-9 w-9 opacity-30" />No pending invites.
                    </div>
                  ) : (
                    (invitesQ.data ?? []).map((invite) => {
                      const link = buildInviteLink(invite.id);
                      return (
                        <div key={invite.id} className="rounded-3xl border bg-card p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{invite.email}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(invite.created_at)}</p>
                            </div>
                            <Badge variant="outline" className={invite.status === "pending" ? "rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600" : "rounded-full"}>{invite.status}</Badge>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {getRoleBadge(invite.role)}
                            <Badge variant="outline" className="rounded-full"><QrCode className="mr-1 h-3 w-3" />QR Ready</Badge>
                          </div>

                          <div className="mt-3 rounded-2xl border bg-muted/40 p-2">
                            <p className="mb-1 text-[10px] text-muted-foreground">Invite link</p>
                            <p className="break-all text-xs font-data">{link}</p>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <Button variant="outline" size="sm" className="rounded-2xl" disabled={!canManage} onClick={() => copyInviteLink(link)}><Copy className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" className="rounded-2xl" disabled={!canManage} onClick={() => window.open(`mailto:${invite.email}?subject=ShopCore Workspace Invite&body=${encodeURIComponent(link)}`)}><Mail className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" className="rounded-2xl" disabled={!canManage} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join ShopCore workspace: ${link}`)}`, "_blank")}><MessageCircle className="h-4 w-4" /></Button>
                          </div>

                          <Button variant="outline" size="sm" className="mt-3 w-full rounded-2xl text-destructive hover:text-destructive" disabled={!canManage || cancelInvite.isPending} onClick={() => cancelInvite.mutate(invite.id)}>
                            <XCircle className="mr-2 h-4 w-4" />Cancel Invite
                          </Button>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogContent className="max-w-3xl rounded-3xl">
              <DialogHeader>
                <DialogTitle>Bulk Invite Users</DialogTitle>
                <DialogDescription>Paste emails one per line, or CSV rows: email, role, department, branch.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  value={bulkText}
                  onChange={(event) => setBulkText(event.target.value)}
                  className="min-h-[240px] rounded-2xl font-data text-sm"
                  placeholder={"sarah@example.com,cashier,Sales,Main Branch\npaul@example.com,inventory_officer,Inventory,Warehouse"}
                />
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-muted-foreground">
                  Valid rows detected: <span className="font-bold text-foreground">{parseBulkEmails(bulkText, inviteRole).length}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-2xl" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
                <Button className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700" disabled={!canManage || bulkInvite.isPending} onClick={() => bulkInvite.mutate()}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {bulkInvite.isPending ? "Creating..." : "Create Bulk Invites"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!profileUser && !branchDialogOpen} onOpenChange={(open) => !open && setProfileUser(null)}>
            <DialogContent className="max-w-5xl rounded-3xl">
              <DialogHeader>
                <DialogTitle>Staff Identity Profile</DialogTitle>
                <DialogDescription>Profile, permissions, branch access, payroll context, and activity timeline.</DialogDescription>
              </DialogHeader>

              {profileUser && (
                <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="space-y-4">
                    <div className="rounded-3xl border bg-muted/30 p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b3d5c] text-lg font-black text-white">
                          {initials(profileUser.display_name, profileUser.user_id)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black">{profileUser.display_name || "Unnamed User"}</p>
                          <p className="truncate text-xs text-muted-foreground font-data">{profileUser.user_id}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getRoleBadge(profileUser.role)}
                        {statusBadge(profileUser.status)}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-2xl border p-3"><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{profileUser.phone || "—"}</p></div>
                      <div className="rounded-2xl border p-3"><p className="text-xs text-muted-foreground">Department</p><p className="font-medium">{profileUser.department || "Operations"}</p></div>
                      <div className="rounded-2xl border p-3"><p className="text-xs text-muted-foreground">Branch</p><p className="font-medium">{profileUser.branch_name || "All Branches"}</p></div>
                      <div className="rounded-2xl border p-3"><p className="text-xs text-muted-foreground">Last Activity</p><p className="font-medium">{formatDateTime(profileUser.last_activity_at)}</p></div>
                      <div className="rounded-2xl border p-3"><p className="text-xs text-muted-foreground">Payroll Status</p><p className="font-medium">{profileUser.payroll_status || "Not linked"}</p></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-3xl border bg-blue-500/10 p-4 text-blue-700"><BriefcaseBusiness className="mb-3 h-5 w-5" /><p className="text-xs">Department</p><p className="font-bold">{profileUser.department || "Operations"}</p></div>
                      <div className="rounded-3xl border bg-emerald-500/10 p-4 text-emerald-700"><MapPin className="mb-3 h-5 w-5" /><p className="text-xs">Branch</p><p className="font-bold">{profileUser.branch_name || "All"}</p></div>
                      <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-700"><WalletCards className="mb-3 h-5 w-5" /><p className="text-xs">Salary Preview</p><p className="font-bold font-data">{profileUser.salary_preview ? `RF ${profileUser.salary_preview.toLocaleString()}` : "—"}</p></div>
                    </div>

                    <div className="rounded-3xl border p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#0b3d5c]" />
                        <h3 className="font-black">Recent Activity</h3>
                      </div>
                      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                        {(activityQ.data ?? []).length === 0 ? (
                          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-muted-foreground">No activity found for this user yet.</div>
                        ) : (
                          (activityQ.data ?? []).map((log) => (
                            <div key={log.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">{log.action || "activity"} · {log.module || "System"}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{log.description || "Activity recorded"}</p>
                                </div>
                                <p className="shrink-0 text-xs text-muted-foreground">{timeAgo(log.created_at)}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" className="rounded-2xl" onClick={() => setProfileUser(null)}>Close</Button>
                {profileUser && (
                  <Button className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700" disabled={!canManage} onClick={() => openBranchEditor(profileUser)}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" />Edit Access
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
            <DialogContent className="max-w-2xl rounded-3xl">
              <DialogHeader>
                <DialogTitle>Edit Branch & Department Access</DialogTitle>
                <DialogDescription>Assign department and branch scope for this workspace member.</DialogDescription>
              </DialogHeader>
              {profileUser && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                    <p className="font-semibold">{profileUser.display_name || "Unnamed User"}</p>
                    <p className="text-xs text-muted-foreground font-data">{profileUser.user_id}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Department</label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Branch Scope</label>
                    <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                      <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {(branchesQ.data ?? []).map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" className="rounded-2xl" onClick={() => setBranchDialogOpen(false)}>Cancel</Button>
                <Button
                  className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
                  disabled={!canManage || !profileUser || updateMemberProfile.isPending}
                  onClick={() => profileUser && updateMemberProfile.mutate({ userId: profileUser.user_id, branchId: selectedBranchId, department: selectedDepartment })}
                >
                  <Save className="mr-2 h-4 w-4" />Save Access
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={securityDialogOpen} onOpenChange={setSecurityDialogOpen}>
            <DialogContent className="max-w-4xl rounded-3xl">
              <DialogHeader>
                <DialogTitle>Security Center</DialogTitle>
                <DialogDescription>Review privileged access, invite risk, online status, and recommended actions.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border bg-emerald-500/10 p-5 text-emerald-700">
                  <ShieldCheck className="mb-4 h-7 w-7" />
                  <p className="text-sm">Security Score</p>
                  <p className="text-4xl font-black font-data">{securityScore}%</p>
                  <p className="mt-2 text-sm opacity-80">Based on admin ratio, invite count, suspended users, and current access mode.</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-purple-500/10 p-3"><span>Admins / Owners</span><b>{stats.admins}</b></div>
                  <div className="flex items-center justify-between rounded-2xl bg-amber-500/10 p-3"><span>Pending Invites</span><b>{stats.pending}</b></div>
                  <div className="flex items-center justify-between rounded-2xl bg-rose-500/10 p-3"><span>Suspended / Locked</span><b>{stats.suspended}</b></div>
                  <div className="flex items-center justify-between rounded-2xl bg-blue-500/10 p-3"><span>Online Mode</span><b>{onlineReady ? "Yes" : "No"}</b></div>
                </div>
              </div>
              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 font-black">Recommended Governance Actions</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-background p-3 text-sm"><AlertTriangle className="mb-2 h-4 w-4 text-amber-600" />Keep admin/owner access limited to trusted leadership.</div>
                  <div className="rounded-2xl bg-background p-3 text-sm"><UserX className="mb-2 h-4 w-4 text-rose-600" />Remove unused invites and suspended users after review.</div>
                  <div className="rounded-2xl bg-background p-3 text-sm"><MonitorCog className="mb-2 h-4 w-4 text-blue-600" />Review activity logs for role changes and permission edits.</div>
                  <div className="rounded-2xl bg-background p-3 text-sm"><Layers3 className="mb-2 h-4 w-4 text-emerald-600" />Use role templates instead of giving everyone admin access.</div>
                </div>
              </div>
              <DialogFooter><Button variant="outline" className="rounded-2xl" onClick={() => setSecurityDialogOpen(false)}>Close</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageBackground>
    </PageShell>
  );
}
