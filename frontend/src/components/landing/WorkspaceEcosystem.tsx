import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Database,
  Laptop,
  Monitor,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Tablet,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness, landingModules } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";
import WorkflowEngine from "./live/WorkflowEngine";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const workspaceProfiles = [
  {
    id: "executive",
    name: "Executive",
    role: "Owners and directors",
    icon: BarChart3,
    tone: "blue",
    modules: ["analytics", "finance", "inventory", "security"],
    tools: ["KPIs", "Profit", "Branch health", "Reports"],
  },
  {
    id: "retail",
    name: "Retail",
    role: "Cashiers and supervisors",
    icon: ShoppingCart,
    tone: "blue",
    modules: ["pos", "crm", "ebm"],
    tools: ["POS", "Receipts", "Payments", "Customers"],
  },
  {
    id: "warehouse",
    name: "Warehouse",
    role: "Stock and logistics teams",
    icon: Warehouse,
    tone: "blue",
    modules: ["warehouse", "inventory", "offline"],
    tools: ["Receiving", "Transfers", "Counts", "Batches"],
  },
  {
    id: "finance",
    name: "Finance",
    role: "Accountants and managers",
    icon: CreditCard,
    tone: "blue",
    modules: ["finance", "ebm", "analytics"],
    tools: ["Cash", "Expenses", "Margins", "Exports"],
  },
  {
    id: "procurement",
    name: "Procurement",
    role: "Purchasing officers",
    icon: Truck,
    tone: "blue",
    modules: ["procurement", "warehouse", "inventory"],
    tools: ["Suppliers", "POs", "Costs", "Receiving"],
  },
  {
    id: "customer-office",
    name: "Customer Office",
    role: "CRM and loyalty teams",
    icon: Users,
    tone: "blue",
    modules: ["crm", "pos", "analytics"],
    tools: ["Profiles", "Loyalty", "Credit", "Retention"],
  },
] satisfies Array<{
  id: string;
  name: string;
  role: string;
  icon: React.ElementType;
  tone: Tone;
  modules: string[];
  tools: string[];
}>;

const deviceRows = [
  { label: "Desktop workstation", icon: Monitor, value: "Full operations" },
  { label: "Browser workspace", icon: Laptop, value: "Management access" },
  { label: "Tablet counter", icon: Tablet, value: "Retail floor ready" },
  { label: "Mobile review", icon: Smartphone, value: "Quick oversight" },
];

const toneIcon: Record<Tone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const moduleTone: Record<string, Tone> = {
  pos: "blue",
  inventory: "blue",
  warehouse: "blue",
  crm: "blue",
  procurement: "blue",
  finance: "blue",
  analytics: "blue",
  offline: "blue",
  ebm: "blue",
  security: "blue",
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

export default function WorkspaceEcosystem() {
  const {
    selectedModule,
    activeBranch,
    activeWorkspace,
    demoMode,
    metrics,
    activityFeed,
    branchHealth,
  } = useLandingExperience();

  const modules = Array.from(landingModules);

  const activeModule =
    modules.find((module) => String(module) === selectedModule) ??
    selectedModule;

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ?? branchHealth[0];

  const activeModuleName = getText(
    activeModule,
    ["name", "label", "title"],
    String(selectedModule).split("-").join(" ").toUpperCase(),
  );

  const branchName = branch?.name ?? "Active branch";

  const businessName = getText(
    demoBusiness,
    ["company", "name", "businessName"],
    "ShopCore Retail Group",
  );

  const activeWorkspaceProfile =
    workspaceProfiles.find(
      (workspace) => workspace.id === String(activeWorkspace),
    ) ??
    workspaceProfiles.find((workspace) =>
      workspace.modules.includes(String(selectedModule)),
    ) ??
    workspaceProfiles[0];

  const synchronizedWorkspaces = workspaceProfiles.map((workspace) => ({
    ...workspace,
    isActive:
      workspace.id === activeWorkspaceProfile.id ||
      workspace.modules.includes(String(selectedModule)),
  }));

  const notifications = activityFeed.slice(0, 3).map((event, index) => ({
    id: event.id ?? `signal-${index}`,
    title: event.title,
    message: event.detail,
  }));

  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(124,58,237,0.08),transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
            Workspace ecosystem
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
            Every role works inside one connected retail operating system.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
            {businessName} gives every team a focused workspace while{" "}
            {branchName} stays synchronized with {activeModuleName} intelligence.
          </p>
        </div>

        <WindowFrame
          title="Enterprise Workspace Ecosystem"
          eyebrow={`${branchName} · ${activeModuleName}`}
          icon={BriefcaseBusiness}
          status={demoMode ? "Live demo" : "Unified"}
          statusTone={moduleTone[String(selectedModule)] ?? "blue"}
          bodyClassName="bg-muted/70 p-4 sm:p-5"
        >
          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Active workspace"
              value={activeWorkspaceProfile.name}
              icon={activeWorkspaceProfile.icon}
              trend="Synchronized"
              trendDirection="up"
              caption={activeWorkspaceProfile.role}
            />

            <StatCard
              label="Branch context"
              value={branchName}
              icon={Building2}
              trend="Connected"
              trendDirection="up"
              caption="Shared business state"
            />

            <StatCard
              label="Workspace orders"
              value={metrics.orders}
              icon={RefreshCcw}
              trend="Healthy"
              trendDirection="up"
              caption="One operating flow"
            />

            <StatCard
              label="Governance"
              value="RBAC"
              icon={ShieldCheck}
              trend="Protected"
              trendDirection="up"
              caption="Roles and permissions"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Role-based operating model
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900 dark:!text-blue-100">
                    {activeModuleName} routes work to the right teams.
                  </h3>
                </div>

                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {synchronizedWorkspaces.map((workspace) => {
                  const Icon = workspace.icon;

                  return (
                    <div
                      key={workspace.id}
                      className={[
                        "rounded-2xl border p-4 transition",
                        workspace.isActive
                          ? "border-border bg-muted shadow-sm"
                          : "border-border bg-muted",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={[
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                            toneIcon[workspace.tone],
                          ].join(" ")}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                              {workspace.name}
                            </p>

                            {workspace.isActive ? (
                              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                                Active
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                            {workspace.role}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {workspace.tools.map((tool) => (
                          <span
                            key={`${workspace.id}-${tool}`}
                            className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Device continuity
                </p>

                <div className="mt-4 space-y-3">
                  {deviceRows.map((device) => {
                    const Icon = device.icon;

                    return (
                      <div
                        key={device.label}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/80 px-3 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center text-foreground">
                            <Icon className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                              {device.label}
                            </p>
                            <p className="text-xs font-medium text-muted-foreground">
                              {device.value}
                            </p>
                          </div>
                        </div>

                        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-200" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <Database className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                      One shared operating layer
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-200">
                      <AnimatedCounter value={metrics.customers} /> customers,{" "}
                      <AnimatedCounter value={metrics.orders} /> orders and{" "}
                      <AnimatedCounter value={metrics.receipts} /> receipts move
                      through one synchronized operating model.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center text-foreground">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                      Live workspace signals
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Context from {branchName}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {notifications.map((notification, index) => (
                    <div
                      key={`${notification.id}-${index}`}
                      className="rounded-2xl border border-border/50 bg-muted/50 px-3 py-2"
                    >
                      <p className="text-xs font-black text-foreground">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <WorkflowEngine
              title="Live collaboration flow"
              subtitle="The active module updates each connected workspace in sequence."
            />
          </div>

          <div className="mt-4 rounded-3xl border border-border bg-muted p-5">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 items-center justify-center text-foreground">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                  Workspace engine connected to the shared business state
                </p>
                <p className="mt-1 text-xs font-medium leading-6 text-blue-700 dark:text-blue-200">
                  This section responds to the selected module, active branch,
                  active workspace, demo mode, live metrics and synchronized
                  workspace signals.
                </p>
              </div>
            </div>
          </div>
        </WindowFrame>
      </div>
    </section>
  );
}