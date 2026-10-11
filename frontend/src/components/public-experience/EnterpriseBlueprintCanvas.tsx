import {
  Activity,
  BarChart3,
  Building2,
  CloudCog,
  Database,
  FileCheck2,
  Layers3,
  Network,
  Package,
  ReceiptText,
  ServerCog,
  ShieldCheck,
  ShoppingCart,
  UsersRound,
  Warehouse,
} from "lucide-react";

type BlueprintTone = "trust" | "legal" | "success";

type EnterpriseBlueprintCanvasProps = {
  tone?: BlueprintTone;
  title?: string;
  description?: string;
};

const toneStyles = {
  trust: {
    accent: "text-blue-700 dark:text-blue-200",
    executiveAccent: "text-blue-600 dark:text-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    executiveIcon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    line: "bg-blue-600/40 dark:bg-blue-300/40",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
  legal: {
    accent: "text-blue-700 dark:text-blue-200",
    executiveAccent: "text-blue-600 dark:text-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    executiveIcon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    line: "bg-blue-600/40 dark:bg-blue-300/40",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
  success: {
    accent: "text-blue-700 dark:text-blue-200",
    executiveAccent: "text-blue-600 dark:text-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    executiveIcon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    line: "bg-blue-600/40 dark:bg-blue-300/40",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
};

const blueprintLayers = [
  {
    label: "Cloud Foundation",
    detail: "Supabase, PostgreSQL, Storage, Realtime, Edge Functions",
    icon: CloudCog,
  },
  {
    label: "Platform Control Plane",
    detail: "Platform Admin, monitoring, billing, tenants, support access",
    icon: ServerCog,
  },
  {
    label: "Tenant Boundary",
    detail: "Organization workspace, subscriptions, roles, module access",
    icon: Building2,
  },
  {
    label: "Business Workspace",
    detail: "Branches, warehouses, staff, customers, suppliers, workflows",
    icon: Layers3,
  },
  {
    label: "Operating Modules",
    detail: "POS, inventory, procurement, reports, loyalty, expenses",
    icon: Network,
  },
  {
    label: "Governance Layer",
    detail: "Permissions, audit logs, device trust, offline synchronization",
    icon: ShieldCheck,
  },
];

const moduleNodes = [
  { label: "POS", icon: ShoppingCart },
  { label: "Inventory", icon: Package },
  { label: "Warehouses", icon: Warehouse },
  { label: "Customers", icon: UsersRound },
  { label: "EBM", icon: ReceiptText },
  { label: "Reports", icon: BarChart3 },
  { label: "Audit", icon: FileCheck2 },
  { label: "Sync", icon: Activity },
];

export default function EnterpriseBlueprintCanvas({
  tone = "trust",
  title = "Enterprise architecture blueprint",
  description = "A visual operating model showing how ShopCore connects cloud infrastructure, platform administration, tenant governance, business workspaces, operating modules, and security controls into one Business Operating System.",
}: EnterpriseBlueprintCanvasProps) {
  const style = toneStyles[tone];

  return (
    <section className="border-b border-border bg-background px-5 py-10 sm:px-6 lg:py-14 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[26px] border border-border bg-card shadow-sm dark:bg-slate-900">
        <div className="grid gap-0 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="bg-muted p-6 sm:p-8 dark:bg-slate-800">
            <p
              className={[
                "text-xs font-black uppercase tracking-[0.22em]",
                style.accent,
              ].join(" ")}
            >
              Operating blueprint
            </p>

            <h2 className="mt-4 max-w-3xl text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                "Cloud-first",
                "Tenant-governed",
                "Offline-ready",
                "Audit-visible",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-card p-5 dark:border-white/10 dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-xl border",
                    style.icon,
                  ].join(" ")}
                >
                  <Database className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Multi-tenant architecture
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Built for workspace governance and enterprise operations.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card p-5 sm:p-6 dark:bg-slate-800">
            <div
              className={[
                "relative overflow-hidden rounded-[22px] bg-gradient-to-br p-5 text-slate-950 dark:text-white",
                style.panel,
              ].join(" ")}
            >
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl dark:bg-white/10" />
              <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-blue-300/10 blur-3xl dark:bg-blue-300/10" />

              <div className="relative mb-5 flex items-center justify-between border-b border-slate-200/10 pb-4 dark:border-white/10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/45">
                    ShopCore Business OS
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    Platform topology
                  </h3>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/15 bg-slate-100/10 dark:border-white/15 dark:bg-white/10">
                  <Database
                    className={["h-5 w-5", style.executiveAccent].join(" ")}
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-5 top-8 hidden h-[calc(100%-4rem)] w-px bg-slate-200/10 md:block dark:bg-white/10" />

                <div className="space-y-3">
                  {blueprintLayers.map((layer, index) => {
                    const Icon = layer.icon;

                    return (
                      <div
                        key={layer.label}
                        className="relative rounded-2xl border border-slate-200/10 bg-slate-100/10 p-4 dark:border-white/10 dark:bg-white/10"
                      >
                        <div className="flex gap-3">
                          <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/15 bg-slate-100/10 dark:border-white/15 dark:bg-white/10">
                            <Icon
                              className={[
                                "h-5 w-5",
                                style.executiveAccent,
                              ].join(" ")}
                            />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-black text-slate-950 dark:text-white">
                                {layer.label}
                              </h4>

                              <span className="rounded-full border border-slate-200/10 bg-slate-100/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-white/45">
                                Layer {index + 1}
                              </span>
                            </div>

                            <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-white/60">
                              {layer.detail}
                            </p>
                          </div>
                        </div>

                        {index < blueprintLayers.length - 1 ? (
                          <div
                            className={[
                              "absolute -bottom-3 left-[2.45rem] hidden h-6 w-px md:block",
                              style.line,
                            ].join(" ")}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative mt-5 rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Connected operating modules
                  </p>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-black",
                      style.chip,
                    ].join(" ")}
                  >
                    Topology
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  {moduleNodes.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-border bg-muted p-3 dark:border-white/10 dark:bg-slate-800"
                      >
                        <Icon
                          className={["h-5 w-5", style.accent].join(" ")}
                        />
                        <p className="mt-2 truncate text-xs font-black text-slate-700 dark:text-slate-200">
                          {item.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}