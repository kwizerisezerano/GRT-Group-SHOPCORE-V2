import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { decryptData } from "@/lib/encryption";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import {
  Loader2,
  Save,
  Building2,
  Users,
  ShieldCheck,
  Crown,
  UserCog,
  Eye,
  Palette,
  Mail,
  Link,
  CreditCard,
  Settings,
  Lock,
  Activity,
  UserRound,
  Pencil,
  X,
  CheckCircle2,
  AlertTriangle,
  Database,
  Wifi,
  WifiOff,
  Search,
  Download,
  Printer,
  Copy,
  KeyRound,
  Fingerprint,
  Globe2,
  BadgeCheck,
  BarChart3,
  SlidersHorizontal,
  ShieldAlert,
  FileText,
  RefreshCw,
  Zap,
  Layers3,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const NAVY = "#0b3d5c";
const db = supabase as any;

interface TenantRow {
  id: string;
  name: string | null;
  plan: string | null;
  slug: string | null;
  logo_url: string | null;
  brand_color: string | null;
  contact_email: string | null;
  owner_id: string | null;
  created_at: string | null;
}

interface Member {
  user_id: string;
  display_name: string | null;
  role: AppRole | null;
}

function onlineReady() {
  return isOnline() && !isOfflineMode();
}

function roleWeight(role: AppRole | null) {
  const order: AppRole[] = ["viewer", "staff", "admin", "owner"];
  return order.indexOf(role ?? "viewer");
}

function getRoleBadge(role: AppRole | null) {
  const value = role ?? "viewer";

  if (value === "owner") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-purple-500/30 bg-purple-500/10 text-purple-600"
      >
        OWNER
      </Badge>
    );
  }

  if (value === "admin") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-blue-500/30 bg-blue-500/10 text-blue-600"
      >
        ADMIN
      </Badge>
    );
  }

  if (value === "staff") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
      >
        STAFF
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="rounded-full border-cyan-200 bg-cyan-50 text-cyan-700"
    >
      VIEWER
    </Badge>
  );
}

function getRoleIcon(role: AppRole | null) {
  const value = role ?? "viewer";

  if (value === "owner") return Crown;
  if (value === "admin") return ShieldCheck;
  if (value === "staff") return UserCog;

  return Eye;
}

function getPlanBadge(plan: string) {
  if (plan === "enterprise") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-purple-500/30 bg-purple-500/10 text-purple-600"
      >
        Enterprise
      </Badge>
    );
  }

  if (plan === "pro") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
      >
        Pro
      </Badge>
    );
  }

  if (plan === "starter") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-sky-500/30 bg-sky-500/10 text-sky-600"
      >
        Starter
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="rounded-full border-cyan-200 bg-cyan-50 text-cyan-700"
    >
      Free
    </Badge>
  );
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

function safeColor(value?: string | null) {
  const color = (value || NAVY).trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : NAVY;
}

function initials(name?: string | null) {
  return String(name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function copyToClipboard(value: string, label = "Copied") {
  if (!value) return;
  navigator.clipboard.writeText(value);
  toast.success(label);
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  helper,
}: {
  label: string;
  value: string | number;
  icon: any;
  tone?: "blue" | "emerald" | "amber" | "purple" | "rose" | "sky" | "teal";
  helper?: string;
}) {
  const toneMap = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-orange-200 bg-orange-50 text-orange-700",
    purple: "border-violet-200 bg-violet-50 text-violet-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-cyan-200 bg-cyan-50 text-cyan-700",
    teal: "border-cyan-200 bg-cyan-50 text-cyan-700",
  };

  return (
    <div
      className={`min-h-[92px] rounded-2xl border p-3 shadow-sm ${toneMap[tone]}`}
    >
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="mt-0.5 break-words text-xl font-black leading-tight">
        {value}
      </p>
      {helper && (
        <p className="mt-2 line-clamp-1 text-[11px] opacity-75">{helper}</p>
      )}
    </div>
  );
}


function SolidKpi({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: any;
  tone: "blue" | "emerald" | "orange" | "violet" | "rose" | "cyan";
}) {
  const toneMap = {
    blue: "from-blue-600 to-blue-700 shadow-blue-900/20",
    emerald: "from-emerald-600 to-emerald-700 shadow-emerald-900/20",
    orange: "from-orange-600 to-orange-700 shadow-orange-900/20",
    violet: "from-violet-600 to-violet-700 shadow-violet-900/20",
    rose: "from-rose-600 to-rose-700 shadow-rose-900/20",
    cyan: "from-cyan-600 to-cyan-700 shadow-cyan-900/20",
  };

  return (
    <div className={`relative h-[102px] overflow-hidden rounded-2xl bg-gradient-to-br ${toneMap[tone]} p-3 text-white shadow-lg`}>
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/15" />
      <div className="absolute right-4 top-5 h-2.5 w-2.5 rounded-full bg-white/35" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/18 backdrop-blur">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-black leading-tight text-white">{label}</p>
          <p className="mt-1 max-w-full truncate font-data text-xl font-black leading-none">{value}</p>
          <p className="mt-1 inline-flex rounded-full bg-white/16 px-2.5 py-0.5 text-[11px] font-bold leading-none text-white/95">
            {helper}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TenantSettings() {
  const { tenantId, role, refreshTenant } = useAuth();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("all");

  const tenantQ = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async (): Promise<TenantRow | null> => {
      if (!tenantId) return null;

      const cachedTenants = ((await getCachedTable("tenants")) ||
        []) as TenantRow[];

      if (!onlineReady()) {
        return cachedTenants.find((item) => item.id === tenantId) || null;
      }

      try {
        const { data, error } = await db
          .from("tenants")
          .select(
            "id, name, plan, slug, logo_url, brand_color, contact_email, owner_id, created_at",
          )
          .eq("id", tenantId)
          .single();

        if (error) throw error;

        const tenant = data as TenantRow;
        await saveCachedTable("tenants", [
          tenant,
          ...cachedTenants.filter((item) => item.id !== tenant.id),
        ]);
        return tenant;
      } catch (error: any) {
        if (isNetworkError(error)) {
          return cachedTenants.find((item) => item.id === tenantId) || null;
        }
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const membersQ = useQuery({
    queryKey: ["tenant-members", tenantId],
    queryFn: async (): Promise<Member[]> => {
      if (!tenantId) return [];

      const cachedMembers = ((await getCachedTable(
        "tenant_members_enriched",
      )) || []) as (Member & {
        tenant_id?: string;
      })[];

      if (!onlineReady()) {
        return cachedMembers.filter((member) => member.tenant_id === tenantId);
      }

      try {
        const { data: tenantMembers, error: membersError } = await db
          .from("tenant_members")
          .select("user_id, tenant_id")
          .eq("tenant_id", tenantId);

        if (membersError) throw membersError;

        const ids = (tenantMembers ?? []).map((member: any) => member.user_id);
        if (!ids.length) return [];

        const [{ data: profiles }, { data: roles }] = await Promise.all([
          db.from("profiles").select("id, display_name, phone").in("id", ids),
          db
            .from("user_roles")
            .select("user_id, role")
            .eq("tenant_id", tenantId)
            .in("user_id", ids),
        ]);

        const rows: (Member & { tenant_id: string })[] = ids.map(
          (id: string) => {
            const profile = profiles?.find((item: any) => item.id === id);
            const userRoles = (roles ?? [])
              .filter((item: any) => item.user_id === id)
              .map((item: any) => item.role as AppRole)
              .sort((a: AppRole, b: AppRole) => roleWeight(b) - roleWeight(a));

            return {
              tenant_id: tenantId,
              user_id: id,
              display_name: decryptData(profile?.display_name || '') || null,
              phone: decryptData(profile?.phone || '') || null,
              role: userRoles[0] ?? null,
            };
          },
        );

        const otherTenants = cachedMembers.filter(
          (member) => member.tenant_id !== tenantId,
        );
        await saveCachedTable("tenant_members_enriched", [
          ...otherTenants,
          ...rows,
        ]);
        return rows;
      } catch (error: any) {
        if (isNetworkError(error)) {
          return cachedMembers.filter(
            (member) => member.tenant_id === tenantId,
          );
        }
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const [form, setForm] = useState({
    name: "",
    plan: "free",
    logo_url: "",
    brand_color: "",
    contact_email: "",
  });

  useEffect(() => {
    if (tenantQ.data) {
      setForm({
        name: tenantQ.data.name ?? "",
        plan: tenantQ.data.plan ?? "free",
        logo_url: tenantQ.data.logo_url ?? "",
        brand_color: tenantQ.data.brand_color ?? "",
        contact_email: tenantQ.data.contact_email ?? "",
      });
    }
  }, [tenantQ.data]);

  const isOwner = role === "owner";
  const canManageRoles = role === "owner" || role === "admin";
  const offlineActive = !onlineReady();

  const roleStats = useMemo(() => {
    const members = membersQ.data ?? [];

    return {
      total: members.length,
      owners: members.filter((member) => member.role === "owner").length,
      admins: members.filter((member) => member.role === "admin").length,
      staff: members.filter((member) => member.role === "staff").length,
      viewers: members.filter(
        (member) => !member.role || member.role === "viewer",
      ).length,
    };
  }, [membersQ.data]);

  const healthScore = useMemo(() => {
    let score = 0;

    if (form.name.trim()) score += 18;
    if (form.contact_email.trim()) score += 14;
    if (form.logo_url.trim()) score += 12;
    if (form.brand_color.trim()) score += 10;
    if (tenantQ.data?.slug) score += 10;
    if (roleStats.owners > 0) score += 16;
    if (roleStats.admins > 0) score += 10;
    if (roleStats.total > 1) score += 10;

    return Math.min(score, 100);
  }, [form, tenantQ.data?.slug, roleStats]);

  const securityScore = useMemo(() => {
    let score = 40;

    if (roleStats.owners >= 1) score += 20;
    if (roleStats.admins >= 1) score += 15;
    if (roleStats.viewers <= roleStats.total / 2) score += 10;
    if (roleStats.owners <= 2) score += 10;
    if (canManageRoles) score += 5;

    return Math.min(score, 100);
  }, [roleStats, canManageRoles]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();

    return (membersQ.data ?? [])
      .filter((member) => {
        const matchesSearch =
          !q ||
          String(member.display_name || "")
            .toLowerCase()
            .includes(q) ||
          String(member.user_id || "")
            .toLowerCase()
            .includes(q);

        const roleValue = member.role ?? "viewer";
        const matchesRole =
          memberRoleFilter === "all" || roleValue === memberRoleFilter;

        return matchesSearch && matchesRole;
      })
      .sort((a, b) => roleWeight(b.role) - roleWeight(a.role));
  }, [membersQ.data, memberSearch, memberRoleFilter]);

  const save = async () => {
    if (!tenantId) return;

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      plan: form.plan,
      logo_url: form.logo_url.trim() || null,
      brand_color: form.brand_color.trim() || null,
      contact_email: form.contact_email.trim() || null,
    };

    try {
      if (!onlineReady()) {
        const cachedTenants = ((await getCachedTable("tenants")) ||
          []) as TenantRow[];
        const localTenant = {
          ...(tenantQ.data || {}),
          id: tenantId,
          ...payload,
          created_at: tenantQ.data?.created_at || new Date().toISOString(),
          operation: "update",
          sync_status: "pending_update",
        };

        await saveCachedTable("tenants", [
          localTenant,
          ...cachedTenants.filter((item) => item.id !== tenantId),
        ]);
        await savePending("tenants", {
          id: tenantId,
          ...payload,
          operation: "update",
          sync_status: "pending_update",
        });

        toast.success("Company workspace changes saved offline and will sync later");
        queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
        setEditDialogOpen(false);
        return;
      }

      const { error } = await db
        .from("tenants")
        .update(payload)
        .eq("id", tenantId);

      if (error) throw error;

      toast.success("Company workspace updated");
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
      refreshTenant();
      setEditDialogOpen(false);
    } catch (error: any) {
      if (isNetworkError(error)) {
        await savePending("tenants", {
          id: tenantId,
          ...payload,
          operation: "update",
          sync_status: "pending_update",
        });
        toast.success("Network failed. Workspace update queued offline.");
        setEditDialogOpen(false);
        return;
      }

      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const setMemberRole = async (userId: string, newRole: AppRole) => {
    if (!tenantId) return;

    try {
      if (!onlineReady()) {
        const next = (membersQ.data ?? []).map((member) =>
          member.user_id === userId ? { ...member, role: newRole } : member,
        );

        await saveCachedTable(
          "tenant_members_enriched",
          next.map((member) => ({ ...member, tenant_id: tenantId })),
        );
        await savePending("user_roles", {
          tenant_id: tenantId,
          user_id: userId,
          role: newRole,
          operation: "upsert_role",
          sync_status: "pending_update",
        });

        toast.success(`Role queued offline → ${newRole.toUpperCase()}`);
        queryClient.invalidateQueries({
          queryKey: ["tenant-members", tenantId],
        });
        return;
      }

      const { error: deleteError } = await db
        .from("user_roles")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      const { error: insertError } = await db.from("user_roles").insert({
        tenant_id: tenantId,
        user_id: userId,
        role: newRole,
      });

      if (insertError) throw insertError;

      toast.success(`Role updated → ${newRole.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ["tenant-members", tenantId] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role",
      );
    }
  };

  const exportMembers = () => {
    const rows = filteredMembers.map((member) => ({
      name: member.display_name || "Unnamed user",
      user_id: member.user_id,
      role: member.role || "viewer",
    }));

    const csv = [
      "Name,User ID,Role",
      ...rows.map((row) =>
        [row.name, row.user_id, row.role]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `workspace_members_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printWorkspaceSummary = () => {
    const html = `
      <html>
        <head>
          <title>Workspace Settings Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 28px; }
            h1 { color: ${safeColor(form.brand_color)}; margin-bottom: 4px; }
            .muted { color: #64748b; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 24px 0; }
            .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #f8fafc; text-transform: uppercase; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>${form.name || "Workspace"}</h1>
          <p class="muted">Workspace settings and member access report · ${new Date().toLocaleString()}</p>

          <div class="grid">
            <div class="card"><strong>Plan</strong><br />${form.plan}</div>
            <div class="card"><strong>Health Score</strong><br />${healthScore}%</div>
            <div class="card"><strong>Security Score</strong><br />${securityScore}%</div>
            <div class="card"><strong>Members</strong><br />${roleStats.total}</div>
            <div class="card"><strong>Owners</strong><br />${roleStats.owners}</div>
            <div class="card"><strong>Admins</strong><br />${roleStats.admins}</div>
          </div>

          <h2>Members</h2>
          <table>
            <thead><tr><th>Name</th><th>User ID</th><th>Role</th></tr></thead>
            <tbody>
              ${filteredMembers
                .map(
                  (member) =>
                    `<tr><td>${member.display_name || "Unnamed user"}</td><td>${member.user_id}</td><td>${member.role || "viewer"}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=980,height=760");
    if (!win) return toast.error("Popup blocked. Allow popups to print.");
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <PageShell
      title="Workspace Settings"
      description="Configure company identity, workspace branding, plan, security, members, and offline-ready access controls."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="relative min-h-[190px] xl:col-span-7 overflow-hidden rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-blue-300/25" />
            <div className="absolute right-8 bottom-8 h-16 w-16 rounded-full bg-cyan-300/25" />
            <div className="absolute -bottom-14 left-16 h-24 w-24 rounded-full bg-violet-300/20" />
            <div className="relative flex items-start gap-4">
              <div
                className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                style={form.logo_url ? undefined : { background: safeColor(form.brand_color) }}
              >
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt={form.name || "Workspace logo"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-6 w-6" />
                )}
                <span
                  className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-blue-50 ${offlineActive ? "bg-orange-500" : "bg-emerald-500"}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <Badge className="mb-2 rounded-full border-blue-500/20 bg-blue-600 px-3 py-1 text-white shadow-sm hover:bg-blue-600">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  Company Operations Center
                </Badge>

                <h1 className="max-w-2xl text-2xl font-black leading-tight tracking-tight text-slate-950">
                  Company & Workspace Control
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600">
                  Manage business identity, brand configuration, subscription plan, role governance,
                  access controls, security posture, member records, and offline-ready workspace settings.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                    <p className="text-xs font-semibold text-emerald-700">Workspace</p>
                    <p className="mt-1 truncate text-sm font-black text-slate-950">
                      {form.name || "Unnamed"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 shadow-sm">
                    <p className="text-xs font-semibold text-violet-700">Current Plan</p>
                    <div className="mt-1">{getPlanBadge(form.plan)}</div>
                  </div>

                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 shadow-sm">
                    <p className="text-xs font-semibold text-cyan-700">Sync Status</p>
                    <p className={`mt-1 truncate text-sm font-black ${offlineActive ? "text-orange-700" : "text-emerald-700"}`}>
                      {offlineActive ? "Offline Cache" : "Live Online"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:col-span-5">
            <SolidKpi
              label="Members"
              value={roleStats.total}
              helper="workspace users"
              icon={Users}
              tone="blue"
            />
            <SolidKpi
              label="Health"
              value={`${healthScore}%`}
              helper="identity readiness"
              icon={Activity}
              tone="emerald"
            />
            <SolidKpi
              label="Security"
              value={`${securityScore}%`}
              helper="access score"
              icon={ShieldCheck}
              tone="orange"
            />
            <SolidKpi
              label="Your Role"
              value={(role || "viewer").toUpperCase()}
              helper="current access"
              icon={KeyRound}
              tone="violet"
            />
            <SolidKpi
              label="Owners"
              value={roleStats.owners}
              helper="governance seats"
              icon={Crown}
              tone="rose"
            />
            <SolidKpi
              label="Admins"
              value={roleStats.admins}
              helper="control access"
              icon={UserCog}
              tone="cyan"
            />
          </div>
        </div>

        {offlineActive && (
          <div className="rounded-3xl border bg-amber-500/10 p-4 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                <WifiOff className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold">
                  Company workspace settings are using offline cache
                </p>
                <p className="text-sm opacity-90">
                  Identity and role changes can be queued locally and synced
                  when the connection returns.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Owners"
            value={roleStats.owners}
            icon={Crown}
            tone="purple"
          />
          <StatCard
            label="Admins"
            value={roleStats.admins}
            icon={ShieldCheck}
            tone="emerald"
          />
          <StatCard
            label="Staff"
            value={roleStats.staff}
            icon={UserCog}
            tone="sky"
          />
          <StatCard
            label="Viewers"
            value={roleStats.viewers}
            icon={Eye}
            tone="amber"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-black">Company Identity</h3>
                  <p className="text-xs text-muted-foreground">
                    Business name, plan, logo, brand color, contact email, and
                    public identifier.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isOwner && (
                  <Badge variant="outline" className="rounded-full">
                    <Lock className="mr-1 h-3 w-3" />
                    Read-only
                  </Badge>
                )}

                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    copyToClipboard(tenantQ.data?.slug || "", "Slug copied")
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Slug
                </Button>

                {isOwner && (
                  <Button
                    onClick={() => setEditDialogOpen(true)}
                    className="rounded-xl"
                    style={{ background: NAVY }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Workspace
                  </Button>
                )}
              </div>
            </div>

            {tenantQ.isLoading ? (
              <div className="flex items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading workspace settings...
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-blue-200 bg-white/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span className="text-xs font-medium">Company / Workspace Name</span>
                  </div>
                  <p className="truncate text-lg font-black">
                    {form.name || "Unnamed"}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-white/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                    <Globe2 className="h-4 w-4" />
                    <span className="text-xs font-medium">Workspace Slug</span>
                  </div>
                  <p className="truncate text-lg font-black">
                    {tenantQ.data?.slug || "No slug"}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-white/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="text-xs font-medium">Contact Email</span>
                  </div>
                  <p className="truncate text-lg font-black">
                    {form.contact_email || "Not set"}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-white/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    <span className="text-xs font-medium">Plan</span>
                  </div>
                  {getPlanBadge(form.plan)}
                </div>

                <div className="rounded-2xl border border-blue-200 bg-white/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                    <Link className="h-4 w-4" />
                    <span className="text-xs font-medium">Logo URL</span>
                  </div>
                  <p className="truncate text-sm font-semibold">
                    {form.logo_url || "Not set"}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-white/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                    <Palette className="h-4 w-4" />
                    <span className="text-xs font-medium">Brand Color</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-2xl border shadow-sm"
                      style={{ background: safeColor(form.brand_color) }}
                    />
                    <p className="font-semibold">{form.brand_color || NAVY}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 md:col-span-2">
                  <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                    <Fingerprint className="h-4 w-4" />
                    <span className="text-xs font-medium">Workspace ID</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-mono text-sm">
                      {tenantId || "—"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() =>
                        copyToClipboard(tenantId || "", "Workspace ID copied")
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Activity className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-black">Readiness Scores</h3>
                  <p className="text-xs text-muted-foreground">
                    Identity and access health.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    label: "Company Profile Health",
                    value: healthScore,
                    color: "bg-emerald-500",
                  },
                  {
                    label: "Security Posture",
                    value: securityScore,
                    color: "bg-blue-500",
                  },
                  {
                    label: "Brand Completion",
                    value:
                      form.logo_url && form.brand_color
                        ? 100
                        : form.logo_url || form.brand_color
                          ? 65
                          : 35,
                    color: "bg-purple-500",
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium">{item.label}</span>
                      <span className="font-bold">{item.value}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-black">Security Summary</h3>
                  <p className="text-xs text-muted-foreground">
                    Role distribution inside this workspace.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: "Owners",
                    value: roleStats.owners,
                    icon: Crown,
                    tone: "bg-purple-500/10 text-purple-700",
                  },
                  {
                    label: "Admins",
                    value: roleStats.admins,
                    icon: ShieldCheck,
                    tone: "bg-emerald-500/10 text-emerald-700",
                  },
                  {
                    label: "Staff",
                    value: roleStats.staff,
                    icon: UserCog,
                    tone: "bg-sky-500/10 text-sky-700",
                  },
                  {
                    label: "Viewers",
                    value: roleStats.viewers,
                    icon: Eye,
                    tone: "border border-cyan-200 bg-cyan-50 text-cyan-700",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center justify-between rounded-2xl p-3 ${item.tone}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <span className="font-bold">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <Users className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h3 className="font-black">Member Access Center</h3>
                <p className="text-xs text-muted-foreground">
                  Search users, audit access, update roles, export members, and
                  print access reports.
                </p>
              </div>

              <Badge variant="outline" className="ml-auto rounded-full lg:ml-0">
                {filteredMembers.length} / {membersQ.data?.length ?? 0}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                onClick={exportMembers}
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button
                className="rounded-xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                onClick={printWorkspaceSummary}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                className="rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                onClick={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["tenant", tenantId],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ["tenant-members", tenantId],
                  });
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="flex h-10 items-center gap-3 rounded-xl border border-blue-200 bg-white/80 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search member name or user ID..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-blue-500/70"
              />
            </div>

            <Select
              value={memberRoleFilter}
              onValueChange={setMemberRoleFilter}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="owner">Owners</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="viewer">Viewers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {membersQ.isLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading members...
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 py-10 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-10 w-10 opacity-30" />
              No members match this filter.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredMembers.map((member) => {
                const RoleIcon = getRoleIcon(member.role);

                return (
                  <div
                    key={member.user_id}
                    className="rounded-2xl border border-blue-200 bg-white/80 p-3 transition hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
                          <span className="text-sm font-black">
                            {initials(member.display_name)}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-bold">
                            {member.display_name ?? "Unnamed user"}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {member.user_id}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <RoleIcon className="h-4 w-4 text-muted-foreground" />
                            {getRoleBadge(member.role)}
                          </div>
                        </div>
                      </div>

                      {canManageRoles ? (
                        <Select
                          value={member.role ?? "viewer"}
                          onValueChange={(value) =>
                            setMemberRole(member.user_id, value as AppRole)
                          }
                        >
                          <SelectTrigger className="h-9 w-[118px] rounded-xl text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="rounded-full">
                          <Lock className="mr-1 h-3 w-3" />
                          Locked
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!canManageRoles && (
            <div className="mt-4 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-700">
              Only owners and admins can change member roles.
            </div>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <h3 className="font-black">Role Policy</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Owners control workspace identity. Owners and admins control
              member access. Staff and viewers have operational access according
              to module permissions.
            </p>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="font-black">Offline Readiness</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Workspace identity and enriched member data are cached locally.
              Supported updates are queued when offline and synced later.
            </p>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-black">Enterprise Controls</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Export, print, audit, search, filter, copy IDs, monitor readiness,
              and manage role distribution from one workspace control center.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-violet-200 bg-violet-50 shadow-sm">
          <div className="border-b border-violet-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black">Member Directory</h3>
                <p className="text-xs text-muted-foreground">
                  Compact administrative table for workspace access review.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-12 gap-4 border-b border-violet-200 bg-violet-100/70 px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                <div className="col-span-4">Member</div>
                <div className="col-span-3">User ID</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2">Access Level</div>
                <div className="col-span-1 text-right">Copy</div>
              </div>

              {filteredMembers.map((member) => {
                const RoleIcon = getRoleIcon(member.role);

                return (
                  <div
                    key={member.user_id}
                    className="grid grid-cols-12 items-center gap-4 border-b border-violet-200 px-4 py-2.5 last:border-b-0"
                  >
                    <div className="col-span-4 flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0b3d5c]/10 text-[#0b3d5c]">
                        <UserRound className="h-4 w-4" />
                      </div>

                      <p className="truncate font-medium">
                        {member.display_name ?? "Unnamed user"}
                      </p>
                    </div>

                    <div className="col-span-3 truncate font-mono text-xs text-muted-foreground">
                      {member.user_id}
                    </div>

                    <div className="col-span-2 flex items-center gap-2">
                      <RoleIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm capitalize">
                        {member.role ?? "viewer"}
                      </span>
                    </div>

                    <div className="col-span-2">
                      {getRoleBadge(member.role)}
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(member.user_id, "User ID copied")
                        }
                      >
                        <Copy className="h-4 w-4 text-sky-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl rounded-3xl border-blue-200 bg-blue-50">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>
              Update workspace name, subscription plan, logo, brand color, and
              contact information.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[68vh] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 md:col-span-2">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-white"
                  style={{ background: safeColor(form.brand_color) }}
                >
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Layers3 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-black">
                    {form.name || "Workspace Preview"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This preview appears across branded printable documents, POS
                    receipts, and workspace headers.
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="name">Company / Workspace Name</Label>
              <div className="relative mt-1.5">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  className="rounded-xl pl-10"
                  value={form.name}
                  disabled={!isOwner}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="ShopCore Business"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="plan">Plan</Label>
              <Select
                value={form.plan}
                disabled={!isOwner}
                onValueChange={(value) => setForm({ ...form, plan: value })}
              >
                <SelectTrigger id="plan" className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contact">Contact Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="contact"
                  type="email"
                  className="rounded-xl pl-10"
                  value={form.contact_email}
                  disabled={!isOwner}
                  onChange={(event) =>
                    setForm({ ...form, contact_email: event.target.value })
                  }
                  placeholder="business@example.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="logo">Logo URL</Label>
              <div className="relative mt-1.5">
                <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="logo"
                  className="rounded-xl pl-10"
                  value={form.logo_url}
                  disabled={!isOwner}
                  onChange={(event) =>
                    setForm({ ...form, logo_url: event.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="brand">Brand Color</Label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Palette className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="brand"
                    className="rounded-xl pl-10"
                    value={form.brand_color}
                    disabled={!isOwner}
                    onChange={(event) =>
                      setForm({ ...form, brand_color: event.target.value })
                    }
                    placeholder="#0b3d5c"
                  />
                </div>

                <Input
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded-xl p-1"
                  value={safeColor(form.brand_color)}
                  disabled={!isOwner}
                  onChange={(event) =>
                    setForm({ ...form, brand_color: event.target.value })
                  }
                  aria-label="Pick brand color"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-100 p-3 text-sm text-blue-800 md:col-span-2">
              <div className="flex gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Keep these settings accurate because they are used for branded
                  receipts, purchase orders, reports, staff documents, workspace
                  headers, and customer-facing exports.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditDialogOpen(false)}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>

            <Button
              onClick={save}
              disabled={saving || !isOwner}
              className="rounded-xl"
              style={{ background: NAVY }}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
