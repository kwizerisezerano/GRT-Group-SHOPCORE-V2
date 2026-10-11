import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Users,
  Warehouse,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { useBusinessScenario } from "@/contexts/BusinessScenarioContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { demoBusiness } from "@/data/landingDemoData";
import DashboardWindow from "./DashboardWindow";
import AnimatedCounter from "./live/AnimatedCounter";
import BusinessScenarioSelector from "./BusinessScenarioSelector";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const sidebarItems = [
  { id: "analytics", label: "Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "POS", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "warehouse", label: "Warehouse", icon: Warehouse },
  { id: "crm", label: "Customers", icon: Users },
  { id: "analytics-reports", label: "Reports", icon: BarChart3 },
];

const toneMap: Record<Tone, string> = {
  emerald: "bg-muted text-foreground border-border",
  blue: "bg-muted text-foreground border-border",
  cyan: "bg-muted text-foreground border-border",
  violet: "bg-muted text-foreground border-border",
  orange: "bg-muted text-foreground border-border",
  rose: "bg-muted text-foreground border-border",
};

const moduleHeroText: Record<string, string> = {
  pos: "ShopCore connects checkout, receipt handling, payment flow, inventory deduction and customer history into one operating workspace.",
  inventory:
    "ShopCore connects products, stock levels, replenishment, warehouse flow and reporting into one inventory control layer.",
  warehouse:
    "ShopCore connects receiving, transfers, branch replenishment, stock counts and movement tracking into one warehouse operating layer.",
  crm: "ShopCore connects customers, loyalty, sales history, credit visibility and retention signals into one customer operating layer.",
  procurement:
    "ShopCore connects suppliers, purchase orders, receiving, cost control and stock demand into one procurement workflow.",
  finance:
    "ShopCore connects sales, expenses, cash control, margins and branch profitability into one financial operating view.",
  analytics:
    "ShopCore connects sales, stock, branches, customers, finance and operations into one executive intelligence workspace.",
  offline:
    "ShopCore protects daily selling with local queues, offline records and secure synchronization when connectivity returns.",
  ebm: "ShopCore keeps fiscal receipt workflows tenant-controlled while allowing sales to continue without blocking operations.",
  security:
    "ShopCore governs tenant data, role access, protected routes, branch controls and activity visibility across the business.",
};

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

export default function HeroWorkspace() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    activityFeed,
    branchHealth,
  } = useLandingExperience();

  const { scenario } = useBusinessScenario();
  const { t } = useLanguage();

  const branches = getArray(demoBusiness, ["branches"]);
  const products = getArray(demoBusiness, ["products"]);
  const warehouses = getArray(demoBusiness, ["warehouses"]);

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ??
    branches.find((item) => getText(item, ["id", "key"], "") === activeBranch) ??
    branches[0];

  const branchName =
    branch?.name ?? getText(branch, ["name", "label", "title"], "Kigali Main");

  const businessName = scenario.businessName || "ShopCore";

  const branchCount = branchHealth.length || scenario.branches.length || 4;
  const warehouseCount = warehouses.length || 3;
  const productCount = products.length || scenario.products.length || 120;
  const signalCount = activityFeed.length || 8;

  const statusItems = [
    {
      label: "Branches online",
      value: branchCount,
      icon: Building2,
      tone: "emerald",
      numeric: true,
    },
    {
      label: "Warehouses",
      value: warehouseCount,
      icon: Warehouse,
      tone: "blue",
      numeric: true,
    },
    {
      label: "Receipts",
      value: metrics.receipts,
      icon: ReceiptText,
      tone: "violet",
      numeric: true,
    },
    {
      label: "Stock alerts",
      value: metrics.stockAlerts,
      icon: Cloud,
      tone: "cyan",
      numeric: true,
    },
  ] satisfies Array<{
    label: string;
    value: string | number;
    icon: React.ElementType;
    tone: Tone;
    numeric?: boolean;
  }>;

  const heroText =
    moduleHeroText[String(selectedModule)] ??
    "ShopCore connects POS, inventory, purchasing, customers, finance, reports, offline operations and fiscal compliance into one command workspace.";

  return (
    <section
      id="workspace"
      className="relative overflow-hidden bg-background text-foreground"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />

      <div className="relative mx-auto max-w-[1500px] px-4 pb-16 pt-12 sm:px-6 lg:pb-24 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="flex flex-col flex-1 justify-between max-w-[650px]"
          >
            <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Enterprise retail operating system
            </div>

            <h1 className="text-4xl font-black tracking-tight sm:text-5xl xl:text-6xl">
              Connect checkout, warehouse and branch.
            </h1>

            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-slate-700 dark:!text-slate-200 sm:text-lg">
              {heroText} This preview is currently configured for{" "}
              <span className="font-black text-foreground">{scenario.name}</span> and
              focused on {branchName}.
            </p>

            <div className="mt-8">
              <BusinessScenarioSelector />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-blue-600 px-8 text-base font-black text-white hover:bg-blue-700"
                asChild
              >
                <Link to="/signup">
                  Start workspace <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-12 border-border bg-muted/50 px-8 text-base font-black text-foreground hover:bg-muted hover:text-foreground"
                asChild
              >
                <a href="#modules">Explore modules</a>
              </Button>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-200 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:!text-blue-100">{t("Multi-branch operations")}</p>
                  <p className="text-xs text-muted-foreground">{t("Manage multiple locations from one unified workspace")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-200 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:!text-blue-100">{t("Offline-first architecture")}</p>
                  <p className="text-xs text-muted-foreground">{t("Continue operations even without internet connectivity")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-200 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:!text-blue-100">{t("Fiscal compliance ready")}</p>
                  <p className="text-xs text-muted-foreground">{t("EBM integration for regulated markets")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-200 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:!text-blue-100">{t("Role-based security")}</p>
                  <p className="text-xs text-muted-foreground">{t("Granular access control across all modules")}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statusItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur"
                  >
                    <Icon className="mb-3 h-5 w-5 text-blue-600 dark:text-blue-200" />
                    <p className="text-2xl font-black text-slate-900 dark:!text-blue-100">
                      {item.numeric && typeof item.value === "number" ? (
                        <AnimatedCounter value={item.value} />
                      ) : (
                        item.value
                      )}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, ease: "easeOut", delay: 0.12 }}
            className="relative flex flex-col lg:min-w-0"
          >
            <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="absolute -bottom-10 -right-8 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative flex-1 overflow-hidden rounded-[2rem] border border-border bg-card/10 p-2 shadow-[0_40px_130px_-55px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
              <div className="rounded-[1.5rem] border border-border bg-muted text-foreground">
                <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src="/shopcore-icon.png"
                      alt="ShopCore"
                      className="h-9 w-9 object-contain"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">
                        {businessName}
                      </p>
                      <p className="truncate text-[11px] font-semibold text-muted-foreground">
                        {branchName} Command Center
                      </p>
                    </div>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {demoMode ? "Live" : "Ready"}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">
                      <Wifi className="h-3 w-3" />
                      Synced
                    </span>
                  </div>
                </div>

                <div className="grid min-h-[560px] lg:grid-cols-[172px_minmax(0,1fr)]">
                  <aside className="hidden border-r border-border bg-card p-3 text-foreground lg:block">
                    <div className="space-y-1">
                      {sidebarItems.map((item) => {
                        const Icon = item.icon;
                        const active =
                          item.id === selectedModule ||
                          (item.id === "analytics-reports" &&
                            selectedModule === "analytics");

                        return (
                          <div
                            key={`${item.label}-${item.id}`}
                            className={[
                              "flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold",
                              active
                                ? "bg-blue-600 text-white"
                                : "text-muted-foreground hover:bg-muted/50 dark:text-muted-foreground dark:hover:bg-muted/30",
                            ].join(" ")}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 rounded-2xl border border-border bg-muted/50 p-3">
                      <Database className="mb-2 h-4 w-4 text-blue-600 dark:text-blue-200" />
                      <p className="text-xs font-black">Offline queue</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {demoMode
                          ? `${signalCount} live signals`
                          : `${metrics.offlineQueue} pending records`}
                      </p>
                    </div>
                  </aside>

                  <main className="relative overflow-hidden bg-muted p-3 sm:p-4">
                    <div className="mx-auto max-w-[980px]">
                      <DashboardWindow />
                    </div>
                  </main>
                </div>

                <div className="grid gap-2 border-t border-border bg-card p-3 sm:grid-cols-4">
                  {statusItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={`hero-status-${item.label}`}
                        className={[
                          "flex items-center gap-2 rounded-xl border px-3 py-2",
                          toneMap[item.tone],
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black">
                            {item.numeric && typeof item.value === "number" ? (
                              <AnimatedCounter value={item.value} />
                            ) : (
                              item.value
                            )}
                          </p>
                          <p className="truncate text-[10px] font-semibold opacity-75">
                            {item.label}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -right-2 top-16 hidden rounded-2xl border border-border bg-muted p-3 text-foreground shadow-xl xl:block"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <div>
                  <p className="text-xs font-black">
                    Fiscal receipts <AnimatedCounter value={metrics.receipts} />
                  </p>
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-200">
                    EBM optional by tenant
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="absolute -left-2 bottom-20 hidden rounded-2xl border border-border bg-muted p-3 text-foreground shadow-xl xl:block"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <div>
                  <p className="text-xs font-black">
                    {t("4+ products tracked").replace("4+", `${productCount}+`)}
                  </p>
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-200">
                    {scenario.inventoryFocus}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}