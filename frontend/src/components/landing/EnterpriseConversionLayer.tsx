import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const baseReadinessItems = [
  { label: "POS operations", value: "Ready", icon: ShoppingCart, tone: "blue" },
  { label: "Inventory control", value: "Connected", icon: Package, tone: "blue" },
  { label: "Warehouse flow", value: "Managed", icon: Warehouse, tone: "orange" },
  { label: "Branch network", value: "Scalable", icon: Building2, tone: "cyan" },
  { label: "Fiscal workflow", value: "EBM-ready", icon: ReceiptText, tone: "violet" },
  { label: "Security", value: "Protected", icon: ShieldCheck, tone: "blue" },
] satisfies Array<{
  label: string;
  value: string;
  icon: React.ElementType;
  tone: Tone;
}>;

const toneIcon: Record<Tone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const moduleConversionText: Record<string, string> = {
  pos: "Start with checkout, receipts, payment flow and stock deduction, then expand into full branch operations.",
  inventory: "Start with inventory control, product visibility and stock alerts, then expand into warehouses and replenishment.",
  warehouse: "Start with warehouse movement, receiving and transfer control, then connect branch replenishment and reporting.",
  crm: "Start with customer profiles and loyalty visibility, then connect credit control, retention and sales history.",
  procurement: "Start with supplier purchasing and receiving workflows, then connect cost control and stock planning.",
  finance: "Start with cash visibility, expenses and margin reporting, then expand into advanced financial control.",
  analytics: "Start with executive visibility, then connect every sales, stock, branch, customer and finance signal.",
  offline: "Start with offline continuity for daily selling, then expand secure synchronization across more operations.",
  ebm: "Start with tenant-controlled fiscal readiness, then activate receipt submission when configuration is complete.",
  security: "Start with protected routes and roles, then expand governance across teams, branches and sensitive workflows.",
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

export default function EnterpriseConversionLayer() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    branchHealth,
    activityFeed,
  } = useLandingExperience();

  const branches = getArray(demoBusiness, ["branches"]);

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ??
    branches.find((item) => getText(item, ["id", "key"], "") === activeBranch) ??
    branches[0];

  const branchName = getText(branch, ["name", "label", "title"], "Active branch");
  const branchCount = branchHealth.length || branches.length || 1;

  const readinessItems = baseReadinessItems.map((item) => {
    if (selectedModule === "pos" && item.label === "POS operations") {
      return { ...item, value: `${metrics.orders} orders` };
    }

    if (selectedModule === "inventory" && item.label === "Inventory control") {
      return { ...item, value: `${metrics.stockAlerts} alerts` };
    }

    if (selectedModule === "warehouse" && item.label === "Warehouse flow") {
      return { ...item, value: `${metrics.transfers} transfers` };
    }

    if (selectedModule === "ebm" && item.label === "Fiscal workflow") {
      return { ...item, value: `${metrics.receipts} receipts` };
    }

    if (selectedModule === "security" && item.label === "Security") {
      return { ...item, value: "Live focus" };
    }

    return item;
  });

  const conversionText =
    moduleConversionText[String(selectedModule)] ??
    "Replace disconnected spreadsheets, manual stock checks, isolated cash counters and delayed reporting with one connected command workspace.";

  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
              Start operating differently
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
              Move your retail business into a real operating system.
            </h2>

            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
              {conversionText} Current preview context: {branchName}.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700" asChild>
                <Link to="/signup">
                  Start workspace <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="border-border bg-muted text-foreground hover:bg-muted hover:text-foreground"
                asChild
              >
                <a href="#pricing">View operating plans</a>
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "No credit card required",
                "Built for multi-branch growth",
                "Offline-first operations",
                "Tenant-controlled fiscal setup",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-bold text-slate-900 dark:!text-blue-100"
                >
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-200" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <WindowFrame
            title="Implementation Readiness Board"
            eyebrow={`${branchName} · Operational setup path`}
            icon={ClipboardCheck}
            status={demoMode ? "Live readiness" : "Ready"}
            statusTone="blue"
            className="border-border bg-card"
            bodyClassName="bg-muted/80 p-4 sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Setup path"
                value="Guided"
                icon={ClipboardCheck}
                caption="Start clean"
              />

              <StatCard
                label="Branches"
                value={branchCount}
                icon={Database}
                caption={`${activityFeed.length || 8} shared signals`}
              />

              <StatCard
                label="Revenue"
                value={metrics.revenue}
                valuePrefix="RWF "
                compactValue
                valueDecimals={2}
                icon={BarChart3}
                caption="Management-ready"
              />
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                Business readiness
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {readinessItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/80 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={[
                            "flex h-9 w-9 items-center justify-center rounded-xl border",
                            toneIcon[item.tone],
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

                      <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-200" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-muted p-5">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 items-center justify-center text-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                    Designed for structured rollout
                  </p>
                  <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-300">
                    Start with POS and inventory, then expand into branches,
                    warehouses, procurement, loyalty, finance, reporting,
                    offline continuity and fiscal workflows as the business
                    grows.
                  </p>
                </div>
              </div>
            </div>
          </WindowFrame>
        </div>
      </div>
    </section>
  );
}