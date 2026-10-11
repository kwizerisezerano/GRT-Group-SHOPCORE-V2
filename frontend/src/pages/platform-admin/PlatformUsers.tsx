import { useMemo, useState } from "react";
import { lastSuccessMessage, platformApi } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformSearchBar } from "@/pages/platform-admin/components/PlatformSearchBar";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";

type PlatformAdmin = {
  id: string;
  user_id: string | null;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  /** Which workspace they belong to, when they belong to one. */
  tenant_name: string | null;
  display_name: string | null;
};

export default function PlatformUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const adminsQ = useQuery({
    queryKey: ["platform-admin-users"],
    /*
     * From our own database, not the Supabase table `platform_admins` this
     * deployment does not have — which is why the page listed nobody however
     * many operators and members existed.
     *
     * "Active" here means the account is a platform admin. The old table had
     * an is_active column of its own; ours does not, and inventing one would
     * misreport a workspace member as a deactivated operator.
     */
    queryFn: async (): Promise<PlatformAdmin[]> => {
      const { users } = await platformApi.platformUsers();

      return users.map((user) => ({
        id: user.id,
        user_id: user.id,
        email: user.email,
        role: user.is_platform_admin ? "platform_admin" : (user.role ?? "member"),
        is_active: user.is_platform_admin,
        created_at: user.created_at,
        tenant_name: user.tenant_name,
        display_name: user.display_name,
      }));
    },
  });

  const toggleAdmin = useMutation({
    /*
     * Toggling "active" grants or revokes platform-admin rights, which is what
     * that column now means. It used to write to the Supabase table
     * `platform_admins`, which this deployment does not have — so the switch
     * moved and nothing changed.
     *
     * The server refuses to let anybody revoke their own rights, or to remove
     * the last admin; both would lock the console with no way back in.
     */
    mutationFn: (admin: PlatformAdmin) =>
      platformApi.setPlatformAdmin(admin.id, !admin.is_active),
    onSuccess: () => {
      toast.success(lastSuccessMessage ?? "Platform user access updated.");
      qc.invalidateQueries({ queryKey: ["platform-admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update platform user.");
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (adminsQ.data ?? []).filter((admin) => {
      if (!q) return true;
      return (
        admin.email.toLowerCase().includes(q) ||
        admin.role.toLowerCase().includes(q) ||
        String(admin.user_id || "").toLowerCase().includes(q)
      );
    });
  }, [adminsQ.data, search]);

  const stats = useMemo(() => {
    const all = adminsQ.data ?? [];
    return {
      total: all.length,
      active: all.filter((admin) => admin.is_active).length,
      owners: all.filter((admin) => admin.is_active).length,
      inactive: all.filter((admin) => !admin.is_active).length,
    };
  }, [adminsQ.data]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Platform Identity"
        title="Platform Users"
        description="Manage ShopCore platform owners, administrators, support operators, billing staff and read-only auditors who can access the Platform Console."
        actions={
          <Button
            className="rounded-xl bg-primary font-semibold hover:bg-primary/90"
            onClick={() => {
              adminsQ.refetch();
              toast.info("Refreshing platform users...");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <PlatformKpiCard
          icon={<Users className="h-6 w-6" />}
          label="Platform Users"
          value={stats.total.toLocaleString()}
          tone="blue"
        />
        <PlatformKpiCard
          icon={<ShieldCheck className="h-6 w-6" />}
          label="Platform admins"
          value={stats.active.toLocaleString()}
          tone="emerald"
        />
        <PlatformKpiCard
          icon={<UserCog className="h-6 w-6" />}
          label="Console access"
          value={stats.owners.toLocaleString()}
          tone="violet"
        />
        <PlatformKpiCard
          icon={<ShieldCheck className="h-6 w-6" />}
          label="Workspace members"
          value={stats.inactive.toLocaleString()}
          tone="orange"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <PlatformSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search platform user email, role, or user ID..."
          />
        </div>

        {adminsQ.isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            Loading platform users...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            No platform users found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((admin) => (
                  <tr key={admin.id} className="border-t border-slate-200">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">
                        {admin.email}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {admin.user_id || "No linked auth user"}
                      </p>
                    </td>

                    <td className="px-4 py-4 capitalize">
                      {admin.role.replace(/_/g, " ")}
                    </td>

                    <td className="px-4 py-4">
                      {/*
                        What this account is, not a state it is not in. A
                        workspace member is not a suspended operator.
                      */}
                      <PlatformStatusBadge
                        status={admin.is_active ? "active" : "pending"}
                        label={admin.is_active ? "Platform admin" : "Workspace member"}
                      />
                    </td>

                    <td className="px-4 py-4">
                      {admin.created_at
                        ? new Date(admin.created_at).toLocaleString()
                        : "—"}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <Button
                        variant="outline"
                        className="rounded-xl border-slate-300 font-semibold"
                        disabled={toggleAdmin.isPending}
                        onClick={() => toggleAdmin.mutate(admin)}
                      >
                        {admin.is_active ? "Revoke admin" : "Make admin"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}