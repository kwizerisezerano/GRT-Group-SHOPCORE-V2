import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  ShieldCheck,
  Settings,
  Save,
  Mail,
  Crown,
  Lock,
  KeyRound,
  WifiOff,
  Database,
  RefreshCcw,
  Activity,
  ShieldAlert,
  UserX,
  UploadCloud,
  Download,
  BriefcaseBusiness,
  MapPin,
  WalletCards,
  SlidersHorizontal,
  Layers3,
  MonitorCog,
  AlertTriangle,
  ShieldOff,
  CheckCheck,
  RotateCcw,
  Loader2,
  UserPlus2,
} from "lucide-react";
import { decryptData, encryptData } from "@/lib/encryption";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import { PageContainer } from "@/components/patterns";
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
import {
  buildCatalogue,
  groupCatalogue,
  type CatalogueModule,
} from "@/lib/permissionCatalogue";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type UserStatus = "active" | "invited" | "suspended" | "locked" | "removed" | "offline_cached";

interface Member {
  user_id: string;
  tenant_id?: string | null;
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

/**
 * What the editor needs about one role: every permission that exists, and the
 * subset this role currently holds. Both come straight from the server, so a
 * switch can only ever represent a permission the API will accept.
 */
interface RolePermissionState {
  catalogue: string[];
  effective: string[];
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
  "categories",
  "brands",
  "units",
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

const ROLE_TEMPLATES: Record<Role, string> = {
  owner: "Full workspace ownership with every permission enabled.",
  admin: "Full administrative control except ownership transfer governance.",
  manager: "Operational management with approvals and broad business access.",
  cashier: "POS selling, product setup, stock additions/adjustments, customers, and sales visibility.",
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
      return "bg-primary/10 text-foreground border-primary/30";
    case "admin":
      return "bg-primary/10 text-primary border-primary/30";
    case "manager":
      return "bg-primary/10 text-muted-foreground border-primary/30";
    case "cashier":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "accountant":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    case "inventory_officer":
      return "bg-teal-500/10 text-teal-600 border-teal-500/30";
    case "sales_staff":
      return "bg-rose-500/10 text-rose-600 border-rose-500/30";
    case "staff":
      return "bg-primary/10 text-muted-foreground border-primary/30";
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
    return <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-muted-foreground">Cached</Badge>;
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

  if (targetRole === "cashier") return ["dashboard", "pos", "sales", "products", "inventory", "customers", "loyalty"];
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

export default function UserManagementAccess() {
  const navigate = useNavigate();
  const { user, tenantId, role, session } = useAuth();
  const qc = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("cashier");
  const [selectedRole, setSelectedRole] = useState<Role>("cashier");
  const [permissionTarget, setPermissionTarget] = useState<"role" | "user">("role");
  const [selectedPermissionUser, setSelectedPermissionUser] = useState<string>("");
  const [lastInviteLink, setLastInviteLink] = useState("");


  // "Add User" — creates the account outright with a generated password,
  // instead of a link the recipient has to open first. See createUser below.
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addUserName, setAddUserName] = useState("");
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserRole, setAddUserRole] = useState<Role>("cashier");
  const [addUserDepartment, setAddUserDepartment] = useState("Operations");
  const [addUserBranchId, setAddUserBranchId] = useState("all");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [profileUser, setProfileUser] = useState<Member | null>(null);
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("Operations");
  /*
   * Which role-wide write is in flight, so the buttons can say so and cannot
   * be pressed twice. A second "revoke all" landing on top of the first is
   * harmless here — the endpoint is a replace, not a delta — but a button that
   * looks inert while a hundred permissions are being written is how somebody
   * concludes the screen is broken and starts clicking.
   */
  const [bulkPending, setBulkPending] = useState<string | null>(null);
  /*
   * "Grant all" and "Revoke all" are confirmed; "Defaults" is not. The first
   * two are the ones that cannot be undone by memory — nobody can reconstruct
   * which of a hundred switches were on before — while resetting to defaults
   * lands somewhere knowable and documented on the screen itself.
   */
  const [confirmBulk, setConfirmBulk] = useState<"grant_all" | "revoke_all" | null>(null);

  /*
   * The signed-in user's own effective permissions, from the same store the
   * sidebar and route guard read. Refreshed after a bulk write so an owner who
   * has just reshaped a role does not keep navigating by a stale menu.
   */
  const { refresh: refreshPermissions } = usePermissions();

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
          tenant_id: row.tenant_id ?? null,
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

  useEffect(() => {
    if (permissionTarget === "user" && !selectedPermissionUser && membersQ.data?.length) {
      setSelectedPermissionUser(membersQ.data[0].user_id);
    }
  }, [permissionTarget, selectedPermissionUser, membersQ.data]);

  const [selectedAccessUserId, setSelectedAccessUserId] = useState<string>("none");
  const accessUser = useMemo(() => (membersQ.data ?? []).find(m => m.user_id === selectedAccessUserId), [membersQ.data, selectedAccessUserId]);

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
    queryKey: ["admin-permissions", tenantId, permissionTarget, permissionTarget === "role" ? selectedRole : selectedPermissionUser, onlineReady ? "online" : "offline"],
    enabled: !!tenantId && (permissionTarget === "role" || !!selectedPermissionUser),
    retry: onlineReady ? 1 : 0,
    queryFn: async (): Promise<RolePermissionState> => {
      const targetId = permissionTarget === "role" ? selectedRole : selectedPermissionUser;
      const cacheKey = makeCacheKey(`admin_permissions_${permissionTarget}_${targetId}`, tenantId);

      const readCache = async (): Promise<RolePermissionState> => {
        const rows = ((await getCachedTable(cacheKey)) as { permission: string; granted: boolean }[]) || [];
        return {
          catalogue: rows.map((row) => row.permission),
          effective: rows.filter((row) => row.granted).map((row) => row.permission),
        };
      };

      if (!onlineReady) return readCache();

      try {
        let catalogue: string[] = [];
        let effective: string[] = [];
        
        if (permissionTarget === "role") {
          const matrix = await usersApi.permissionMatrix();
          catalogue = matrix.catalogue;
          const role = matrix.roles.find((r) => r.role === selectedRole);
          effective = role?.effective ?? [];
        } else {
          // fetch catalogue from matrix, effective from user
          const matrix = await usersApi.permissionMatrix();
          catalogue = matrix.catalogue;
          const userPerms = await usersApi.memberPermissions(selectedPermissionUser);
          effective = userPerms.effective ?? [];
        }

        const state: RolePermissionState = { catalogue, effective };

        const effectiveSet = new Set(effective);
        await saveCachedTable(
          cacheKey,
          catalogue.map((permission) => ({
            permission,
            granted: effectiveSet.has(permission),
          })) as any[]
        );

        return state;
      } catch (error) {
        const cached = await readCache();
        if (cached.catalogue.length > 0 || isNetworkError(error)) return cached;
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

  /*
   * Everything the editor draws comes from these three, and all three come
   * from one server response: what permissions exist, which of them this role
   * holds, and how to lay them out. Nothing is inferred from a module name.
   */
  const permissionState = permissionsQ.data;
  const grantedPermissions = useMemo(
    () => new Set(permissionState?.effective ?? []),
    [permissionState]
  );
  const catalogueModules = useMemo(
    () => buildCatalogue(permissionState?.catalogue ?? []),
    [permissionState]
  );
  const catalogueGroups = useMemo(
    () => groupCatalogue(catalogueModules),
    [catalogueModules]
  );

  const enabledPermissions = grantedPermissions.size;
  const totalPermissions = permissionState?.catalogue.length ?? 0;

  /*
   * The owner role is excluded from every bulk control rather than merely
   * refused by the server. Owner is defined as "every permission" and the API
   * will not let anyone edit it — including another owner — so offering the
   * buttons would be offering a guaranteed 403.
   */
  const bulkEnabled =
    canManage && selectedRole !== "owner" && bulkPending === null && !permissionsQ.isLoading;

  const grantedShare = totalPermissions > 0 ? enabledPermissions / totalPermissions : 0;

  /*
   * How many people this change actually lands on. A role-wide write reads
   * very differently depending on whether it touches nobody or eleven
   * cashiers mid-shift, and the confirmation is the only place to say so.
   */
  const roleMemberCount = useMemo(
    () => (membersQ.data ?? []).filter((member) => member.role === selectedRole).length,
    [membersQ.data, selectedRole]
  );

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

  // Reset back to page 1 whenever the visible set changes shape, so a filter
  // typed while on page 4 doesn't land on an empty page.
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, departmentFilter, perPage]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedMembers = useMemo(
    () => filteredMembers.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filteredMembers, currentPage, perPage]
  );

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

  /**
   * Creates the account outright: a generated password is emailed to the new
   * member instead of an invite link, and they are required to change it on
   * first sign-in. The password itself never reaches this client — the
   * response is the same member shape GET /members returns, with no
   * credential in it.
   */
  const createUser = useMutation({
    mutationFn: async (input: { name: string; email: string; role: Role; department: string; branchId: string }) => {
      if (!onlineReady) throw new Error("Creating a user requires an internet connection.");
      if (!tenantId) throw new Error("No active workspace");

      return usersApi.createUser({
        email: input.email.trim(),
        display_name: input.name.trim(),
        role: input.role,
        department: input.department,
        branch_id: input.branchId === "all" ? null : input.branchId,
      });
    },
    onSuccess: (_data, variables) => {
      toast.success(lastSuccessMessage ?? `User created — login credentials emailed to ${variables.email}`);
      setAddUserDialogOpen(false);
      setAddUserName("");
      setAddUserEmail("");
      setAddUserRole("cashier");
      setAddUserDepartment("Operations");
      setAddUserBranchId("all");
      qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });
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
   * Grants or revokes one permission on the selected role.
   *
   * There is no translation step any more. The switch *is* the permission —
   * it was rendered from the server's catalogue, so the string posted here is
   * one the API already told us it accepts. The old version rebuilt the string
   * from a module name and a checkbox key, which is how six switches came to
   * post permissions that did not exist and Reports' "View" came to grant
   * profit visibility.
   */
  const updatePermission = async (backendPermission: string, value: boolean) => {
    if (!canManage || !onlineReady) {
      toast.info("Permission changes require an internet connection.");
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
      await usersApi.setPermission(selectedRole, backendPermission, value);
      toast.success(lastSuccessMessage ?? "Permissions updated");
      qc.invalidateQueries({ queryKey: ["admin-role-permissions", tenantId] });
      qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });
      // Same reason as the bulk writes: the sidebar and route guard read a
      // shared store with its own freshness window, and an owner who has just
      // changed a role should not keep navigating by the old menu.
      void refreshPermissions();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not update permissions");
    }
  };

  /**
   * Sets the whole selected role in one request.
   *
   * ## Why this is not a loop over `updatePermission`
   *
   * The catalogue is well over a hundred permissions, so "grant everything"
   * done one switch at a time is a hundred-odd sequential requests: slow
   * enough that an owner assumes it has hung, and — worse — not atomic. A
   * connection dropped halfway leaves the role holding some arbitrary prefix
   * of the change, and nothing on screen says which. The bulk endpoint writes
   * the whole set in one transaction, so the role either ends up as asked or
   * exactly as it was.
   *
   * ## Reset is still "remove the customisations"
   *
   * `defaults` does not write the default permissions in as rows; it clears
   * this workspace's overrides so the role resolves to the shipped defaults
   * again and keeps tracking them as the product grows. Freezing today's
   * defaults into rows is how a workspace ends up locked out of every module
   * released afterwards.
   */
  const applyRolePermissions = async (
    mode: "grant_all" | "revoke_all" | "defaults" | "set",
    options?: { permissions?: string[]; describe?: string }
  ) => {
    if (!canManage || !onlineReady) {
      toast.info("Permission changes require an internet connection.");
      return;
    }

    if (selectedRole === "owner") {
      // The owner role is every permission by definition and the server
      // refuses to edit it. Saying so beats a 403 the screen has to explain.
      toast.info("The owner role always holds every permission.");
      return;
    }

    setBulkPending(mode);

    try {
      const result =
        mode === "set"
          ? await usersApi.setRolePermissions(selectedRole, {
              mode: "set",
              permissions: options?.permissions ?? [],
            })
          : await usersApi.setRolePermissions(selectedRole, { mode });

      toast.success(
        options?.describe ??
          (mode === "grant_all"
            ? `${roleLabel(selectedRole)} now holds all ${result.effective.length} permissions`
            : mode === "revoke_all"
              ? `Every permission removed from ${roleLabel(selectedRole)}`
              : `${roleLabel(selectedRole)} reset to its default permissions`)
      );

      qc.invalidateQueries({ queryKey: ["admin-role-permissions", tenantId] });
      qc.invalidateQueries({ queryKey: ["admin-members", tenantId] });

      /*
       * Anyone signed in on this device whose role just changed shape should
       * see it now rather than at the next poll — including the person who
       * pressed the button, if they are looking at a menu built from it.
       */
      void refreshPermissions();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not update permissions");
    } finally {
      setBulkPending(null);
      setConfirmBulk(null);
    }
  };

  /**
   * Turns one module's actions on or off together.
   *
   * Sent as the role's complete new permission list rather than as a series of
   * single toggles, for the same atomicity reason as the role-wide buttons —
   * and because a half-applied module ("create but not view") is a state the
   * person clicking "All" never asked for.
   */
  const setModulePermissions = async (module: CatalogueModule, granted: boolean) => {
    const next = new Set(grantedPermissions);
    for (const action of module.actions) {
      if (granted) next.add(action.permission);
      else next.delete(action.permission);
    }

    await applyRolePermissions("set", {
      permissions: [...next],
      describe: `${module.label} ${granted ? "fully granted to" : "hidden from"} ${roleLabel(selectedRole)}`,
    });
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

  return (
    <PageShell title="Invites & Permissions" description="Manage roles, invitations, branch access, permissions, and security governance.">
      <PageBackground image={warehouseBg} opacity={0}>
        <PageContainer>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/user-management"))}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>

            <Button variant="outline" size="sm" onClick={() => setSecurityDialogOpen(true)}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Security Center
            </Button>

            <Button
              variant="ghost"
              size="sm"
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

            <Button variant="ghost" size="sm" onClick={exportUsersCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>

            
          </div>

          {/*
            Plain circular icon badges on a white card, matching the
            reference layout — no solid-colour tiles, no hero banner. A
            headcount carries no status of its own so it stays neutral;
            only figures that mean "good" or "needs attention" (online,
            pending, security) keep a status colour on the icon itself.
          */}

          {offlineModeActive && (
            <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/70">
                    <WifiOff className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">User Management is in offline/read-only mode</p>
                    <p className="text-sm opacity-90">Members, invites, permissions, activity summaries, and branches are shown from cache. Online login is required for invites, role edits, removals, and permission changes.</p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-background/70 text-amber-700 dark:text-amber-300 hover:bg-background/70">
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

          
          <Card className="rounded-3xl shadow-sm mb-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5 text-primary" />
                Manage a user's access
              </CardTitle>
              <CardDescription>Select a member from the current workspace to quickly adjust their role and access.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground">Select User</label>
                  <Select value={selectedAccessUserId} onValueChange={setSelectedAccessUserId}>
                    <SelectTrigger className="mt-1 rounded-2xl"><SelectValue placeholder="Select a user..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a user...</SelectItem>
                      {(membersQ.data ?? []).map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.display_name || m.user_id || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {accessUser && (
                  <>
                    <div className="md:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground">Role</label>
                      <Select 
                        value={accessUser.role} 
                        disabled={!canManage || accessUser.role === "owner"}
                        onValueChange={(val) => updateMemberRole.mutate({ userId: accessUser.user_id, newRole: val as Role })}
                      >
                        <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground">Department</label>
                      <Select 
                        value={accessUser.department || "Operations"} 
                        disabled={!canManage}
                        onValueChange={(val) => updateMemberProfile.mutate({ userId: accessUser.user_id, department: val })}
                      >
                        <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((department) => (
                            <SelectItem key={department} value={department}>{department}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground">Branch Scope</label>
                      <Select 
                        value={accessUser.branch_id || "all"} 
                        disabled={!canManage}
                        onValueChange={(val) => updateMemberProfile.mutate({ userId: accessUser.user_id, branchId: val })}
                      >
                        <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Branches</SelectItem>
                          {(branchesQ.data ?? []).map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-12">
            <div className="space-y-5 xl:col-span-8">
              

              <Card id="role-permissions-section" className="rounded-3xl shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 lg:flex-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Settings className="h-5 w-5 text-primary" />
                        Role Permission Command Center
                      </CardTitle>
                      <CardDescription>Manage role templates by module group or use the compact enterprise matrix.</CardDescription>
                    </div>

                    {/*
                      The role picker and the three role-wide writes stack
                      rather than sharing a row. Side by side they fit only on
                      the widest screens: this card sits in an eight-column
                      grid slot, so a row wrapped into a ragged two-and-a-half
                      lines at every ordinary laptop width.
                    */}
                    <div className="flex flex-col gap-2 lg:shrink-0 lg:items-end">
                      <div className="flex items-center gap-2">
                        <Select value={permissionTarget} onValueChange={(v) => setPermissionTarget(v as "role" | "user")}>
                          <SelectTrigger className="rounded-2xl w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="role">By Role</SelectItem>
                            <SelectItem value="user">By User</SelectItem>
                          </SelectContent>
                        </Select>

                        {permissionTarget === "role" ? (
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
                        ) : (
                          <Select value={selectedPermissionUser} onValueChange={setSelectedPermissionUser}>
                            <SelectTrigger className="rounded-2xl sm:w-[220px]">
                              <SelectValue placeholder="Select user..." />
                            </SelectTrigger>
                            <SelectContent>
                              {membersQ.data?.map((m) => (
                                <SelectItem key={m.user_id} value={m.user_id}>
                                  {m.display_name || "User"} ({roleLabel(m.role)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/*
                        Three role-wide writes, ordered left to right by how
                        much they change: back to normal, then everything on,
                        then everything off — so the destructive one is last
                        and is the only one tinted red. Each is a single
                        request; the server replaces the role's whole override
                        set in one transaction rather than the screen looping
                        over a hundred switches.
                      */}
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 whitespace-nowrap rounded-2xl sm:flex-none"
                          disabled={!bulkEnabled}
                          onClick={() => void applyRolePermissions("defaults")}
                        >
                          {bulkPending === "defaults" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          )}
                          Defaults
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 whitespace-nowrap rounded-2xl border-emerald-500/25 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 sm:flex-none"
                          disabled={!bulkEnabled}
                          onClick={() => setConfirmBulk("grant_all")}
                        >
                          {bulkPending === "grant_all" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCheck className="mr-2 h-4 w-4" />
                          )}
                          Grant all
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 whitespace-nowrap rounded-2xl border-rose-500/25 text-rose-700 hover:bg-rose-50 hover:text-rose-800 sm:flex-none"
                          disabled={!bulkEnabled}
                          onClick={() => setConfirmBulk("revoke_all")}
                        >
                          {bulkPending === "revoke_all" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldOff className="mr-2 h-4 w-4" />
                          )}
                          Revoke all
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="mb-5 rounded-3xl border bg-gradient-to-br from-slate-50 to-white p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {permissionTarget === "role" ? getRoleBadge(selectedRole) : <Badge variant="secondary">User Override</Badge>}
                          <Badge variant="outline" className="rounded-full">
                            {enabledPermissions} of {totalPermissions} permissions
                          </Badge>
                          {selectedRole === "owner" ? (
                            <Badge variant="outline" className="rounded-full border-amber-500/25 bg-amber-500/10 text-amber-700">
                              <Lock className="mr-1 h-3 w-3" />
                              Not editable
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{ROLE_TEMPLATES[selectedRole]}</p>

                        {/*
                          A bar rather than only a count, because the number
                          people actually want is the proportion — "does this
                          role reach most of the product or a corner of it" is
                          the question an owner is answering, and 34 means
                          nothing without the 118 beside it.
                        */}
                        <div className="mt-3 max-w-md">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                              style={{ width: `${Math.round(grantedShare * 100)}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {Math.round(grantedShare * 100)}% of the catalogue ·{" "}
                            {catalogueModules.filter((m) => m.actions.some((a) => grantedPermissions.has(a.permission))).length} of{" "}
                            {catalogueModules.length} modules visible
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-2xl border bg-card p-3">
                          <p className="font-data text-lg font-bold text-emerald-700">{enabledPermissions}</p>
                          <p className="text-muted-foreground">granted</p>
                        </div>
                        <div className="rounded-2xl border bg-card p-3">
                          <p className="font-data text-lg font-bold text-muted-foreground">{Math.max(totalPermissions - enabledPermissions, 0)}</p>
                          <p className="text-muted-foreground">withheld</p>
                        </div>
                        <div className="rounded-2xl border bg-card p-3">
                          <p className="font-data text-lg font-bold text-foreground">
                            {catalogueModules.filter((m) => m.actions.some((a) => grantedPermissions.has(a.permission))).length}
                          </p>
                          <p className="text-muted-foreground">modules</p>
                        </div>
                      </div>
                    </div>

                    {/*
                      Said once, here, rather than implied by a switch failing
                      to move: what an owner does on this screen is what the
                      person in the shop sees the next time they sign in.
                    */}
                    <p className="mt-4 flex items-start gap-2 rounded-2xl bg-muted/40 px-3 py-2 text-xs text-foreground">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Changes apply to everyone holding the {roleLabel(selectedRole)} role. They take effect on
                        that member's next request, and are what they see when they next sign in — no re-invite needed.
                      </span>
                    </p>
                  </div>

                  <Tabs defaultValue="groups" className="w-full">
                    <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl bg-muted/40 p-1">
                      <TabsTrigger value="groups" className="rounded-xl px-4 py-2">Grouped Cards</TabsTrigger>
                      <TabsTrigger value="matrix" className="rounded-xl px-4 py-2">Matrix View</TabsTrigger>
                    </TabsList>

                    <TabsContent value="groups" className="mt-5">
                      {catalogueGroups.length === 0 ? (
                        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                          {permissionsQ.isLoading ? "Loading the permission catalogue..." : "No permissions available."}
                        </p>
                      ) : (
                        <Tabs defaultValue={catalogueGroups[0].key} className="w-full">
                          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl bg-muted/40 p-1">
                            {catalogueGroups.map((group) => (
                              <TabsTrigger key={group.key} value={group.key} className="rounded-xl px-4 py-2">{group.label}</TabsTrigger>
                            ))}
                          </TabsList>

                          {catalogueGroups.map((group) => (
                            <TabsContent key={group.key} value={group.key} className="mt-5">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {group.modules.map((entry) => {
                                  const grantedHere = entry.actions.filter((a) => grantedPermissions.has(a.permission)).length;

                                  return (
                                    <div
                                      key={entry.module}
                                      className={`rounded-3xl border p-4 transition-colors ${
                                        grantedHere === 0 ? "border-dashed bg-muted/30" : "bg-card"
                                      }`}
                                    >
                                      <div className="mb-4 flex items-start gap-3">
                                        <div
                                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                                            grantedHere === 0 ? "bg-muted" : "bg-emerald-500/10"
                                          }`}
                                        >
                                          <KeyRound
                                            className={`h-4 w-4 ${
                                              grantedHere === 0 ? "text-muted-foreground" : "text-emerald-700"
                                            }`}
                                          />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="font-semibold">{entry.label}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {roleLabel(selectedRole)} · {grantedHere} of {entry.actions.length} granted
                                            {grantedHere === 0 ? " · module hidden" : ""}
                                          </p>
                                        </div>

                                        {/*
                                          Per-module All/None. A module is the
                                          unit an owner actually thinks in —
                                          "the cashier should not touch
                                          purchases at all" — and doing that
                                          one switch at a time invites the
                                          half-applied states nobody wants,
                                          like create without view.
                                        */}
                                        <div className="flex shrink-0 gap-1">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 rounded-full px-2 text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                                            disabled={!bulkEnabled || grantedHere === entry.actions.length}
                                            onClick={() => void setModulePermissions(entry, true)}
                                          >
                                            All
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 rounded-full px-2 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                                            disabled={!bulkEnabled || grantedHere === 0}
                                            onClick={() => void setModulePermissions(entry, false)}
                                          >
                                            None
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-2">
                                        {entry.actions.map((action) => {
                                          const on = grantedPermissions.has(action.permission);

                                          return (
                                            /*
                                              Granted and withheld look
                                              different beyond the switch
                                              position. Every row used to be
                                              the same cyan whichever way it
                                              was set, so scanning a module for
                                              "what does this role actually
                                              have" meant reading twelve
                                              switch knobs one at a time.
                                            */
                                            <div
                                              key={action.permission}
                                              className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition-colors ${
                                                on
                                                  ? "border-emerald-500/25 bg-emerald-500/10"
                                                  : "border-border bg-muted/40"
                                              }`}
                                            >
                                              <div className="min-w-0">
                                                <span className={`text-sm ${on ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
                                                  {action.label}
                                                </span>
                                                {action.hint ? (
                                                  <p className="text-[11px] leading-tight text-muted-foreground">{action.hint}</p>
                                                ) : null}
                                                <p className="font-data text-[10px] text-muted-foreground/70">{action.permission}</p>
                                              </div>
                                              <Switch
                                                checked={on}
                                                disabled={!bulkEnabled}
                                                onCheckedChange={(checked) => updatePermission(action.permission, checked)}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </TabsContent>
                          ))}
                        </Tabs>
                      )}
                    </TabsContent>

                    <TabsContent value="matrix" className="mt-5">
                      <div className="overflow-x-auto rounded-3xl border">
                        <div className="min-w-[720px]">
                          <div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                            <div className="col-span-3">Module</div>
                            <div className="col-span-7">Permissions</div>
                            <div className="col-span-2 text-right">Access</div>
                          </div>

                          {catalogueModules.map((entry) => {
                            const grantedHere = entry.actions.filter((a) => grantedPermissions.has(a.permission)).length;

                            return (
                              <div key={`matrix-${entry.module}`} className="grid grid-cols-12 items-center gap-4 border-b px-5 py-3 last:border-b-0">
                                <div className="col-span-3 font-medium">{entry.label}</div>

                                <div className="col-span-7 flex flex-wrap gap-x-4 gap-y-2">
                                  {entry.actions.map((action) => (
                                    <label
                                      key={action.permission}
                                      className="flex items-center gap-2"
                                      title={action.hint ? `${action.permission} — ${action.hint}` : action.permission}
                                    >
                                      <Switch
                                        checked={grantedPermissions.has(action.permission)}
                                        disabled={!bulkEnabled}
                                        onCheckedChange={(checked) => updatePermission(action.permission, checked)}
                                      />
                                      <span className="text-xs">{action.label}</span>
                                    </label>
                                  ))}
                                </div>

                                {/*
                                  A module with nothing granted is hidden from that
                                  role's menu and its pages refuse — which is the
                                  whole point, so the table says so plainly.
                                */}
                                <div className="col-span-2 text-right text-xs text-muted-foreground">
                                  {grantedHere === 0 ? "Hidden" : `${grantedHere}/${entry.actions.length}`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
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
                <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Valid rows detected: <span className="font-bold text-foreground">{parseBulkEmails(bulkText, inviteRole).length}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-2xl" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
                <Button className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary" disabled={!canManage || bulkInvite.isPending} onClick={() => bulkInvite.mutate()}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {bulkInvite.isPending ? "Creating..." : "Create Bulk Invites"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
            <DialogContent className="max-w-lg rounded-3xl">
              <DialogHeader>
                <DialogTitle>Add User</DialogTitle>
                <DialogDescription>
                  Creates the account immediately. A generated password is emailed to them, and they
                  are required to change it the first time they sign in.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Full name</label>
                  <Input
                    className="mt-1 rounded-2xl"
                    placeholder="Jane Doe"
                    value={addUserName}
                    onChange={(e) => setAddUserName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input
                    className="mt-1 rounded-2xl"
                    placeholder="user@example.com"
                    value={addUserEmail}
                    onChange={(e) => setAddUserEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Role</label>
                    <Select value={addUserRole} onValueChange={(v) => setAddUserRole(v as Role)}>
                      <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => r !== "owner").map((r) => (
                          <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Department</label>
                    <Select value={addUserDepartment} onValueChange={setAddUserDepartment}>
                      <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((department) => (
                          <SelectItem key={department} value={department}>{department}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Branch</label>
                  <Select value={addUserBranchId} onValueChange={setAddUserBranchId}>
                    <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {(branchesQ.data ?? []).map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" className="rounded-2xl" onClick={() => setAddUserDialogOpen(false)}>Cancel</Button>
                <Button
                  className="rounded-2xl bg-primary text-primary-foreground hover:opacity-90"
                  disabled={
                    !canManage ||
                    createUser.isPending ||
                    !addUserName.trim() ||
                    !isValidEmail(addUserEmail)
                  }
                  onClick={() =>
                    createUser.mutate({
                      name: addUserName,
                      email: addUserEmail,
                      role: addUserRole,
                      department: addUserDepartment,
                      branchId: addUserBranchId,
                    })
                  }
                >
                  <UserPlus2 className="mr-2 h-4 w-4" />
                  {createUser.isPending ? "Creating..." : "Create Account"}
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
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-black text-white">
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
                      <div className="rounded-3xl border bg-primary/10 p-4 text-foreground"><BriefcaseBusiness className="mb-3 h-5 w-5" /><p className="text-xs">Department</p><p className="font-bold">{profileUser.department || "Operations"}</p></div>
                      <div className="rounded-3xl border bg-emerald-500/10 p-4 text-emerald-700"><MapPin className="mb-3 h-5 w-5" /><p className="text-xs">Branch</p><p className="font-bold">{profileUser.branch_name || "All"}</p></div>
                      <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-700"><WalletCards className="mb-3 h-5 w-5" /><p className="text-xs">Salary Preview</p><p className="font-bold font-data">{profileUser.salary_preview ? `RF ${profileUser.salary_preview.toLocaleString()}` : "—"}</p></div>
                    </div>

                    <div className="rounded-3xl border p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        <h3 className="font-black">Recent Activity</h3>
                      </div>
                      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                        {(activityQ.data ?? []).length === 0 ? (
                          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No activity found for this user yet.</div>
                        ) : (
                          (activityQ.data ?? []).map((log) => (
                            <div key={log.id} className="rounded-2xl border border-border bg-muted/40 p-3">
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
                  <Button className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary" disabled={!canManage} onClick={() => openBranchEditor(profileUser)}>
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
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="font-semibold">{profileUser.display_name || "Unnamed User"}</p>
                    <p className="text-xs text-muted-foreground font-data">{profileUser.user_id}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Department</label>
                    <select
                      className="mt-1 flex h-10 w-full items-center justify-between rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                    >
                      <option value="" disabled hidden>Select department...</option>
                      {DEPARTMENTS.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Branch Scope</label>
                    <select
                      className="mt-1 flex h-10 w-full items-center justify-between rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                      <option value="" disabled hidden>Select branch scope...</option>
                      <option value="all">All Branches</option>
                      {(branchesQ.data ?? []).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" className="rounded-2xl" onClick={() => setBranchDialogOpen(false)}>Cancel</Button>
                <Button
                  className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary"
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
                  <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-3"><span>Admins / Owners</span><b>{stats.admins}</b></div>
                  <div className="flex items-center justify-between rounded-2xl bg-amber-500/10 p-3"><span>Pending Invites</span><b>{stats.pending}</b></div>
                  <div className="flex items-center justify-between rounded-2xl bg-rose-500/10 p-3"><span>Suspended / Locked</span><b>{stats.suspended}</b></div>
                  <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-3"><span>Online Mode</span><b>{onlineReady ? "Yes" : "No"}</b></div>
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card p-4">
                <h3 className="mb-3 font-black">Recommended Governance Actions</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-background p-3 text-sm"><AlertTriangle className="mb-2 h-4 w-4 text-amber-600" />Keep admin/owner access limited to trusted leadership.</div>
                  <div className="rounded-2xl bg-background p-3 text-sm"><UserX className="mb-2 h-4 w-4 text-rose-600" />Remove unused invites and suspended users after review.</div>
                  <div className="rounded-2xl bg-background p-3 text-sm"><MonitorCog className="mb-2 h-4 w-4 text-muted-foreground" />Review activity logs for role changes and permission edits.</div>
                  <div className="rounded-2xl bg-background p-3 text-sm"><Layers3 className="mb-2 h-4 w-4 text-emerald-600" />Use role templates instead of giving everyone admin access.</div>
                </div>
              </div>
              <DialogFooter><Button variant="outline" className="rounded-2xl" onClick={() => setSecurityDialogOpen(false)}>Close</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/*
            Both role-wide writes are confirmed, and the confirmation says the
            number rather than a vague "are you sure". "Revoke all 118
            permissions from Cashier — 4 people hold this role" is a sentence
            somebody can actually check against what they meant; "this cannot
            be undone" is not, because nobody remembers which of a hundred
            switches were on before.
          */}
          <AlertDialog open={confirmBulk !== null} onOpenChange={(open) => !open && setConfirmBulk(null)}>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  {confirmBulk === "grant_all" ? (
                    <>
                      <CheckCheck className="h-5 w-5 text-emerald-600" />
                      Grant every permission to {roleLabel(selectedRole)}?
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-5 w-5 text-rose-600" />
                      Revoke every permission from {roleLabel(selectedRole)}?
                    </>
                  )}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm">
                    <p>
                      {confirmBulk === "grant_all" ? (
                        <>
                          All {totalPermissions} permissions — including cost prices, profit margins,
                          refunds and member management — will be given to everyone holding this role.
                        </>
                      ) : (
                        <>
                          All {enabledPermissions} permissions currently held will be removed. Members with
                          this role keep their account and their history, but will see an empty
                          workspace until something is granted back.
                        </>
                      )}
                    </p>

                    <p className="rounded-2xl bg-muted px-3 py-2 text-xs">
                      {roleMemberCount === 0
                        ? `Nobody currently holds the ${roleLabel(selectedRole)} role.`
                        : `${roleMemberCount} ${roleMemberCount === 1 ? "person holds" : "people hold"} the ${roleLabel(selectedRole)} role. The change reaches them on their next request.`}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Reversible with <span className="font-medium">Defaults</span>, which puts the role
                      back to what it ships with.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={
                    confirmBulk === "grant_all"
                      ? "rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                      : "rounded-2xl bg-rose-600 text-white hover:bg-rose-700"
                  }
                  onClick={(event) => {
                    // The write is awaited by the handler, which closes the
                    // dialog itself once it settles — so the default
                    // close-on-click is suppressed and the button can show
                    // that something is happening.
                    event.preventDefault();
                    if (confirmBulk) void applyRolePermissions(confirmBulk);
                  }}
                >
                  {bulkPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {confirmBulk === "grant_all" ? "Grant all" : "Revoke all"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PageContainer>
      </PageBackground>
    </PageShell>
  );
}
