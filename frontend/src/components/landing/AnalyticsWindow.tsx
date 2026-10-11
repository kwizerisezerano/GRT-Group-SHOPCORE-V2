import {
  AreaChart,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  LineChart,
  PieChart,
  TrendingUp,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";
import AnimatedBarChart from "./live/AnimatedBarChart";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const baseReportRows = [
  { label: "Daily sales summary", value: "Ready", tone: "emerald" },
  { label: "Profit and loss", value: "Updated", tone: "blue" },
  { label: "Inventory valuation", value: "Live", tone: "cyan" },
  { label: "Branch comparison", value: "Review", tone: "blue" },
] satisfies Array<{
  label: string;
  value: string;
  tone: Tone;
}>;

const toneMap: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  cyan: "bg-blue-500",
  orange: "bg-blue-500",
  violet: "bg-blue-500",
  rose: "bg-blue-500",
};

const badgeMap: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
};

const moduleAnalyticsText: Record<string, string> = {
  pos: "Checkout performance flows into revenue, margin and branch reporting.",
  inventory:
    "Stock movement and valuation become part of the executive analytics layer.",
  warehouse:
    "Warehouse transfers, capacity and receiving activity strengthen operational reporting.",
  crm: "Customer behavior, loyalty and credit activity support growth intelligence.",
  procurement:
    "Purchasing, receiving and supplier activity contribute to cost and stock analytics.",
  finance:
    "Profit, expenses, margin and cash performance remain visible in one reporting center.",
  analytics:
    "Sales, inventory, profit, expenses, customers and branches become one reporting layer.",
  offline:
    "Offline queue and synchronization status remain visible to operational reporting.",
  ebm: "Fiscal readiness and receipt submission signals remain visible in reporting.",
  security:
    "Access, governance and operational activity support accountable business reporting.",
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (Array.isArray(value)) return value;
  }

  return [];
};

export default function AnalyticsWindow() {
  const { selectedModule, demoMode, metrics, chartSeries } =
    useLandingExperience();

  const branches = getArray(demoBusiness, ["branches"]);
  const reports = getArray(demoBusiness, ["reports"]);

  const reportRows =
    reports.length > 0
      ? reports.slice(0, 4).map((report, index) => ({
          label:
            typeof report === "string"
              ? report
              : ((report as Record<string, unknown>).label as string) ||
                ((report as Record<string, unknown>).name as string) ||
                baseReportRows[index]?.label ||
                `Report ${index + 1}`,
          value: baseReportRows[index]?.value ?? "Ready",
          tone: baseReportRows[index]?.tone ?? "blue",
        }))
      : baseReportRows;

  const reportCount = reports.length || 24;

  const summaryTiles = [
    {
      label: "Revenue",
      value: metrics.revenue,
      icon: LineChart,
      tone: "blue",
      prefix: "RWF ",
      compact: true,
      decimals: 2,
    },
    {
      label: "Profit",
      value: metrics.profit,
      icon: TrendingUp,
      tone: "emerald",
      prefix: "RWF ",
      compact: true,
      decimals: 2,
    },
    {
      label: "Stock value",
      value: metrics.inventoryValue,
      icon: PieChart,
      tone: "violet",
      prefix: "RWF ",
      compact: true,
      decimals: 2,
    },
  ] satisfies Array<{
    label: string;
    value: number;
    icon: React.ElementType;
    tone: Tone;
    prefix?: string;
    compact?: boolean;
    decimals?: number;
  }>;

  const analyticsText =
    moduleAnalyticsText[String(selectedModule)] ?? moduleAnalyticsText.analytics;

  return (
    <WindowFrame
      title="Business Intelligence"
      eyebrow={`${branches.length || 4} branches · Reports and analytics`}
      icon={BarChart3}
      status={demoMode ? "Live KPIs" : "Ready"}
      bodyClassName="bg-muted/70 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Net profit"
          value={metrics.profit}
          valuePrefix="RWF "
          compactValue
          valueDecimals={2}
          icon={CircleDollarSign}
          trend="+14.8%"
          trendDirection="up"
          caption="Today"
        />

        <StatCard
          label="Margin"
          value={metrics.margin}
          valueSuffix="%"
          valueDecimals={1}
          icon={TrendingUp}
          trend="+3.1%"
          trendDirection="up"
          caption="Weighted average"
        />

        <StatCard
          label="Reports"
          value={reportCount}
          icon={CalendarDays}
          trend="Scheduled"
          trendDirection="neutral"
          caption="Operational reports"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Performance analytics
              </p>
              <h4 className="mt-1 text-sm font-black text-foreground">
                Revenue, margin and stock movement
              </h4>
            </div>

            <AreaChart className="h-5 w-5 text-muted-foreground" />
          </div>

          <AnimatedBarChart
            values={chartSeries}
            heightClassName="h-56"
            barClassName="bg-violet-600"
          />

          <div className="mt-4 grid grid-cols-3 gap-3">
            {summaryTiles.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-muted/70 p-3"
                >
                  <span
                    className={[
                      "mb-2 flex h-7 w-7 items-center justify-center rounded-lg text-white",
                      toneMap[item.tone],
                    ].join(" ")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>

                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>

                  <p className="mt-1 text-sm font-black text-foreground">
                    <AnimatedCounter
                      value={item.value}
                      prefix={item.prefix}
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
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Reporting center
            </p>
            <h4 className="mt-1 text-sm font-black text-slate-950">
              Business reports
            </h4>
          </div>

          <div className="space-y-2.5">
            {reportRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/80 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "h-2.5 w-2.5 rounded-full",
                      toneMap[row.tone as Tone],
                    ].join(" ")}
                  />
                  <span className="text-sm font-bold text-slate-900 dark:!text-blue-100">
                    {row.label}
                  </span>
                </div>

                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                    badgeMap[row.tone as Tone],
                  ].join(" ")}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
            <p className="text-sm font-black text-blue-950 dark:text-blue-100">
              Decisions backed by clean numbers
            </p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
              {analyticsText}
            </p>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}