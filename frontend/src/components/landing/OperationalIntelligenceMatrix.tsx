import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Cloud,
  Database,
  FileCheck2,
  Lightbulb,
  Package,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { getDemoWorkflow } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";
import AnimatedBarChart from "./live/AnimatedBarChart";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const matrixModules = [
  { id: "pos", label: "POS", icon: ShoppingCart, tone: "blue", x: "12%", y: "42%" },
  { id: "inventory", label: "Inventory", icon: Package, tone: "blue", x: "28%", y: "22%" },
  { id: "warehouse", label: "Warehouse", icon: Warehouse, tone: "blue", x: "28%", y: "66%" },
  { id: "procurement", label: "Purchasing", icon: Truck, tone: "blue", x: "48%", y: "18%" },
  { id: "crm", label: "CRM", icon: Users, tone: "blue", x: "48%", y: "72%" },
  { id: "finance", label: "Finance", icon: CircleDollarSign, tone: "blue", x: "67%", y: "32%" },
  { id: "analytics", label: "Analytics", icon: BarChart3, tone: "blue", x: "72%", y: "58%" },
  { id: "offline", label: "Offline", icon: Database, tone: "blue", x: "87%", y: "26%" },
  { id: "ebm", label: "EBM", icon: ReceiptText, tone: "blue", x: "87%", y: "50%" },
  { id: "security", label: "Security", icon: ShieldCheck, tone: "blue", x: "87%", y: "74%" },
] satisfies Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  tone: Tone;
  x: string;
  y: string;
}>;

const moduleRelations: Record<string, string[]> = {
  pos: ["inventory", "crm", "finance", "analytics", "ebm", "offline"],
  inventory: ["pos", "warehouse", "procurement", "analytics", "offline"],
  warehouse: ["inventory", "procurement", "analytics", "offline"],
  crm: ["pos", "finance", "analytics"],
  procurement: ["inventory", "warehouse", "finance", "analytics"],
  finance: ["pos", "procurement", "analytics"],
  analytics: ["pos", "inventory", "warehouse", "crm", "finance"],
  offline: ["pos", "inventory", "warehouse", "ebm"],
  ebm: ["pos", "finance", "offline"],
  security: ["pos", "inventory", "warehouse", "crm", "finance", "analytics"],
};

const toneClasses: Record<Tone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const dotClasses: Record<Tone, string> = {
  blue: "bg-blue-600",
  emerald: "bg-blue-600",
  orange: "bg-blue-600",
  rose: "bg-blue-600",
  violet: "bg-blue-600",
  cyan: "bg-blue-600",
};

function isConnected(selectedModule: string, moduleId: string) {
  if (selectedModule === moduleId) return true;
  return moduleRelations[selectedModule]?.includes(moduleId) ?? false;
}

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

export default function OperationalIntelligenceMatrix() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    activityFeed,
    chartSeries,
    branchHealth,
    executiveSignals,
  } = useLandingExperience();

  const workflow = getDemoWorkflow(selectedModule) as Record<string, unknown>;

  const selected =
    matrixModules.find((module) => module.id === selectedModule) ??
    matrixModules[0];

  const selectedModuleName = selected.label;

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ?? branchHealth[0];

  const branchName = branch?.name ?? "Active branch";

  const workflowSteps = getArray(workflow, ["steps", "flow", "actions"]).map(
    (item) => String(item),
  );

  const workflowRecommendation = getText(
    workflow,
    ["recommendation", "action", "summary"],
    executiveSignals[0]?.action ??
      "Review the active operating signals and prioritize the highest-impact workflow.",
  );

  const signal = executiveSignals[0];

  const SelectedIcon = selected.icon;
  const connectedCount = moduleRelations[selected.id]?.length ?? 0;

  const operatingStats = [
    {
      label: "Data flow",
      value: demoMode ? "Live" : "Ready",
      icon: RefreshCcw,
    },
    {
      label: "Branch context",
      value: branchName,
      icon: Building2,
    },
    {
      label: "Live events",
      value: String(activityFeed.length || 8),
      icon: Activity,
    },
  ];

  const operatingLayers = [
    {
      label: "Revenue layer",
      value: `RWF ${(metrics.revenue / 1_000_000).toFixed(2)}M`,
      tone: "blue",
    },
    {
      label: "Stock layer",
      value: `${metrics.stockAlerts} stock alerts`,
      tone: "emerald",
    },
    {
      label: "Continuity layer",
      value: `${metrics.offlineQueue} queued`,
      tone: "cyan",
    },
    {
      label: "Control layer",
      value: `${metrics.receipts} receipts`,
      tone: "violet",
    },
  ] satisfies Array<{
    label: string;
    value: string;
    tone: Tone;
  }>;

  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
            Operational intelligence matrix
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
            See how every business operation powers the next.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
            The matrix responds to live metrics, selected module, branch context
            and operating events from the shared business engine.
          </p>
        </div>

        <WindowFrame
          title="Retail Intelligence Matrix"
          eyebrow={`${branchName} · ${selectedModuleName}`}
          icon={Activity}
          status={`${connectedCount} active links`}
          statusTone="cyan"
          className="border-border bg-card"
          bodyClassName="bg-muted/80 p-4 sm:p-5"
        >
          <div className="grid gap-4 xl:grid-cols-[1.22fr_0.78fr]">
            <div className="relative min-h-[620px] overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-inner">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.16),transparent_38%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:100%_100%,42px_42px,42px_42px]" />

              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {matrixModules
                  .filter((module) => module.id !== selected.id)
                  .map((module) => {
                    const active = isConnected(selected.id, module.id);
                    const x1 = Number(selected.x.replace("%", ""));
                    const y1 = Number(selected.y.replace("%", ""));
                    const x2 = Number(module.x.replace("%", ""));
                    const y2 = Number(module.y.replace("%", ""));

                    return (
                      <line
                        key={`${selected.id}-${module.id}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={
                          active
                            ? "rgba(34,211,238,0.72)"
                            : "rgba(148,163,184,0.16)"
                        }
                        strokeWidth={active ? 0.42 : 0.18}
                        strokeDasharray={active ? "1.4 1.2" : "0"}
                      />
                    );
                  })}
              </svg>

              <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-3xl border border-blue-300/40 bg-blue-400/10 px-5 py-4 text-blue-100 shadow-[0_0_80px_rgba(59,130,246,0.16)] backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center text-foreground">
                  <Activity className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm font-black text-white">ShopCore OS</p>
                  <p className="text-xs font-bold text-blue-200">
                    Central operating layer
                  </p>
                </div>
              </div>

              {matrixModules.map((module) => {
                const Icon = module.icon;
                const active = module.id === selected.id;
                const connected = isConnected(selected.id, module.id);

                return (
                  <div
                    key={module.id}
                    className={[
                      "absolute z-20 w-[148px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-3 backdrop-blur transition-all duration-300",
                      active
                        ? "scale-110 border-blue-300 bg-blue-300/15 shadow-[0_0_70px_rgba(59,130,246,0.28)]"
                        : connected
                          ? "border-border bg-muted/10 opacity-100"
                          : "border-border bg-muted/[0.04] opacity-45",
                    ].join(" ")}
                    style={{ left: module.x, top: module.y }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          "flex h-9 w-9 items-center justify-center rounded-xl border",
                          active || connected
                            ? toneClasses[module.tone]
                            : "border-border bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-foreground">
                          {module.label}
                        </p>

                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={[
                              "h-1.5 w-1.5 rounded-full",
                              active || connected
                                ? dotClasses[module.tone]
                                : "bg-muted-foreground",
                            ].join(" ")}
                          />
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {active
                              ? "Selected"
                              : connected
                                ? "Linked"
                                : "Standby"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="absolute bottom-4 left-4 right-4 z-30 grid gap-3 sm:grid-cols-3">
                {operatingStats.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-border bg-muted/10 p-3 backdrop-blur"
                    >
                      <Icon className="mb-2 h-4 w-4 text-blue-200" />
                      <p className="text-xs font-black text-foreground">
                        {item.value}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-start gap-4">
                  <div
                    className={[
                      "flex h-14 w-14 items-center justify-center rounded-2xl border",
                      toneClasses[selected.tone],
                    ].join(" ")}
                  >
                    <SelectedIcon className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Selected operation
                    </p>
                    <h3 className="mt-1 text-2xl font-black text-slate-950 dark:!text-blue-100">
                      {selectedModuleName}
                    </h3>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-foreground" />
                    <p className="text-sm font-black text-foreground">
                      Executive recommendation
                    </p>
                  </div>

                  <p className="text-sm font-black text-blue-950">
                    {signal?.title ?? "Operating signal"}
                  </p>

                  <p className="mt-2 text-xs font-medium leading-6 text-blue-700">
                    {signal?.detail ??
                      "The selected business area is influencing the shared operating state."}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatCard
                    label="Revenue"
                    value={metrics.revenue}
                    valuePrefix="RWF "
                    compactValue
                    valueDecimals={2}
                    icon={FileCheck2}
                    caption={branchName}
                  />

                  <StatCard
                    label="Links"
                    value={connectedCount}
                    icon={Cloud}
                    caption="Connected operations"
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-muted p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Suggested action
                  </p>

                  <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
                    {workflowSteps[0] ? workflowRecommendation : signal?.action}
                  </p>
                </div>

                <div className="mt-4">
                  <AnimatedBarChart
                    values={chartSeries}
                    heightClassName="h-28"
                    barClassName="bg-blue-600"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Operating layers
                </p>

                <div className="mt-4 space-y-3">
                  {operatingLayers.map((layer) => (
                    <div
                      key={layer.label}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/80 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            dotClasses[layer.tone],
                          ].join(" ")}
                        />
                        <span className="text-sm font-black text-slate-800">
                          {layer.label}
                        </span>
                      </div>

                      <span className="text-xs font-bold text-slate-500">
                        {layer.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-muted p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950">
                      Unified business nervous system
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700">
                      Live metrics, events, workflows and executive signals now
                      move through one shared operating engine.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </WindowFrame>
      </div>
    </section>
  );
}