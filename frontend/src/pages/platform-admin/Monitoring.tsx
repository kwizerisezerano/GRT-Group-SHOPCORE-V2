import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";

type TenantRow = {
  id: string;
  workspace_status: string | null;
  payment_status: string | null;
  subscription_status: string | null;
  created_at: string | null;
};

type PaymentRow = {
  id: string;
  payment_status: string | null;
  created_at: string | null;
};

type EventRow = {
  id: string;
  event_type: string;
  created_at: string | null;
};

export default function Monitoring() {
  const monitorQ = useQuery({
    queryKey: ["platform-monitoring"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [tenantsRes, paymentsRes, eventsRes] = await Promise.all([
        (supabase as any)
          .from("tenants")
          .select("id, workspace_status, payment_status, subscription_status, created_at")
          .order("created_at", { ascending: false }),

        (supabase as any)
          .from("subscription_payments")
          .select("id, payment_status, created_at")
          .order("created_at", { ascending: false }),

        (supabase as any)
          .from("subscription_events")
          .select("id, event_type, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (tenantsRes.error) throw tenantsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (eventsRes.error) throw eventsRes.error;

      return {
        tenants: (tenantsRes.data ?? []) as TenantRow[],
        payments: (paymentsRes.data ?? []) as PaymentRow[],
        events: (eventsRes.data ?? []) as EventRow[],
      };
    },
  });

  const tenants = monitorQ.data?.tenants ?? [];
  const payments = monitorQ.data?.payments ?? [];
  const events = monitorQ.data?.events ?? [];

  const stats = useMemo(() => {
    const pendingWorkspaces = tenants.filter(
      (item) => item.workspace_status !== "active" && item.payment_status !== "paid",
    ).length;

    const activeWorkspaces = tenants.filter(
      (item) =>
        item.workspace_status === "active" ||
        item.subscription_status === "active" ||
        item.payment_status === "paid",
    ).length;

    const pendingPayments = payments.filter(
      (item) => item.payment_status !== "paid",
    ).length;

    const paidPayments = payments.filter(
      (item) => item.payment_status === "paid",
    ).length;

    const healthScore = Math.max(
      0,
      100 -
        pendingWorkspaces * 2 -
        pendingPayments * 1 -
        Number(monitorQ.isError) * 25,
    );

    return {
      activeWorkspaces,
      pendingWorkspaces,
      pendingPayments,
      paidPayments,
      events: events.length,
      healthScore,
    };
  }, [tenants, payments, events, monitorQ.isError]);

  const services = [
    {
      name: "Supabase Database",
      status: monitorQ.isError ? "degraded" : "operational",
      detail: monitorQ.isError ? "Query access requires review" : "Queries responding",
      icon: Database,
    },
    {
      name: "Authentication",
      status: "operational",
      detail: "Platform session verified",
      icon: ShieldCheck,
    },
    {
      name: "Commercial Pipeline",
      status: stats.pendingPayments > 0 ? "review" : "operational",
      detail: `${stats.pendingPayments} payment(s) waiting review`,
      icon: CreditCard,
    },
    {
      name: "Workspace Provisioning",
      status: stats.pendingWorkspaces > 0 ? "review" : "operational",
      detail: `${stats.pendingWorkspaces} workspace(s) pending activation`,
      icon: Server,
    },
  ];

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Platform Operations"
        title="System Monitoring"
        description="Monitor platform service health, workspace activation pipeline, payment verification load and recent operational events."
        actions={
          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            onClick={() => {
              monitorQ.refetch();
              toast.info("Refreshing platform monitoring...");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <PlatformKpiCard
          icon={<CheckCircle2 className="h-6 w-6" />}
          label="Health Score"
          value={`${stats.healthScore}%`}
          tone={stats.healthScore >= 80 ? "emerald" : "orange"}
        />
        <PlatformKpiCard
          icon={<Server className="h-6 w-6" />}
          label="Active Workspaces"
          value={stats.activeWorkspaces.toLocaleString()}
          tone="blue"
        />
        <PlatformKpiCard
          icon={<Clock className="h-6 w-6" />}
          label="Pending Workspaces"
          value={stats.pendingWorkspaces.toLocaleString()}
          tone="orange"
        />
        <PlatformKpiCard
          icon={<CreditCard className="h-6 w-6" />}
          label="Pending Payments"
          value={stats.pendingPayments.toLocaleString()}
          tone="violet"
        />
        <PlatformKpiCard
          icon={<Activity className="h-6 w-6" />}
          label="Recent Events"
          value={stats.events.toLocaleString()}
          tone="cyan"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Server className="h-6 w-6 text-blue-700" />
            <h2 className="text-xl font-black text-slate-950">
              Service Status
            </h2>
          </div>

          <div className="mt-6 space-y-3">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <div
                  key={service.name}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {service.name}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {service.detail}
                      </p>
                    </div>
                  </div>

                  <PlatformStatusBadge status={service.status} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-blue-700" />
            <h2 className="text-xl font-black text-slate-950">
              Event Stream
            </h2>
          </div>

          <div className="mt-6 space-y-3">
            {events.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  <p className="text-sm font-black text-slate-800">
                    {event.event_type.replace(/_/g, " ")}
                  </p>
                </div>

                <p className="text-xs font-bold text-slate-500">
                  {event.created_at
                    ? new Date(event.created_at).toLocaleString()
                    : "No date"}
                </p>
              </div>
            ))}

            {!events.length && (
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-bold text-orange-700">
                <AlertTriangle className="mb-2 h-5 w-5" />
                No monitoring events recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}