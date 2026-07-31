import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck, UserCog, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
};

export default function PlatformUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const adminsQ = useQuery({
    queryKey: ["platform-admin-users"],
    queryFn: async (): Promise<PlatformAdmin[]> => {
      const { data, error } = await (supabase as any)
        .from("platform_admins")
        .select("id, user_id, email, role, is_active, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: async (admin: PlatformAdmin) => {
      const { error } = await (supabase as any)
        .from("platform_admins")
        .update({ is_active: !admin.is_active })
        .eq("id", admin.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Platform user access updated.");
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
      owners: all.filter((admin) => admin.role === "platform_owner").length,
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
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
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

      <div className="grid gap-4 xl:grid-cols-1">
        <PlatformKpiCard
          icon={<Users className="h-6 w-6" />}
          label="Platform Users"
          value={stats.total.toLocaleString()}
          tone="blue"
        />
        <PlatformKpiCard
          icon={<ShieldCheck className="h-6 w-6" />}
          label="Active Access"
          value={stats.active.toLocaleString()}
          tone="emerald"
        />
        <PlatformKpiCard
          icon={<UserCog className="h-6 w-6" />}
          label="Platform Owners"
          value={stats.owners.toLocaleString()}
          tone="violet"
        />
        <PlatformKpiCard
          icon={<ShieldCheck className="h-6 w-6" />}
          label="Inactive"
          value={stats.inactive.toLocaleString()}
          tone="orange"
        />
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
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
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
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
                      <p className="font-black text-slate-950">
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
                      <PlatformStatusBadge
                        status={admin.is_active ? "active" : "suspended"}
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
                        className="rounded-xl border-slate-300 font-black"
                        disabled={toggleAdmin.isPending}
                        onClick={() => toggleAdmin.mutate(admin)}
                      >
                        {admin.is_active ? "Disable" : "Enable"}
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