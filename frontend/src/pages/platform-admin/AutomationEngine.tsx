import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  plan_code: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  tenants?: {
    name?: string | null;
    workspace_status?: string | null;
    payment_status?: string | null;
  } | null;
};

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  subscription_id: string | null;
  invoice_no: string | null;
  status: string;
  total: number;
  due_date: string | null;
  tenants?: {
    name?: string | null;
  } | null;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  created_at: string | null;
};

function daysUntil(date?: string | null) {
  if (!date) return null;

  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function AutomationEngine() {
  const qc = useQueryClient();

  const automationQ = useQuery({
    queryKey: ["platform-automation-engine"],
    queryFn: async () => {
      const [subscriptionsRes, invoicesRes, eventsRes] = await Promise.all([
        (supabase as any)
          .from("tenant_subscriptions")
          .select(
            `
            id,
            tenant_id,
            plan_code,
            status,
            billing_cycle,
            current_period_end,
            trial_ends_at,
            grace_period_ends_at,
            tenants (
              name,
              workspace_status,
              payment_status
            )
          `,
          )
          .order("current_period_end", { ascending: true }),

        (supabase as any)
          .from("subscription_invoices")
          .select(
            `
            id,
            tenant_id,
            subscription_id,
            invoice_no,
            status,
            total,
            due_date,
            tenants (name)
          `,
          )
          .order("due_date", { ascending: true }),

        (supabase as any)
          .from("subscription_events")
          .select("id, title, description, event_type, created_at")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      if (subscriptionsRes.error) throw subscriptionsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (eventsRes.error) throw eventsRes.error;

      return {
        subscriptions: (subscriptionsRes.data ?? []) as SubscriptionRow[],
        invoices: (invoicesRes.data ?? []) as InvoiceRow[],
        events: (eventsRes.data ?? []) as EventRow[],
      };
    },
  });

  const runAutomation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc(
        "run_subscription_automation",
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Automation cycle completed.");
      qc.invalidateQueries({ queryKey: ["platform-automation-engine"] });
      qc.invalidateQueries({ queryKey: ["platform-subscription-engine"] });
      qc.invalidateQueries({ queryKey: ["platform-engine-invoices"] });
      qc.invalidateQueries({ queryKey: ["platform-dashboard-live"] });
      qc.invalidateQueries({ queryKey: ["tenant-360"] });
    },
    onError: (error: any) =>
      toast.error(error?.message || "Automation cycle failed."),
  });

  const subscriptions = automationQ.data?.subscriptions ?? [];
  const invoices = automationQ.data?.invoices ?? [];
  const events = automationQ.data?.events ?? [];

  const metrics = useMemo(() => {
    const trialEnding = subscriptions.filter((sub) => {
      const days = daysUntil(sub.trial_ends_at);
      return sub.status === "trial" && days !== null && days <= 3 && days >= 0;
    });

    const expiredTrials = subscriptions.filter((sub) => {
      const days = daysUntil(sub.trial_ends_at);
      return sub.status === "trial" && days !== null && days < 0;
    });

    const overdueInvoices = invoices.filter((invoice) => {
      const days = daysUntil(invoice.due_date);
      return invoice.status !== "paid" && invoice.status !== "void" && days !== null && days < 0;
    });

    const gracePeriod = subscriptions.filter((sub) => sub.status === "grace");

    return {
      activeRules: 6,
      trialEnding: trialEnding.length,
      expiredTrials: expiredTrials.length,
      overdueInvoices: overdueInvoices.length,
      gracePeriod: gracePeriod.length,
    };
  }, [subscriptions, invoices]);

  const riskRows = useMemo(() => {
    return subscriptions
      .map((sub) => {
        const trialDays = daysUntil(sub.trial_ends_at);
        const periodDays = daysUntil(sub.current_period_end);

        let risk = "normal";
        let reason = "Subscription is within normal lifecycle.";

        if (sub.status === "trial" && trialDays !== null && trialDays < 0) {
          risk = "critical";
          reason = "Trial period has expired.";
        } else if (sub.status === "trial" && trialDays !== null && trialDays <= 3) {
          risk = "warning";
          reason = `Trial ends in ${trialDays} day(s).`;
        } else if (sub.status === "active" && periodDays !== null && periodDays <= 3) {
          risk = "warning";
          reason = `Billing period ends in ${periodDays} day(s).`;
        } else if (sub.status === "grace") {
          risk = "critical";
          reason = "Workspace is in grace period.";
        }

        return { ...sub, risk, reason };
      })
      .filter((row) => row.risk !== "normal");
  }, [subscriptions]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Lifecycle Operations"
        title="Automation Engine"
        description="Run and monitor subscription lifecycle automation for trials, overdue invoices, grace periods, renewals and workspace suspensions."
        actions={
          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            disabled={runAutomation.isPending}
            onClick={() => runAutomation.mutate()}
          >
            <Zap className="mr-2 h-4 w-4" />
            {runAutomation.isPending ? "Running..." : "Run Automation"}
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <PlatformKpiCard icon={<Activity className="h-6 w-6" />} label="Active Rules" value={metrics.activeRules.toLocaleString()} tone="blue" />
        <PlatformKpiCard icon={<CalendarClock className="h-6 w-6" />} label="Trials Ending" value={metrics.trialEnding.toLocaleString()} tone="orange" />
        <PlatformKpiCard icon={<Clock className="h-6 w-6" />} label="Expired Trials" value={metrics.expiredTrials.toLocaleString()} tone="rose" />
        <PlatformKpiCard icon={<AlertTriangle className="h-6 w-6" />} label="Overdue Invoices" value={metrics.overdueInvoices.toLocaleString()} tone="violet" />
        <PlatformKpiCard icon={<PauseCircle className="h-6 w-6" />} label="Grace Period" value={metrics.gracePeriod.toLocaleString()} tone="cyan" />
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Automation Rules
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950">
              Subscription Lifecycle
            </h2>
          </div>

          <Button
            variant="outline"
            className="rounded-xl font-black"
            onClick={() => {
              automationQ.refetch();
              toast.info("Refreshing automation engine...");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <RuleCard
            title="Trial Expiry"
            description="Detects trials that have ended and moves them into review or grace workflow."
            status="active"
          />
          <RuleCard
            title="Invoice Overdue"
            description="Identifies unpaid invoices past due date and prepares collection actions."
            status="active"
          />
          <RuleCard
            title="Grace Period"
            description="Tracks customers temporarily allowed to continue before suspension."
            status="active"
          />
          <RuleCard
            title="Workspace Suspension"
            description="Suspends unpaid workspaces after grace period expiration."
            status="active"
          />
          <RuleCard
            title="Renewal Window"
            description="Highlights subscriptions approaching billing renewal."
            status="active"
          />
          <RuleCard
            title="Commercial Events"
            description="Records subscription lifecycle actions into platform event history."
            status="active"
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Lifecycle Review
        </p>
        <h2 className="mt-2 text-xl font-black text-slate-950">
          Workspaces Requiring Attention
        </h2>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Workspace</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>

            <tbody>
              {riskRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">
                      {row.tenants?.name || "Unknown workspace"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {row.tenant_id}
                    </p>
                  </td>

                  <td className="px-4 py-4 capitalize">{row.plan_code}</td>

                  <td className="px-4 py-4">
                    <PlatformStatusBadge status={row.status} />
                  </td>

                  <td className="px-4 py-4">
                    <PlatformStatusBadge status={row.tenants?.payment_status} />
                  </td>

                  <td className="px-4 py-4">
                    <PlatformStatusBadge status={row.risk} />
                  </td>

                  <td className="px-4 py-4 font-bold text-slate-600">
                    {row.reason}
                  </td>
                </tr>
              ))}

              {!riskRows.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm font-bold text-slate-500"
                  >
                    No lifecycle risks detected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Automation History
        </p>
        <h2 className="mt-2 text-xl font-black text-slate-950">
          Latest Lifecycle Events
        </h2>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-sm font-black text-slate-950">
                {event.title}
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                {event.description || event.event_type}
              </p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {event.created_at
                  ? new Date(event.created_at).toLocaleString()
                  : "No date"}
              </p>
            </div>
          ))}

          {!events.length && (
            <div className="rounded-2xl border border-slate-200 p-5 text-sm font-bold text-slate-500">
              No automation events recorded.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RuleCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <PlatformStatusBadge status={status} />
      </div>

      <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}