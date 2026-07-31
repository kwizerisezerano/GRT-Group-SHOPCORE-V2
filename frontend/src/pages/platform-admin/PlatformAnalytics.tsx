import {
  AlertTriangle,
  BarChart3,
  Building2,
  CreditCard,
  Headphones,
  LineChart,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DataPanel,
  MetricCard,
  PageShell,
  money,
  usePlatformQuery,
} from "./PlatformOperationsSuite";

export default function PlatformAnalytics() {
  const analyticsQ = usePlatformQuery({
    key: "platform-analytics-suite",
    query: async () => {
      const [summaryRes, tenantsRes, paymentsRes, healthRes, supportRes] =
        await Promise.all([
          (supabase as any)
            .from("platform_analytics_summary")
            .select("*")
            .maybeSingle(),

          (supabase as any)
            .from("tenants")
            .select("id, name, created_at, workspace_status, payment_status")
            .order("created_at", { ascending: false })
            .limit(10),

          (supabase as any)
            .from("subscription_payments")
            .select("id, amount, payment_status, created_at")
            .order("created_at", { ascending: false })
            .limit(100),

          (supabase as any)
            .from("platform_tenant_health_scores")
            .select("*")
            .order("health_score", { ascending: true })
            .limit(8),

          (supabase as any)
            .from("platform_support_tickets")
            .select("id, status, priority, created_at")
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

      return {
        summary: summaryRes.error ? {} : summaryRes.data ?? {},
        tenants: tenantsRes.error ? [] : tenantsRes.data ?? [],
        payments: paymentsRes.error ? [] : paymentsRes.data ?? [],
        health: healthRes.error ? [] : healthRes.data ?? [],
        support: supportRes.error ? [] : supportRes.data ?? [],
      };
    },
  });

  const data = analyticsQ.data ?? {
    summary: {},
    tenants: [],
    payments: [],
    health: [],
    support: [],
  };

  const summary: any = data.summary ?? {};

  const paidPayments = data.payments.filter(
    (payment: any) => payment.payment_status === "paid",
  );

  const failedPayments = data.payments.filter(
    (payment: any) => payment.payment_status === "failed",
  );

  const openSupport = data.support.filter(
    (ticket: any) => !["closed", "resolved"].includes(ticket.status),
  );

  const urgentSupport = data.support.filter(
    (ticket: any) => ticket.priority === "urgent",
  );

  const healthBreakdown = data.health.reduce(
    (acc: Record<string, number>, item: any) => {
      const key = item.health_status || "healthy";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <PageShell
      eyebrow="Platform Intelligence"
      title="Analytics Center"
      description="Analyze platform growth, revenue, tenant health, support workload, subscription performance, payment risk, and operational adoption."
      icon={<BarChart3 className="h-7 w-7" />}
      onRefresh={() => analyticsQ.refetch()}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Tenants"
          value={summary.total_tenants ?? data.tenants.length}
        />

        <MetricCard
          label="Active Tenants"
          value={summary.active_tenants ?? 0}
          tone="emerald"
        />

        <MetricCard
          label="Monthly Revenue"
          value={money(Number(summary.monthly_revenue || 0))}
          tone="violet"
        />

        <MetricCard
          label="Tenant Risks"
          value={summary.tenant_risks ?? 0}
          tone="orange"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Lifetime Revenue"
          value={money(Number(summary.lifetime_revenue || 0))}
          tone="blue"
        />

        <MetricCard
          label="Open Support"
          value={summary.open_support_tickets ?? openSupport.length}
          tone="rose"
        />

        <MetricCard
          label="Failed Payments"
          value={summary.failed_payment_attempts ?? failedPayments.length}
          tone="orange"
        />

        <MetricCard
          label="Workspace Requests"
          value={summary.open_workspace_requests ?? 0}
          tone="cyan"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <DataPanel title="Growth Summary">
          <InsightCard
            icon={<Building2 className="h-5 w-5" />}
            title="Tenant Growth"
            text={`${summary.total_tenants ?? data.tenants.length} total tenant records are currently tracked across the platform.`}
            tone="blue"
          />

          <InsightCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Activation"
            text={`${summary.active_tenants ?? 0} tenant workspace(s) are active. ${summary.suspended_tenants ?? 0} workspace(s) are suspended.`}
            tone="emerald"
          />
        </DataPanel>

        <DataPanel title="Revenue Intelligence">
          <InsightCard
            icon={<WalletCards className="h-5 w-5" />}
            title="Revenue Position"
            text={`${money(Number(summary.lifetime_revenue || 0))} lifetime revenue and ${money(Number(summary.monthly_revenue || 0))} this month.`}
            tone="violet"
          />

          <InsightCard
            icon={<CreditCard className="h-5 w-5" />}
            title="Payment Risk"
            text={`${summary.failed_payment_attempts ?? failedPayments.length} failed payment attempt(s) require commercial review.`}
            tone="orange"
          />
        </DataPanel>

        <DataPanel title="Customer Health">
          <InsightCard
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Risk Review"
            text={`${summary.tenant_risks ?? 0} tenant(s) are outside healthy status and need follow-up.`}
            tone="orange"
          />

          <InsightCard
            icon={<Headphones className="h-5 w-5" />}
            title="Support Workload"
            text={`${summary.open_support_tickets ?? openSupport.length} open ticket(s), including ${urgentSupport.length} urgent item(s).`}
            tone="rose"
          />
        </DataPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <DataPanel title="Tenant Health Breakdown">
          <div className="space-y-3">
            {Object.keys(healthBreakdown).length ? (
              Object.entries(healthBreakdown).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="font-black capitalize text-slate-950">
                    {status.replace(/_/g, " ")}
                  </p>

                  <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
                    {count}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                No tenant health records available yet.
              </div>
            )}
          </div>
        </DataPanel>

        <DataPanel title="Recent Tenants">
          <div className="space-y-3">
            {data.tenants.length ? (
              data.tenants.map((tenant: any) => (
                <div
                  key={tenant.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="font-black text-slate-950">
                    {tenant.name || "Tenant workspace"}
                  </p>

                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Workspace: {tenant.workspace_status || "unknown"} · Payment:{" "}
                    {tenant.payment_status || "unknown"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                No tenant records found.
              </div>
            )}
          </div>
        </DataPanel>
      </div>

      <DataPanel title="Executive Direction">
        <div className="grid gap-4 xl:grid-cols-1">
          <InsightCard
            icon={<LineChart className="h-5 w-5" />}
            title="Growth"
            text="Track tenant acquisition, activation, and expansion revenue from one command center."
            tone="blue"
          />

          <InsightCard
            icon={<WalletCards className="h-5 w-5" />}
            title="Revenue"
            text="Use payment and subscription intelligence to detect failed collections and expansion opportunities."
            tone="violet"
          />

          <InsightCard
            icon={<Headphones className="h-5 w-5" />}
            title="Support"
            text="Connect support activity with tenant health, renewal risk, and platform operations."
            tone="orange"
          />

          <InsightCard
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Risk"
            text="Prioritize at-risk tenants before churn, billing failure, or operational disruption occurs."
            tone="rose"
          />
        </div>
      </DataPanel>
    </PageShell>
  );
}

function InsightCard({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "blue" | "emerald" | "orange" | "rose" | "violet";
}) {
  const tones: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div
        className={[
          "flex h-11 w-11 items-center justify-center rounded-xl border",
          tones[tone],
        ].join(" ")}
      >
        {icon}
      </div>

      <p className="mt-4 font-black text-slate-950">{title}</p>

      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
        {text}
      </p>
    </div>
  );
}