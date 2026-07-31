import {
  AlertTriangle,
  CheckCircle2,
  Server,
  Settings,
  Wrench,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DataPanel,
  EmptyState,
  MetricCard,
  PageShell,
  StatusPill,
  usePlatformQuery,
} from "./PlatformOperationsSuite";

type InfrastructureStatus =
  | "operational"
  | "degraded"
  | "incident"
  | "maintenance";

export default function Infrastructure() {
  const infraQ = usePlatformQuery({
    key: "platform-infrastructure-suite",
    query: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_infrastructure_metrics")
        .select("*")
        .order("metric_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      metricId,
      status,
    }: {
      metricId: string;
      status: InfrastructureStatus;
    }) => {
      const { error } = await (supabase as any).rpc(
        "update_platform_infrastructure_status",
        {
          p_metric_id: metricId,
          p_status: status,
        },
      );

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      toast.success(`Infrastructure marked as ${variables.status}.`);
      await infraQ.refetch();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Infrastructure update failed."),
  });

  const metrics = infraQ.data ?? [];
  const latest = metrics[0] ?? {};

  return (
    <PageShell
      eyebrow="Operations"
      title="Infrastructure"
      description="Monitor API performance, database health, realtime connections, queues, workers, storage, and platform service status."
      icon={<Server className="h-7 w-7" />}
      onRefresh={() => infraQ.refetch()}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="API Latency"
          value={`${latest.api_latency_ms || 0}ms`}
        />
        <MetricCard
          label="API Requests"
          value={Number(latest.api_requests || 0).toLocaleString()}
          tone="violet"
        />
        <MetricCard
          label="API Failures"
          value={latest.api_failures || 0}
          tone="rose"
        />
        <MetricCard
          label="Realtime Connections"
          value={latest.realtime_connections || 0}
          tone="cyan"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="DB Connections"
          value={latest.database_connections || 0}
        />
        <MetricCard
          label="Slow Queries"
          value={latest.slow_queries || 0}
          tone="orange"
        />
        <MetricCard
          label="Queue Jobs"
          value={latest.queue_jobs || 0}
          tone="emerald"
        />
        <MetricCard
          label="Queue Failures"
          value={latest.queue_failures || 0}
          tone="rose"
        />
      </section>

      <DataPanel title="Infrastructure History">
        {infraQ.isLoading ? (
          <EmptyState text="Loading infrastructure metrics..." />
        ) : !metrics.length ? (
          <EmptyState text="No infrastructure metrics recorded yet." />
        ) : (
          <div className="space-y-3">
            {metrics.map((item: any) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">
                        {item.metric_date}
                      </p>

                      <StatusPill status={item.status} />
                    </div>

                    <p className="mt-1 text-xs font-bold text-slate-500">
                      API {Number(item.api_requests || 0).toLocaleString()} ·
                      Failures {item.api_failures || 0} · Storage{" "}
                      {item.storage_gb || 0} GB
                    </p>

                    <p className="mt-2 text-xs font-bold text-slate-500">
                      DB connections {item.database_connections || 0} · Slow
                      queries {item.slow_queries || 0} · Queue jobs{" "}
                      {item.queue_jobs || 0} · Queue failures{" "}
                      {item.queue_failures || 0}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <ActionButton
                      label="Operational"
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      tone="emerald"
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
                          metricId: item.id,
                          status: "operational",
                        })
                      }
                    />

                    <ActionButton
                      label="Degraded"
                      icon={<AlertTriangle className="h-4 w-4" />}
                      tone="orange"
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
                          metricId: item.id,
                          status: "degraded",
                        })
                      }
                    />

                    <ActionButton
                      label="Incident"
                      icon={<AlertTriangle className="h-4 w-4" />}
                      tone="rose"
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
                          metricId: item.id,
                          status: "incident",
                        })
                      }
                    />

                    <ActionButton
                      label="Maintenance"
                      icon={<Wrench className="h-4 w-4" />}
                      tone="blue"
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
                          metricId: item.id,
                          status: "maintenance",
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataPanel>
    </PageShell>
  );
}

function ActionButton({
  label,
  icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "orange" | "rose";
  disabled?: boolean;
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    rose: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60",
        tones[tone],
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}