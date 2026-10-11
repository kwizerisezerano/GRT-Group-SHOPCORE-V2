import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  Package,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { useBusinessScenario } from "@/contexts/BusinessScenarioContext";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";
import { PlatformSupportBanner } from "@/components/support/PlatformSupportBanner";
import AnimatedBarChart from "./live/AnimatedBarChart";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const toneMap: Record<Tone, string> = {
  blue: "bg-blue-500",
  emerald: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  violet: "bg-blue-500",
  cyan: "bg-blue-500",
};

const badgeMap: Record<Tone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const moduleDashboardText: Record<string, string> = {
  pos: "POS, payments and receipt activity are feeding the live command center.",
  inventory:
    "Inventory movements and replenishment signals are driving executive visibility.",
  warehouse:
    "Warehouse flow, transfers and receiving activity are visible across the branch network.",
  crm: "Customer activity, loyalty signals and retention data are connected to the operating view.",
  procurement:
    "Purchasing demand, supplier activity and receiving status are part of the live dashboard.",
  finance:
    "Revenue, margin, expenses and cash performance are visible from one executive layer.",
  analytics:
    "The executive layer consolidates branch, sales, stock, customer and financial performance.",
  offline:
    "Offline queue status and synchronization health are monitored from the command center.",
  ebm: "Fiscal readiness and receipt submission status are visible without blocking operations.",
  security:
    "Governance, role access and operational activity are connected to executive visibility.",
};

export default function DashboardWindow() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    activityFeed,
    branchHealth,
    chartSeries,
  } = useLandingExperience();

  const { scenario } = useBusinessScenario();

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ?? branchHealth[0];

  const branchName = branch?.name ?? scenario.branches[0] ?? "Kigali Main";

  const dashboardText =
    moduleDashboardText[String(selectedModule)] ??
    moduleDashboardText.analytics;

  const branchStatus =
    branchHealth.length > 0
      ? branchHealth.slice(0, 4).map((item) => ({
          id: item.id,
          name: item.name,
          value: item.status,
          tone: item.tone,
        }))
      : scenario.branches.slice(0, 4).map((name, index) => ({
          id: `${name}-${index}`,
          name,
          value: index === 2 ? "Syncing" : index === 3 ? "Review" : "Online",
          tone: index === 2 ? "cyan" : index === 3 ? "orange" : "emerald",
        }));

  const liveActivity =
    activityFeed.length > 0
      ? activityFeed.slice(0, 4).map((item) => ({
          id: item.id,
          title: item.title,
          meta: item.detail,
          tone: item.tone,
        }))
      : scenario.alerts.slice(0, 4).map((alert, index) => ({
          id: `${alert}-${index}`,
          title: alert,
          meta: `${branchName} · ${scenario.workflow[index] ?? "Operating update"}`,
          tone: index === 0 ? "emerald" : index === 1 ? "orange" : "cyan",
        }));

  const summaryTiles = [
    {
      label: "Gross margin",
      value: metrics.margin,
      icon: TrendingUp,
      tone: "emerald",
      suffix: "%",
      decimals: 1,
    },
    {
      label: "Cash collected",
      value: metrics.cashCollected,
      icon: CreditCard,
      tone: "blue",
      prefix: "RWF ",
      compact: true,
      decimals: 2,
    },
    {
      label: "Fiscal receipts",
      value: metrics.receipts,
      icon: ReceiptText,
      tone: "cyan",
    },
  ] satisfies Array<{
    label: string;
    value: number;
    icon: React.ElementType;
    tone: Tone;
    prefix?: string;
    suffix?: string;
    compact?: boolean;
    decimals?: number;
  }>;

  return (
    <WindowFrame
      title="Executive Command Center"
      eyebrow={`${branchName} · ${scenario.name}`}
      icon={BarChart3}
      status={demoMode ? "Live operations" : "Ready"}
      statusTone="blue"
      className="w-full"
      bodyClassName="bg-muted/70 p-4 sm:p-5"
    >
        <PlatformSupportBanner />
      <div className="mb-4 grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="rounded-2xl border border-border bg-muted px-4 py-3">
          <p className="text-xs font-bold leading-5 text-foreground">
            {dashboardText}
          </p>
        </div>

        <div className="hidden rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-sm xl:block">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Scenario
          </p>
          <p className="text-sm font-black text-foreground">
            {scenario.businessName}
          </p>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1">
        <StatCard
          label={scenario.revenueLabel}
          value={metrics.revenue}
          valuePrefix="RWF "
          compactValue
          valueDecimals={2}
          icon={TrendingUp}
          trend="+18.6%"
          trendDirection="up"
          caption={`Across ${branchStatus.length || 4} active branches`}
        />

        <StatCard
          label="Orders"
          value={metrics.orders}
          icon={ShoppingCart}
          trend="+142"
          trendDirection="up"
          caption="POS and retail counters"
        />

        <StatCard
          label="Stock alerts"
          value={metrics.stockAlerts}
          icon={Package}
          trend="Review"
          trendDirection="neutral"
          caption={scenario.inventoryFocus}
        />

        <StatCard
          label={scenario.customersLabel}
          value={metrics.customers}
          icon={Users}
          trend="+4.8%"
          trendDirection="up"
          caption="CRM and loyalty records"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Performance flow
              </p>
              <h4 className="mt-1 text-lg font-black text-slate-900 dark:!text-blue-100">
                Revenue and operating movement
              </h4>
            </div>

            <div className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground">
              <AnimatedCounter value={metrics.margin} decimals={1} suffix="% margin" />
            </div>
          </div>

          <AnimatedBarChart values={chartSeries} heightClassName="h-48" />

          <div className="mt-4 grid gap-3 grid-cols-1">
            {summaryTiles.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-muted/80 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center text-foreground">
                      <Icon className="h-4 w-4" />
                    </span>

                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                  </div>

                  <p className="text-sm font-black text-foreground">
                    <AnimatedCounter
                      value={item.value}
                      prefix={item.prefix}
                      suffix={item.suffix}
                      compact={item.compact}
                      decimals={item.decimals ?? 0}
                    />
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Branch network
                </p>
                <h4 className="mt-1 text-sm font-black text-foreground">
                  {branchStatus.length} locations monitored
                </h4>
              </div>

              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-2.5">
              {branchStatus.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/80 px-3 py-2.5"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className={[
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        toneMap[item.tone as Tone],
                      ].join(" ")}
                    />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {item.name}
                    </span>
                  </div>

                  <span
                    className={[
                      "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                      badgeMap[item.tone as Tone],
                    ].join(" ")}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Live activity
                </p>
                <h4 className="mt-1 text-sm font-black text-foreground">
                  Operating timeline
                </h4>
              </div>

              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {liveActivity.map((item, index) => (
                <div key={`${item.id}-${index}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={[
                        "mt-1 h-2.5 w-2.5 rounded-full",
                        toneMap[item.tone as Tone],
                      ].join(" ")}
                    />
                    {index < liveActivity.length - 1 ? (
                      <span className="mt-1 h-full w-px bg-border" />
                    ) : null}
                  </div>

                  <div className="min-w-0 pb-2">
                    <p className="truncate text-sm font-bold text-slate-900 dark:!text-blue-100">
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {item.meta}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/80 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center text-foreground">
                <Wifi className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                  Synchronization layer active
                </p>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-200">
                  Offline queue clear · fiscal queue healthy
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}