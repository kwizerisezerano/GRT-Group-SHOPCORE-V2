import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Cloud,
  CreditCard,
  Database,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";
import AnimatedBarChart from "./live/AnimatedBarChart";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const toneDot: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  cyan: "bg-blue-500",
  orange: "bg-blue-500",
  violet: "bg-blue-500",
  rose: "bg-blue-500",
};

const toneBadge: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
};

const toneIcon: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
};

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return fallback;
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) return value;
  }

  return [];
};

export default function CommandCenter() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    activityFeed,
    branchHealth,
    chartSeries,
  } = useLandingExperience();

  const branches = getArray(demoBusiness, ["branches"]);
  const warehouses = getArray(demoBusiness, ["warehouses"]);

  const activeBranchRecord =
    branches.find((item) => getText(item, ["id", "key"], "") === activeBranch) ??
    branches[0];

  const activeBranchName = getText(
    activeBranchRecord,
    ["name", "label", "title"],
    "Kigali Main",
  );

  const liveEvents =
    activityFeed.length > 0
      ? activityFeed.slice(0, 4).map((event, index) => ({
          title: event.title,
          detail: event.detail,
          time:
            index === 0
              ? "now"
              : ["2 min ago", "7 min ago", "11 min ago", "18 min ago"][index] ??
                "now",
          tone: event.tone,
        }))
      : [
          {
            title: "Sale completed",
            detail: `SC-1048 · ${activeBranchName} · RWF 204,376`,
            time: "2 min ago",
            tone: "emerald",
          },
          {
            title: "Stock transfer approved",
            detail: "Central Warehouse → Remera · 42 items",
            time: "7 min ago",
            tone: "blue",
          },
          {
            title: "Low stock review",
            detail: "Rice 25kg · reorder threshold reached",
            time: "11 min ago",
            tone: "orange",
          },
          {
            title: "Fiscal queue verified",
            detail: "EBM receipts ready for configured tenants",
            time: "18 min ago",
            tone: "violet",
          },
        ];

  const operations = [
    {
      label: "POS Counters",
      value: selectedModule === "pos" ? "Live focus" : "42 active",
      icon: ShoppingCart,
      tone: "blue",
    },
    {
      label: "Warehouses",
      value: `${warehouses.length || 9} monitored`,
      icon: Warehouse,
      tone: "emerald",
    },
    {
      label: "Sync Layer",
      value: demoMode ? "Live" : "Healthy",
      icon: Cloud,
      tone: "cyan",
    },
    {
      label: "Access Control",
      value: selectedModule === "security" ? "Active focus" : "Protected",
      icon: ShieldCheck,
      tone: "violet",
    },
  ] satisfies Array<{
    label: string;
    value: string;
    icon: React.ElementType;
    tone: Tone;
  }>;

  const summaryMetrics = [
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
      tone: "violet",
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
    <section
      id="command-center"
      className="relative overflow-hidden bg-background py-20 sm:py-28"
    >

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
            Executive command center
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
            A live control room for the entire retail business.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
            Monitor sales, inventory, warehouses, branches, customers, fiscal
            queues, synchronization and security from one operational workspace.
          </p>
        </div>

        <WindowFrame
          title="Enterprise Command Center"
          eyebrow={`${activeBranchName} · Live business operating layer`}
          icon={BarChart3}
          status={demoMode ? "Live" : "Ready"}
          statusTone="blue"
          className="border-border bg-card"
          bodyClassName="bg-muted/80 p-4 sm:p-5"
        >
          <div className="grid gap-4 grid-cols-1">
            <StatCard
              label="Revenue today"
              value={metrics.revenue}
              valuePrefix="RWF "
              compactValue
              valueDecimals={2}
              icon={TrendingUp}
              trend="+18.6%"
              trendDirection="up"
              caption="Across active branches"
            />

            <StatCard
              label="Orders"
              value={metrics.orders}
              icon={ShoppingCart}
              trend="+142"
              trendDirection="up"
              caption="POS and sales desk"
            />

            <StatCard
              label="Stock alerts"
              value={metrics.stockAlerts}
              icon={AlertTriangle}
              trend="Review"
              trendDirection="neutral"
              caption="Replenishment needed"
            />

            <StatCard
              label="Customers"
              value={metrics.customers}
              icon={Users}
              trend="+4.8%"
              trendDirection="up"
              caption="CRM and loyalty"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-1 xl:grid-cols-[1.35fr_0.8fr_0.85fr]">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Business performance
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900 dark:!text-blue-100">
                    Revenue, margin and order velocity
                  </h3>
                </div>

                <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-black text-foreground">
                  +24.3% margin
                </span>
              </div>

              <AnimatedBarChart values={chartSeries} heightClassName="h-64" />

              <div className="mt-4 grid gap-3 grid-cols-1">
                {summaryMetrics.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-xl border border-border bg-muted/80 p-3"
                    >
                      <div className="mb-2 flex h-8 w-8 items-center justify-center text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>

                      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </p>

                      <p className="mt-1 text-sm font-black text-foreground">
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

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Live activity
                  </p>
                  <h3 className="mt-1 text-sm font-black text-foreground">
                    Operations timeline
                  </h3>
                </div>

                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="space-y-3">
                {liveEvents.map((event) => (
                  <div key={`${event.title}-${event.time}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={[
                          "mt-1 h-2.5 w-2.5 rounded-full",
                          toneDot[event.tone as Tone],
                        ].join(" ")}
                      />
                      <span className="mt-1 h-full w-px bg-border" />
                    </div>

                    <div className="pb-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-foreground">
                          {event.title}
                        </p>
                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                            toneBadge[event.tone as Tone],
                          ].join(" ")}
                        >
                          {event.time}
                        </span>
                      </div>

                      <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                        {event.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      Branch health
                    </p>
                    <h3 className="mt-1 text-sm font-black text-foreground">
                      Connected locations
                    </h3>
                  </div>

                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-3">
                  {branchHealth.slice(0, 4).map((branch) => (
                    <div
                      key={branch.id}
                      className="rounded-xl border border-border bg-muted/80 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "h-2.5 w-2.5 rounded-full",
                              toneDot[branch.tone],
                            ].join(" ")}
                          />
                          <span className="text-sm font-black text-foreground">
                            {branch.name}
                          </span>
                        </div>

                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                            toneBadge[branch.tone],
                          ].join(" ")}
                        >
                          {branch.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                          <div
                            className={[
                              "h-full rounded-full transition-all duration-700",
                              toneDot[branch.tone],
                            ].join(" ")}
                            style={{ width: `${branch.load}%` }}
                          />
                        </div>

                        <span className="text-xs font-black text-muted-foreground">
                          {branch.load}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center text-foreground">
                    <RefreshCcw className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                      Synchronization layer healthy
                    </p>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
                      Offline queue clear, cloud session valid, branch updates
                      flowing normally.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {operations.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "flex h-10 w-10 items-center justify-center text-foreground",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-black text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.value}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-muted p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center text-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                    Operating layer connected
                  </p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-300">
                    POS, inventory, warehouses, CRM, reports, offline queue,
                    fiscal workflow and security controls work as one system.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-card px-3 py-1.5 text-xs font-black text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                <Database className="h-3.5 w-3.5" />
                Enterprise-ready
              </div>
            </div>
          </div>
        </WindowFrame>
      </div>
    </section>
  );
}