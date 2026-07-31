import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformSearchBar } from "@/pages/platform-admin/components/PlatformSearchBar";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";

type SubscriptionEvent = {
  id: string;
  tenant_id: string | null;
  actor_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
  tenants?: {
    name?: string | null;
  } | null;
};

export default function PlatformAuditLogs() {
  const [search, setSearch] = useState("");

  const auditQ = useQuery({
    queryKey: ["platform-audit-logs"],
    queryFn: async (): Promise<SubscriptionEvent[]> => {
      const { data, error } = await (supabase as any)
        .from("subscription_events")
        .select(
          `
          id,
          tenant_id,
          actor_id,
          event_type,
          title,
          description,
          metadata,
          created_at,
          tenants (
            name
          )
        `,
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (auditQ.data ?? []).filter((row) => {
      if (!q) return true;

      return (
        row.title?.toLowerCase().includes(q) ||
        row.description?.toLowerCase().includes(q) ||
        row.event_type?.toLowerCase().includes(q) ||
        row.tenants?.name?.toLowerCase().includes(q) ||
        row.tenant_id?.toLowerCase().includes(q) ||
        row.actor_id?.toLowerCase().includes(q)
      );
    });
  }, [auditQ.data, search]);

  const stats = useMemo(() => {
    const all = auditQ.data ?? [];

    return {
      total: all.length,
      paymentEvents: all.filter((row) => row.event_type.includes("payment"))
        .length,
      trialEvents: all.filter((row) => row.event_type.includes("trial")).length,
      workspaceEvents: all.filter(
        (row) =>
          row.event_type.includes("workspace") ||
          row.event_type.includes("activation"),
      ).length,
    };
  }, [auditQ.data]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Platform Security"
        title="Audit Logs"
        description="Review platform-level commercial, billing, trial and workspace lifecycle events across the ShopCore Cloud Platform."
        actions={
          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            onClick={() => {
              auditQ.refetch();
              toast.info("Refreshing audit logs...");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-1">
        <PlatformKpiCard
          icon={<Activity className="h-6 w-6" />}
          label="Total Events"
          value={stats.total.toLocaleString()}
          tone="blue"
        />
        <PlatformKpiCard
          icon={<Database className="h-6 w-6" />}
          label="Payment Events"
          value={stats.paymentEvents.toLocaleString()}
          tone="emerald"
        />
        <PlatformKpiCard
          icon={<Users className="h-6 w-6" />}
          label="Trial Events"
          value={stats.trialEvents.toLocaleString()}
          tone="orange"
        />
        <PlatformKpiCard
          icon={<ShieldCheck className="h-6 w-6" />}
          label="Workspace Events"
          value={stats.workspaceEvents.toLocaleString()}
          tone="violet"
        />
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <PlatformSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search audit title, event type, workspace, tenant ID, actor ID..."
          />
        </div>

        {auditQ.isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            Loading audit logs...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            No audit logs found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Workspace</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Metadata</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">{row.title}</p>
                      <p className="mt-1 max-w-[360px] text-xs font-medium leading-5 text-slate-500">
                        {row.description || "No description"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <PlatformStatusBadge status={row.event_type} />
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-700">
                        {row.tenants?.name || "Unknown workspace"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.tenant_id || "No tenant"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="max-w-[180px] truncate text-xs font-bold text-slate-500">
                        {row.actor_id || "System"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "—"}
                    </td>

                    <td className="px-4 py-4">
                      <pre className="max-w-[260px] overflow-hidden rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-500">
                        {JSON.stringify(row.metadata || {}, null, 2)}
                      </pre>
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