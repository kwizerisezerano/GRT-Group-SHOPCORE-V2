import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  LineChart,
  PackageSearch,
  Target,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness, getDemoWorkflow } from "@/data/landingDemoData";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const toneIcon: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const toneDot: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  violet: "bg-blue-500",
  cyan: "bg-blue-500",
};

const toneBadge: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return fallback;
};

export default function ExecutiveIntelligenceLayer() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    executiveSignals,
    branchHealth,
  } = useLandingExperience();

  const activeBranchData =
    branchHealth.find((branch) => branch.id === activeBranch) ??
    branchHealth[0];

  const workflow = getDemoWorkflow(selectedModule) as Record<string, unknown>;

  const workflowTitle = getText(
    workflow,
    ["title", "name", "label"],
    "Operating workflow",
  );

  const workflowSignal = getText(
    workflow,
    ["signal", "status", "summary"],
    "Live workflow",
  );

  const branchName = activeBranchData?.name ?? "Active branch";
  const branchLoad = activeBranchData?.load ?? 82;

  const recommendations =
    executiveSignals.length > 0
      ? executiveSignals.map((signal, index) => ({
          title: signal.title,
          detail: signal.detail,
          action: signal.action,
          impact: index === 0 ? "High" : "Medium",
          tone: signal.tone,
          icon:
            index === 0
              ? BarChart3
              : index === 1
                ? PackageSearch
                : ClipboardCheck,
        }))
      : [
          {
            title: "Consolidate business signals",
            detail:
              "Sales, inventory, customers, warehouse movement and financial performance should remain connected.",
            action: "Review the active operating signals.",
            impact: "High",
            tone: "blue",
            icon: BarChart3,
          },
          {
            title: "Review operational risks",
            detail:
              "Stock alerts, warehouse capacity and branch activity should be reviewed together.",
            action: "Prioritize operational risks.",
            impact: "Medium",
            tone: "orange",
            icon: AlertTriangle,
          },
          {
            title: "Keep management reporting current",
            detail:
              "Executive KPIs should reflect current branch and module activity.",
            action: "Refresh executive reports.",
            impact: "High",
            tone: "emerald",
            icon: TrendingUp,
          },
        ];

  const decisionSignals = [
    {
      label: "Revenue direction",
      value: metrics.revenue,
      prefix: "RWF ",
      compact: true,
      decimals: 2,
      tone: "emerald",
    },
    {
      label: "Workflow signal",
      value: workflowSignal,
      tone: "blue",
    },
    {
      label: "Branch focus",
      value: branchName,
      tone: "violet",
    },
    {
      label: "Stock risk",
      value: metrics.stockAlerts,
      suffix: " items",
      tone: "orange",
    },
  ] satisfies Array<{
    label: string;
    value: string | number;
    prefix?: string;
    suffix?: string;
    compact?: boolean;
    decimals?: number;
    tone: Tone;
  }>;

  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
            Executive intelligence layer
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
            Turn operational data into executive decisions.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
            ShopCore translates sales, stock movement, warehouse utilization,
            customer behavior and profitability into clear business direction
            for managers and owners.
          </p>
        </div>

        <WindowFrame
          title="Executive Decision Center"
          eyebrow={`${demoBusiness.name ?? "ShopCore"} · ${selectedModule.toUpperCase()}`}
          icon={BrainCircuit}
          status={demoMode ? "Live intelligence" : "Decision-ready"}
          className="border-border bg-card"
          bodyClassName="bg-muted/80 p-4 sm:p-5"
        >
          <div className="grid gap-4 grid-cols-1">
            <StatCard
              label="Revenue signal"
              value={metrics.revenue}
              valuePrefix="RWF "
              compactValue
              valueDecimals={2}
              icon={TrendingUp}
              trend="Growing"
              trendDirection="up"
              caption="Daily performance"
            />

            <StatCard
              label="Gross margin"
              value={metrics.margin}
              valueSuffix="%"
              valueDecimals={1}
              icon={CircleDollarSign}
              trend="+3.1%"
              trendDirection="up"
              caption="Weighted margin"
            />

            <StatCard
              label="Workflow signal"
              value={workflowSignal}
              icon={AlertTriangle}
              trend="Review"
              trendDirection="neutral"
              caption={workflowTitle}
            />

            <StatCard
              label="Decision score"
              value={92}
              valueSuffix="%"
              icon={Target}
              trend={branchName}
              trendDirection="up"
              caption="Business readiness"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-1 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Executive recommendations
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900 dark:!text-blue-100">
                    Priority actions for {branchName}
                  </h3>
                </div>

                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="space-y-3">
                {recommendations.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-border bg-muted/80 p-4"
                    >
                      <div className="flex gap-3">
                        <div
                          className={[
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                            toneIcon[item.tone],
                          ].join(" ")}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-black text-foreground">
                              {item.title}
                            </p>

                            <span
                              className={[
                                "w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                                toneBadge[item.tone],
                              ].join(" ")}
                            >
                              {item.impact} impact
                            </span>
                          </div>

                          <p className="mt-2 text-xs font-medium leading-6 text-muted-foreground">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Decision signals
                    </p>
                    <p className="mt-1 text-sm font-black text-foreground">
                      Business health inputs
                    </p>
                  </div>

                  <LineChart className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-3">
                  {decisionSignals.map((signal) => (
                    <div
                      key={signal.label}
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/80 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            toneDot[signal.tone],
                          ].join(" ")}
                        />
                        <span className="text-sm font-black text-foreground">
                          {signal.label}
                        </span>
                      </div>

                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                          toneBadge[signal.tone],
                        ].join(" ")}
                      >
                        {typeof signal.value === "number" ? (
                          <AnimatedCounter
                            value={signal.value}
                            prefix={signal.prefix}
                            suffix={signal.suffix}
                            compact={signal.compact}
                            decimals={signal.decimals ?? 0}
                          />
                        ) : (
                          signal.value
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-muted p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <BarChart3 className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                      Intelligence without guesswork
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-300">
                      The decision layer now follows live metrics, executive
                      signals, active branch and the selected operating module.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-muted p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                      Management-ready reporting
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-300">
                      Owners and managers can review revenue, margin, stock risk,
                      customer growth and branch pressure in one decision
                      workspace.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Inventory risk",
                value: `${metrics.stockAlerts} alerts`,
                icon: PackageSearch,
                tone: "orange",
              },
              {
                label: "Warehouse pressure",
                value: `${branchLoad}% load`,
                icon: Warehouse,
                tone: "blue",
              },
              {
                label: "Customer value",
                value: metrics.customers,
                icon: Users,
                tone: "violet",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div
                    className={[
                      "mb-3 flex h-10 w-10 items-center justify-center text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <p className="text-sm font-black text-slate-950 dark:!text-white">
                    {typeof item.value === "number" ? (
                      <AnimatedCounter value={item.value} />
                    ) : (
                      item.value
                    )}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground dark:!text-slate-300">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </WindowFrame>
      </div>
    </section>
  );
}