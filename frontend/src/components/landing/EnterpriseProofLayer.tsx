import {
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  Globe2,
  Layers3,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Store,
  Warehouse,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const capabilityRows = [
  { label: "Offline-first sales continuity", value: "Supported", tone: "cyan" },
  { label: "Role-based permissions", value: "Controlled", tone: "emerald" },
  { label: "Fiscal receipt workflow", value: "EBM-ready", tone: "violet" },
  { label: "Warehouse and transfer control", value: "Included", tone: "orange" },
  { label: "Customer loyalty and credit", value: "Included", tone: "blue" },
  { label: "Executive analytics", value: "Live", tone: "emerald" },
] satisfies Array<{
  label: string;
  value: string;
  tone: Tone;
}>;

const industryRows = [
  { name: "Supermarkets", icon: Store },
  { name: "Retail shops", icon: PackageCheck },
  { name: "Wholesalers", icon: Warehouse },
  { name: "Pharmacies", icon: FileCheck2 },
  { name: "Hardware stores", icon: Building2 },
  { name: "Electronics", icon: Globe2 },
];

const controlRows = [
  {
    title: "Operational control",
    text: "Stock, sales, purchasing and transfers stay connected.",
    icon: BarChart3,
    tone: "blue",
  },
  {
    title: "Security governance",
    text: "Roles, protected routes and tenant boundaries support team growth.",
    icon: LockKeyhole,
    tone: "emerald",
  },
  {
    title: "Daily continuity",
    text: "Offline queues and synchronization protect business flow.",
    icon: Clock3,
    tone: "cyan",
  },
] satisfies Array<{
  title: string;
  text: string;
  icon: React.ElementType;
  tone: Tone;
}>;

const moduleProofText: Record<string, string> = {
  pos: "Checkout activity is connected to inventory, customers, fiscal receipts, cash control and executive visibility.",
  inventory: "Inventory control is connected to warehouse flow, purchasing, stock counts, sales availability and reporting.",
  warehouse: "Warehouse operations are connected to receiving, transfers, branch replenishment and stock reconciliation.",
  crm: "Customer operations are connected to loyalty, sales history, credit control and retention visibility.",
  procurement: "Procurement is connected to supplier performance, purchase orders, receiving and stock demand signals.",
  finance: "Finance is connected to sales, expenses, cash sessions, purchasing costs and profitability reporting.",
  analytics: "Analytics consolidates sales, stock, customers, finance, branch performance and executive decision signals.",
  offline: "Offline continuity protects sales, stock movements and synchronization during unstable connectivity.",
  ebm: "Fiscal workflows remain tenant-controlled while sales continue safely when fiscal services are unavailable.",
  security: "Security governs roles, permissions, tenant boundaries, protected routes and operational accountability.",
};

const toneIcon: Record<Tone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const toneDot: Record<Tone, string> = {
  blue: "bg-blue-500",
  emerald: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  violet: "bg-blue-500",
  cyan: "bg-blue-500",
};

const toneBadge: Record<Tone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
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

export default function EnterpriseProofLayer() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    branchHealth,
    activityFeed,
  } = useLandingExperience();

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ?? branchHealth[0];

  const branchName = branch?.name ?? "Active branch";

  const businessName = getText(
    demoBusiness,
    ["company", "name", "businessName"],
    "ShopCore Retail Group",
  );

  const branchCount = branchHealth.length || 4;
  const signalCount = activityFeed.length || 18;

  const contextualProof =
    moduleProofText[String(selectedModule)] ??
    "Every operating area contributes to the same shared retail business state.";

  const liveProofMetrics = [
    {
      label: "Business types",
      value: "12+",
      caption: "Retail, wholesale, pharmacy, hardware and more",
      icon: Store,
      tone: "blue",
    },
    {
      label: "Live branches",
      value: branchCount,
      caption: `${branchName} is synchronized with the operating layer`,
      icon: Building2,
      tone: "emerald",
    },
    {
      label: "Customer base",
      value: metrics.customers,
      caption: "CRM, loyalty and repeat customer intelligence",
      icon: PackageCheck,
      tone: "orange",
    },
    {
      label: "Signals",
      value: signalCount,
      caption: "Notifications, workflows and control events",
      icon: Database,
      tone: "cyan",
    },
  ] satisfies Array<{
    label: string;
    value: string | number;
    caption: string;
    icon: React.ElementType;
    tone: Tone;
  }>;

  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
            Enterprise proof layer
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
            Built with the structure serious retail businesses expect.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
            {businessName} demonstrates branches, warehouses, roles, fiscal
            workflows, offline continuity, inventory control, customer
            management and executive reporting as one connected operating model.
          </p>
        </div>

        <WindowFrame
          title="Enterprise Readiness Board"
          eyebrow={`${branchName} · ${demoMode ? "Live operating proof" : "Operating maturity"}`}
          icon={Award}
          status={demoMode ? "Live proof" : "Business-ready"}
          statusTone="blue"
          bodyClassName="bg-muted/70 p-4 sm:p-5"
        >
          <div className="grid gap-4 lg:grid-cols-4">
            {liveProofMetrics.map((metric) => (
              <StatCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
                caption={metric.caption}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Capability checklist
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900 dark:!text-blue-100">
                    What enterprise retailers need covered
                  </h3>
                </div>

                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {capabilityRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/80 px-3 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "h-2.5 w-2.5 rounded-full",
                          toneDot[row.tone],
                        ].join(" ")}
                      />
                      <span className="text-sm font-black text-foreground">
                        {row.label}
                      </span>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                        toneBadge[row.tone],
                      ].join(" ")}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-3xl border border-border bg-muted p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <BarChart3 className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                      Current operating proof
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-300">
                      {contextualProof}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Industry fit
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900 dark:!text-blue-100">
                      Retail sectors supported
                    </h3>
                  </div>

                  <Globe2 className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {industryRows.map((industry) => {
                    const Icon = industry.icon;

                    return (
                      <div
                        key={industry.name}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-muted/80 p-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center text-foreground">
                          <Icon className="h-4 w-4" />
                        </div>

                        <p className="text-sm font-black text-foreground">
                          {industry.name}
                        </p>
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
                      Ready for real operating complexity
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-300">
                      ShopCore is structured for businesses that need more than
                      checkout: inventory governance, stock flow, permissions,
                      branch visibility and business intelligence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {controlRows.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-border bg-card p-5 shadow-sm"
                >
                  <div
                    className={[
                      "mb-4 flex h-11 w-11 items-center justify-center text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <p className="text-sm font-black text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-2 text-xs font-medium leading-6 text-muted-foreground">
                    {item.text}
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