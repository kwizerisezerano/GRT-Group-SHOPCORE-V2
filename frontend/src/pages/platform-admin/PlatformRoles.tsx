import { UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DataPanel,
  EmptyState,
  MetricCard,
  PageShell,
  StatusPill,
  dateTime,
  usePlatformQuery,
} from "./PlatformOperationsSuite";

export default function PlatformRoles() {
  const rolesQ = usePlatformQuery({
    key: ["platform-roles-suite"],
    query: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_roles")
        .select("*")
        .order("role_name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const roles = rolesQ.data ?? [];

  return (
    <PageShell
      eyebrow="Identity & Security"
      title="Platform Roles"
      description="Manage platform roles for finance, support, security, infrastructure, customer success, auditors, and administrators."
      icon={<UserCog className="h-7 w-7" />}
      onRefresh={() => rolesQ.refetch()}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Roles" value={roles.length} />
        <MetricCard label="System Roles" value={roles.filter((r: any) => r.status === "system").length} tone="violet" />
        <MetricCard label="Active Roles" value={roles.filter((r: any) => r.status === "active").length} tone="emerald" />
        <MetricCard label="Assigned Users" value={roles.reduce((s: number, r: any) => s + Number(r.user_count || 0), 0)} tone="blue" />
      </section>

      <DataPanel title="Role Directory">
        {!roles.length ? (
          <EmptyState text="No platform roles configured." />
        ) : (
          <div className="space-y-3">
            {roles.map((role: any) => (
              <div key={role.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-950">{role.role_name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {role.role_key} · {role.permission_count || 0} permissions · {role.user_count || 0} users
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-600">
                      {role.description || "No role description."}
                    </p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Created {dateTime(role.created_at)}
                    </p>
                  </div>
                  <StatusPill status={role.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </DataPanel>
    </PageShell>
  );
}