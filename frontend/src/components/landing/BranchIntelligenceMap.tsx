import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  MapPinned,
  PackageCheck,
  RefreshCcw,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const branchPositions: Record<string, { x: string; y: string; location: string }> = {
  "kigali-main": { x: "50%", y: "38%", location: "Central retail hub" },
  remera: { x: "62%", y: "47%", location: "Urban branch" },
  huye: { x: "46%", y: "74%", location: "Southern branch" },
  musanze: { x: "42%", y: "18%", location: "Northern branch" },
};

const moduleMap: Record<string, { title: string; note: string }> = {
  pos: {
    title: "POS activity is strongest at Kigali Main and Remera.",
    note: "Checkout velocity is feeding revenue, stock deduction and fiscal readiness.",
  },
  inventory: {
    title: "Inventory risk is concentrated around Huye and Musanze.",
    note: "Replenishment planning should focus on critical stock movement and warehouse balancing.",
  },
  warehouse: {
    title: "Warehouse pressure is visible across the northern route.",
    note: "Transfer planning can reduce capacity pressure and rebalance branch availability.",
  },
  crm: {
    title: "Customer growth is strongest in high-frequency urban branches.",
    note: "CRM and loyalty activity can improve retention across Kigali Main and Remera.",
  },
  procurement: {
    title: "Procurement should follow branch-level demand signals.",
    note: "Purchase planning can be triggered by inventory alerts and branch consumption patterns.",
  },
  finance: {
    title: "Finance receives branch-level cash and margin signals.",
    note: "Branch sales, expenses and stock movement feed profitability visibility.",
  },
  analytics: {
    title: "Analytics compares each branch as part of one operating network.",
    note: "Revenue, inventory health, transfer volume and branch capacity are consolidated.",
  },
  offline: {
    title: "Offline continuity protects every branch workflow.",
    note: "Local queues allow business records to wait safely until secure synchronization is available.",
  },
  ebm: {
    title: "Fiscal readiness is controlled by each tenant configuration.",
    note: "Sales continue normally when fiscal credentials are not configured.",
  },
  security: {
    title: "Branch operations remain protected by role and workspace access.",
    note: "Users can be controlled by location, module responsibility and permission level.",
  },
};

const toneDot: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  cyan: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  violet: "bg-blue-500",
};

const toneBadge: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
};

const iconByTone: Record<Tone, typeof ArrowRightLeft> = {
  emerald: ArrowRightLeft,
  blue: ShoppingCart,
  cyan: RefreshCcw,
  orange: Truck,
  rose: AlertTriangle,
  violet: PackageCheck,
};

export default function BranchIntelligenceMap() {
  const {
    selectedModule,
    activeBranch,
    selectBranch,
    demoMode,
    metrics,
    branchHealth,
    activityFeed,
  } = useLandingExperience();

  const selectedInsight = moduleMap[selectedModule] ?? moduleMap.analytics;

  const branches =
    branchHealth.length > 0
      ? branchHealth.map((branch, index) => {
          const position =
            branchPositions[branch.id] ??
            [
              branchPositions["kigali-main"],
              branchPositions.remera,
              branchPositions.musanze,
              branchPositions.huye,
            ][index] ??
            branchPositions["kigali-main"];

          const revenueShare =
            index === 0 ? 0.4 : index === 1 ? 0.24 : index === 2 ? 0.18 : 0.12;

          return {
            ...branch,
            x: position.x,
            y: position.y,
            location: position.location,
            revenue: Math.round(metrics.revenue * revenueShare),
          };
        })
      : [
          {
            id: "kigali-main",
            name: "Kigali Main",
            location: "Central retail hub",
            x: "50%",
            y: "38%",
            revenue: Math.round(metrics.revenue * 0.4),
            status: "Online",
            tone: "emerald" as Tone,
            load: 94,
          },
          {
            id: "remera",
            name: "Remera",
            location: "Urban branch",
            x: "62%",
            y: "47%",
            revenue: Math.round(metrics.revenue * 0.24),
            status: "Online",
            tone: "emerald" as Tone,
            load: 87,
          },
          {
            id: "musanze",
            name: "Musanze",
            location: "Northern branch",
            x: "42%",
            y: "18%",
            revenue: Math.round(metrics.revenue * 0.18),
            status: "Syncing",
            tone: "cyan" as Tone,
            load: 72,
          },
          {
            id: "huye",
            name: "Huye",
            location: "Southern branch",
            x: "46%",
            y: "74%",
            revenue: Math.round(metrics.revenue * 0.12),
            status: "Review",
            tone: "orange" as Tone,
            load: 61,
          },
        ];

  const activeBranchData =
    branches.find((branch) => branch.id === activeBranch) ?? branches[0];

  const networkRows =
    activityFeed.length > 0
      ? activityFeed.slice(0, 4).map((event, index) => ({
          title: event.title,
          meta: event.detail,
          tone: event.tone,
          icon: iconByTone[event.tone] ?? iconByTone.blue,
          key: event.id ?? `${event.title}-${index}`,
        }))
      : [
          {
            title: "Central Warehouse → Kigali Main",
            meta: "42 items transferred · completed",
            tone: "emerald" as Tone,
            icon: ArrowRightLeft,
            key: "transfer",
          },
          {
            title: "Musanze Depot capacity review",
            meta: "91% capacity · redistribution suggested",
            tone: "orange" as Tone,
            icon: Warehouse,
            key: "capacity",
          },
          {
            title: "Remera checkout velocity increased",
            meta: "18% higher order volume today",
            tone: "blue" as Tone,
            icon: ShoppingCart,
            key: "checkout",
          },
          {
            title: "Huye replenishment pending",
            meta: "Rice 25kg and Cooking Oil require review",
            tone: "orange" as Tone,
            icon: Truck,
            key: "replenishment",
          },
        ];

  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
            Branch intelligence map
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
            See every branch, warehouse and transfer as one living network.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
            ShopCore connects branch sales, warehouse capacity, transfers,
            replenishment needs and synchronization state into one operational
            map for multi-location businesses.
          </p>
        </div>

        <WindowFrame
          title="Branch Network Control"
          eyebrow="Multi-location operating map"
          icon={MapPinned}
          status={demoMode ? "Live network" : activeBranchData.name}
          statusTone={demoMode ? "cyan" : "emerald"}
          bodyClassName="bg-muted/70 p-4 sm:p-5"
        >
          <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="relative min-h-[560px] overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-inner">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(16,185,129,0.22),transparent_34%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:100%_100%,44px_44px,44px_44px]" />

              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {branches.map((branch) => {
                  const x = Number(branch.x.replace("%", ""));
                  const y = Number(branch.y.replace("%", ""));
                  const active = branch.id === activeBranch;

                  return (
                    <line
                      key={branch.name}
                      x1="50"
                      y1="38"
                      x2={x}
                      y2={y}
                      stroke={
                        active
                          ? "rgba(34,211,238,0.82)"
                          : branch.tone === "orange"
                            ? "rgba(251,146,60,0.42)"
                            : "rgba(52,211,153,0.42)"
                      }
                      strokeWidth={active ? "0.58" : "0.28"}
                      strokeDasharray="1.6 1.2"
                    />
                  );
                })}
              </svg>

              <div className="absolute left-1/2 top-[38%] z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-3xl border border-blue-300/40 bg-blue-400/10 px-5 py-4 text-blue-100 shadow-[0_0_80px_rgba(59,130,246,0.18)] backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center text-foreground">
                  <Warehouse className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm font-black text-white">
                    Central Warehouse
                  </p>
                  <p className="text-xs font-bold text-blue-200">
                    Distribution control
                  </p>
                </div>
              </div>

              {branches.map((branch) => {
                const active = branch.id === activeBranch;

                return (
                  <button
                    key={branch.name}
                    type="button"
                    onClick={() => selectBranch(branch.id as never)}
                    className={[
                      "absolute z-30 w-[172px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-3 text-left text-slate-900 dark:text-white backdrop-blur transition-all",
                      active
                        ? "scale-110 border-blue-300 bg-blue-400/15 shadow-[0_0_60px_rgba(59,130,246,0.24)]"
                        : "border-border bg-muted/50 hover:border-border hover:bg-muted/70",
                    ].join(" ")}
                    style={{ left: branch.x, top: branch.y }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black">{branch.name}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                          {branch.location}
                        </p>
                      </div>

                      <span
                        className={[
                          "mt-1 h-2.5 w-2.5 rounded-full",
                          active ? "bg-blue-300" : toneDot[branch.tone],
                        ].join(" ")}
                      />
                    </div>

                    <p className="mt-3 text-sm font-black">
                      RWF{" "}
                      <AnimatedCounter
                        value={branch.revenue}
                        compact
                        decimals={2}
                      />
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          active
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : toneBadge[branch.tone],
                        ].join(" ")}
                      >
                        {active ? "Selected" : branch.status}
                      </span>

                      <span className="text-[10px] font-bold text-muted-foreground">
                        {branch.load}%
                      </span>
                    </div>
                  </button>
                );
              })}

              <div className="absolute bottom-4 left-4 right-4 z-40 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Active branch", value: activeBranchData.name, icon: Building2 },
                  { label: "Focus module", value: selectedModule.toUpperCase(), icon: PackageCheck },
                  { label: "Demo state", value: demoMode ? "Auto cycling" : "Manual", icon: RefreshCcw },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-border bg-muted/50 p-3 text-foreground backdrop-blur"
                    >
                      <Icon className="mb-2 h-4 w-4 text-blue-600 dark:text-blue-200" />
                      <p className="text-xs font-black">{item.value}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Active branch"
                  value={activeBranchData.name}
                  icon={Building2}
                  trend={activeBranchData.status}
                  trendDirection="up"
                  caption={activeBranchData.location}
                />

                <StatCard
                  label="Branch revenue"
                  value={activeBranchData.revenue}
                  valuePrefix="RWF "
                  compactValue
                  valueDecimals={2}
                  icon={ShoppingCart}
                  trend="Today"
                  trendDirection="neutral"
                  caption="Live branch signal"
                />

                <StatCard
                  label="Warehouse load"
                  value={activeBranchData.load}
                  valueSuffix="%"
                  icon={Warehouse}
                  trend="Review"
                  trendDirection="neutral"
                  caption="Capacity status"
                />

                <StatCard
                  label="Stock alerts"
                  value={metrics.stockAlerts}
                  icon={PackageCheck}
                  trend="+3.4%"
                  trendDirection="up"
                  caption="Availability pressure"
                />
              </div>

              <div className="rounded-3xl border border-border bg-muted p-5">
                <p className="text-sm font-black text-foreground">
                  {selectedInsight.title}
                </p>
                <p className="mt-2 text-xs font-medium leading-6 text-blue-700 dark:text-blue-300">
                  {selectedInsight.note}
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Network activity
                    </p>
                    <p className="mt-1 text-sm font-black text-foreground">
                      Branch and warehouse signals
                    </p>
                  </div>

                  <RefreshCcw className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-3">
                  {networkRows.map((row) => {
                    const Icon = row.icon;

                    return (
                      <div key={row.key} className="flex gap-3">
                        <div
                          className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white",
                            toneDot[row.tone],
                          ].join(" ")}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-black text-foreground">
                            {row.title}
                          </p>
                          <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">
                            {row.meta}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-muted p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                      Branch operations stay synchronized
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-300">
                      Sales, warehouse capacity, transfers and stock availability
                      remain visible from one network control layer.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <AlertTriangle className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                      Replenishment attention needed
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-200">
                      Huye and Musanze should be reviewed for inventory balancing
                      and replenishment planning.
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