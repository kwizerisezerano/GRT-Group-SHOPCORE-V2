import { useMemo } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  Database,
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
import type { LandingModuleId } from "@/data/landingDemoData";
import { getDemoWorkflow } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import DashboardWindow from "./DashboardWindow";
import InventoryWindow from "./InventoryWindow";
import POSWindow from "./POSWindow";
import WarehouseWindow from "./WarehouseWindow";
import CRMWindow from "./CRMWindow";
import AnalyticsWindow from "./AnalyticsWindow";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const modules = [
  {
    id: "pos",
    name: "Point of Sale",
    category: "Revenue",
    icon: ShoppingCart,
    tone: "blue",
    headline: "Fast checkout connected to inventory, receipts and payments.",
    metrics: ["11s checkout", "Receipts", "Offline-ready"],
    flows: ["Scan products", "Take payment", "Print receipt", "Deduct stock"],
  },
  {
    id: "inventory",
    name: "Inventory Control",
    category: "Operations",
    icon: Package,
    tone: "emerald",
    headline: "Centralized stock visibility across products and locations.",
    metrics: ["SKUs", "Stock alerts", "Stock value"],
    flows: ["Track stock", "Monitor batches", "Review alerts", "Reorder"],
  },
  {
    id: "warehouse",
    name: "Warehouse Operations",
    category: "Distribution",
    icon: Warehouse,
    tone: "orange",
    headline: "Receiving, storage, transfers and warehouse capacity control.",
    metrics: ["Warehouses", "Transfers", "Receiving"],
    flows: ["Receive goods", "Approve transfer", "Move stock", "Reconcile"],
  },
  {
    id: "crm",
    name: "CRM & Loyalty",
    category: "Customers",
    icon: Users,
    tone: "violet",
    headline: "Customer profiles, purchase history, loyalty and credit control.",
    metrics: ["Profiles", "Loyalty value", "VIP tiers"],
    flows: ["Identify buyer", "Apply loyalty", "Manage credit", "Retain"],
  },
  {
    id: "procurement",
    name: "Purchasing",
    category: "Supply",
    icon: Truck,
    tone: "cyan",
    headline: "Supplier orders, receiving, costs and purchase operations.",
    metrics: ["PO workflow", "Supplier ledger", "Receiving"],
    flows: ["Create PO", "Receive items", "Post costs", "Update stock"],
  },
  {
    id: "finance",
    name: "Finance Control",
    category: "Accounting",
    icon: CreditCard,
    tone: "rose",
    headline: "Expenses, cash sessions, margins and financial visibility.",
    metrics: ["Cash sessions", "Margins", "Expenses"],
    flows: ["Track cash", "Record expense", "Review profit", "Export"],
  },
  {
    id: "analytics",
    name: "Business Intelligence",
    category: "Analytics",
    icon: BarChart3,
    tone: "violet",
    headline: "Reports, KPIs, branch performance and profitability insights.",
    metrics: ["Reports", "Margin", "Live KPIs"],
    flows: ["Analyze sales", "Compare branches", "Track profit", "Export"],
  },
  {
    id: "offline",
    name: "Offline Engine",
    category: "Continuity",
    icon: Database,
    tone: "cyan",
    headline: "Local queue protection for operations during poor connectivity.",
    metrics: ["Queue safe", "Local cache", "Secure sync"],
    flows: ["Work offline", "Queue records", "Login online", "Synchronize"],
  },
  {
    id: "ebm",
    name: "EBM Fiscal Layer",
    category: "Compliance",
    icon: ReceiptText,
    tone: "blue",
    headline: "Tenant-owned fiscal workflow with optional receipt submission.",
    metrics: ["Tenant config", "Retry queue", "Non-blocking"],
    flows: ["Save sale", "Check config", "Submit fiscal", "Update receipt"],
  },
  {
    id: "security",
    name: "Security Center",
    category: "Governance",
    icon: ShieldCheck,
    tone: "emerald",
    headline: "Role permissions, protected routes and tenant data separation.",
    metrics: ["RBAC", "Audit trail", "Protected routes"],
    flows: ["Assign role", "Restrict module", "Track action", "Audit"],
  },
] satisfies Array<{
  id: LandingModuleId;
  name: string;
  category: string;
  icon: React.ElementType;
  tone: Tone;
  headline: string;
  metrics: string[];
  flows: string[];
}>;

const toneMap: Record<Tone, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
};

const dotMap: Record<Tone, string> = {
  blue: "bg-blue-600",
  emerald: "bg-emerald-600",
  orange: "bg-orange-600",
  rose: "bg-rose-600",
  violet: "bg-violet-600",
  cyan: "bg-cyan-600",
};

const formatRwf = (value: number) => {
  if (value >= 1_000_000) return `RWF ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `RWF ${(value / 1_000).toFixed(1)}K`;
  return `RWF ${value.toLocaleString()}`;
};

function ModulePreview({ selectedModule }: { selectedModule: LandingModuleId }) {
  if (selectedModule === "pos") return <POSWindow />;
  if (selectedModule === "inventory") return <InventoryWindow />;
  if (selectedModule === "warehouse") return <WarehouseWindow />;
  if (selectedModule === "crm") return <CRMWindow />;
  if (selectedModule === "analytics") return <AnalyticsWindow />;

  return <DashboardWindow />;
}

export default function ModuleExplorer() {
  const {
    selectedModule,
    selectModule,
    activeBranch,
    demoMode,
    metrics,
    branchHealth,
    warehouseCapacity,
    activityFeed,
  } = useLandingExperience();

  const activeBranchRecord =
    branchHealth.find((item) => item.id === activeBranch) ?? branchHealth[0];

  const branchName = activeBranchRecord?.name ?? "Active branch";

  const activeModule = useMemo(
    () => modules.find((module) => module.id === selectedModule) ?? modules[0],
    [selectedModule],
  );

  const workflow = getDemoWorkflow(selectedModule) as Record<string, unknown>;

  const workflowSteps = Array.isArray(workflow.steps)
    ? workflow.steps.map((item) => String(item))
    : [];

  const dynamicMetrics = [
    selectedModule === "inventory"
      ? `${metrics.stockAlerts} stock alerts`
      : selectedModule === "crm"
        ? `${metrics.customers.toLocaleString()} profiles`
        : selectedModule === "analytics"
          ? `${metrics.margin.toFixed(1)}% margin`
          : selectedModule === "warehouse"
            ? `${warehouseCapacity.length || 9} warehouses`
            : selectedModule === "pos"
              ? `${metrics.orders.toLocaleString()} orders`
              : activeModule.metrics[0],

    selectedModule === "pos"
      ? `${metrics.receipts.toLocaleString()} receipts`
      : selectedModule === "warehouse"
        ? `${metrics.transfers.toLocaleString()} transfers`
        : selectedModule === "finance"
          ? formatRwf(metrics.cashCollected)
          : selectedModule === "inventory"
            ? formatRwf(metrics.inventoryValue)
            : activeModule.metrics[1],

    demoMode ? "Live context" : activeModule.metrics[2],
  ];

  const activeFlows =
    workflowSteps.length >= 3 ? workflowSteps.slice(0, 4) : activeModule.flows;

  const ActiveIcon = activeModule.icon;

  return (
    <section id="modules" className="relative overflow-hidden bg-white py-20 sm:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(6,182,212,0.08),transparent_28%)]" />

      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
            Intelligent module explorer
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Launch every operation like a business application.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-600">
            ShopCore modules are synchronized through one shared business state.
            Selecting a module updates workflows, metrics, branch context and
            the operating preview.
          </p>
        </div>

        <WindowFrame
          title="ShopCore Module Launcher"
          eyebrow={`${branchName} · Retail operating applications`}
          icon={ClipboardList}
          status={`${modules.length} modules`}
          statusTone="blue"
          bodyClassName="bg-slate-50/70 p-4 sm:p-5"
        >
          <div className="grid items-start gap-5 lg:grid-cols-1 xl:grid-cols-[minmax(380px,0.72fr)_minmax(0,2fr)]">
            <nav
              aria-label="ShopCore modules"
              className="grid min-w-0 gap-3 sm:grid-cols-2 xl:sticky xl:top-24"
            >
              {modules.map((module) => {
                const Icon = module.icon;
                const active = module.id === selectedModule;

                return (
                  <button
                    key={`module-card-${module.id}`}
                    type="button"
                    onClick={() => selectModule(module.id)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group min-h-[148px] min-w-0 overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200",
                      active
                        ? "border-blue-300 bg-white shadow-[0_26px_80px_-50px_rgba(37,99,235,0.65)] ring-4 ring-blue-50"
                        : "border-slate-200 bg-white/80 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={[
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                          toneMap[module.tone],
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <ArrowRight
                        className={[
                          "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5",
                          active
                            ? "text-blue-600"
                            : "text-slate-300 group-hover:text-slate-500",
                        ].join(" ")}
                      />
                    </div>

                    <p className="mt-4 break-words text-[15px] font-black leading-5 text-slate-950 line-clamp-2">
                      {module.name}
                    </p>

                    <p className="mt-1 break-words text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-slate-400 line-clamp-2">
                      {module.category}
                    </p>
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={[
                      "flex h-14 w-14 items-center justify-center rounded-2xl border",
                      toneMap[activeModule.tone],
                    ].join(" ")}
                  >
                    <ActiveIcon className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      {activeModule.category}
                    </p>

                    <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950 break-words line-clamp-2">
                      {activeModule.name}
                    </h3>

                    <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 break-words line-clamp-3">
                      {activeModule.headline}
                    </p>
                  </div>
                </div>

                <span
                  className={[
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black",
                    toneMap[activeModule.tone],
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-2 w-2 rounded-full",
                      dotMap[activeModule.tone],
                    ].join(" ")}
                  />
                  {demoMode ? "Live module preview" : "Module preview"}
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {dynamicMetrics.map((metric, index) => (
                  <div
                    key={`module-metric-${selectedModule}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs font-bold text-slate-500">
                      Metric {index + 1}
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {metric}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 max-h-[640px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 p-3">
                <div className="origin-top scale-[0.84] md:scale-[0.9] xl:scale-[0.82]">
                  <div className="w-[980px] max-w-none">
                    <ModulePreview selectedModule={selectedModule} />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Operating flow
                    </p>
                    <p className="mt-1 text-sm font-black">
                      How this module works inside ShopCore
                    </p>
                  </div>

                  <RefreshCcw className="h-5 w-5 text-cyan-300" />
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  {activeFlows.map((flow, index) => (
                    <div key={`module-flow-${selectedModule}-${index}`} className="relative">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-cyan-300">
                          Step {index + 1}
                        </p>

                        <p className="mt-1 text-sm font-bold text-white">
                          {flow}
                        </p>
                      </div>

                      {index < activeFlows.length - 1 ? (
                        <div className="absolute right-[-14px] top-1/2 hidden h-px w-5 bg-white/20 sm:block" />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="Connected data"
                  value="Unified"
                  icon={Database}
                  tone="cyan"
                  caption={`${activityFeed.length || 8} shared signals`}
                />

                <StatCard
                  label="Branch-ready"
                  value="Multi-site"
                  icon={Building2}
                  tone="blue"
                  caption={branchName}
                />

                <StatCard
                  label="Activity"
                  value="Tracked"
                  icon={Activity}
                  tone="emerald"
                  caption="Operational visibility"
                />
              </div>
            </div>
          </div>
        </WindowFrame>
      </div>
    </section>
  );
}
