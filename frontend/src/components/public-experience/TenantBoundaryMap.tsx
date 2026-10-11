import {
  Activity,
  Building2,
  CheckCircle2,
  Database,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Layers3,
  LockKeyhole,
  Network,
  ServerCog,
  ShieldCheck,
  Store,
  UsersRound,
  Warehouse,
} from "lucide-react";

type TenantBoundaryTone = "trust" | "legal" | "success";

type TenantBoundaryMapProps = {
  tone?: TenantBoundaryTone;
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

const tenantCapabilities = [
  {
    icon: UsersRound,
    label: "People",
    detail: "Users, roles, permissions, invitations, and access responsibility.",
  },
  {
    icon: Store,
    label: "Operations",
    detail: "POS, customers, suppliers, staff, loyalty, and daily workflows.",
  },
  {
    icon: Warehouse,
    label: "Inventory",
    detail: "Products, warehouses, stock movements, counts, and transfers.",
  },
  {
    icon: Database,
    label: "Business records",
    detail: "Sales, purchases, expenses, reports, billing, and audit history.",
  },
];

const governanceControls = [
  {
    icon: Fingerprint,
    title: "Identity context",
    text: "Every request begins with a verified user and active session context.",
  },
  {
    icon: Building2,
    title: "Tenant scope",
    text: "Data access remains bound to the active organization and workspace.",
  },
  {
    icon: LockKeyhole,
    title: "Permission rules",
    text: "Roles and permissions determine which modules and actions are available.",
  },
  {
    icon: FileCheck2,
    title: "Audit visibility",
    text: "Sensitive activity is designed to remain traceable for governance and review.",
  },
];

const tenants = [
  {
    name: "Tenant Alpha",
    subtitle: "Retail network",
    branch: "3 branches",
    users: "42 users",
    tone: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-white",
  },
  {
    name: "Tenant Beta",
    subtitle: "Wholesale operations",
    branch: "5 warehouses",
    users: "68 users",
    tone: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-white",
  },
  {
    name: "Tenant Gamma",
    subtitle: "Pharmacy group",
    branch: "4 locations",
    users: "31 users",
    tone: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-white",
  },
];

export default function TenantBoundaryMap({
  tone = "trust",
  title = "Tenant isolation and workspace boundaries",
  description = "ShopCore is designed so every organization operates inside its own governed tenant context, with independent users, roles, modules, records, devices, billing, and audit visibility.",
}: TenantBoundaryMapProps) {
  const style = toneStyles[tone];

  return (
    <section className="border-b border-border bg-muted px-5 py-10 sm:px-6 lg:py-14 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:items-start">
          <div>
            <p
              className={[
                "text-xs font-black uppercase tracking-[0.22em]",
                style.accent,
              ].join(" ")}
            >
              Tenant governance
            </p>

            <h2 className="mt-4 max-w-3xl text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="mt-7 space-y-3">
              {governanceControls.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-white/10 dark:bg-slate-800"
                  >
                    <div className="flex gap-3">
                      <div
                        className={[
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                          style.icon,
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-slate-950 dark:text-white">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={[
              "relative overflow-hidden rounded-[26px] bg-gradient-to-br p-5 text-slate-950 dark:text-white shadow-sm",
              style.panel,
            ].join(" ")}
          >
            <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl dark:bg-white/10" />
            <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-blue-300/10 blur-3xl dark:bg-blue-300/10" />

            <div className="relative">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/10 pb-5 dark:border-white/10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/45">
                    ShopCore tenant fabric
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    Independent workspaces. Shared platform. No uncontrolled crossover.
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-slate-600 dark:text-white/60">
                    Platform services are shared, while tenant data, identities,
                    permissions, operational records, and audit contexts remain
                    separately governed.
                  </p>
                </div>

                <div
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                    style.executiveIcon,
                  ].join(" ")}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/10 bg-slate-100/10 p-4 dark:border-white/10 dark:bg-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-white/45">
                      Platform control plane
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                      Authentication, billing, monitoring, support, and governance
                    </p>
                  </div>

                  <ServerCog className={["h-6 w-6", style.executiveAccent].join(" ")} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  {[
                    "Authentication",
                    "Subscriptions",
                    "Monitoring",
                    "Support Access",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-slate-200/10 bg-slate-100/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-white/65"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-7">
                <div className="absolute left-1/2 top-0 hidden h-8 w-px -translate-x-1/2 bg-slate-200/20 lg:block dark:bg-white/20" />
                <div className="absolute left-[16.7%] right-[16.7%] top-8 hidden h-px bg-slate-200/20 lg:block dark:bg-white/20" />

                <div className="grid gap-4 pt-8 lg:grid-cols-3">
                  {tenants.map((tenant, tenantIndex) => (
                    <div
                      key={tenant.name}
                      className={[
                        "relative rounded-2xl border p-4",
                        tenant.tone,
                      ].join(" ")}
                    >
                      <div className="absolute left-1/2 -top-8 hidden h-8 w-px -translate-x-1/2 bg-slate-200/20 lg:block dark:bg-white/20" />

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-950 dark:text-white">
                            {tenant.name}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-white/55">
                            {tenant.subtitle}
                          </p>
                        </div>

                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/15 bg-slate-100/10 dark:border-white/15 dark:bg-white/10">
                          <Building2 className={["h-4 w-4", style.executiveAccent].join(" ")} />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-200/10 bg-slate-100/10 px-3 py-2 dark:border-white/10 dark:bg-white/10">
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
                            Footprint
                          </p>
                          <p className="mt-1 text-xs font-black text-slate-950 dark:text-white">
                            {tenant.branch}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200/10 bg-slate-100/10 px-3 py-2 dark:border-white/10 dark:bg-white/10">
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
                            Workforce
                          </p>
                          <p className="mt-1 text-xs font-black text-slate-950 dark:text-white">
                            {tenant.users}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {tenantCapabilities.map((capability) => {
                          const Icon = capability.icon;

                          return (
                            <div
                              key={capability.label}
                              className="rounded-xl border border-slate-200/10 bg-slate-100/10 p-3 dark:border-white/10 dark:bg-white/10"
                            >
                              <div className="flex gap-2">
                                <Icon className={["mt-0.5 h-4 w-4 shrink-0", style.executiveAccent].join(" ")} />
                                <div>
                                  <p className="text-xs font-black text-slate-950 dark:text-white">
                                    {capability.label}
                                  </p>
                                  <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500 dark:text-white/50">
                                    {capability.detail}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-200/10 pt-3 dark:border-white/10">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-white/50">
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
                          Isolated
                        </span>

                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-white/40">
                          Boundary {tenantIndex + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  { icon: KeyRound, label: "Independent credentials" },
                  { icon: LockKeyhole, label: "Independent permissions" },
                  { icon: Database, label: "Scoped business data" },
                  { icon: Activity, label: "Independent audit context" },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-200/10 bg-slate-100/10 p-3 dark:border-white/10 dark:bg-white/10"
                    >
                      <Icon className={["h-4 w-4", style.executiveAccent].join(" ")} />
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-white/60">
                        {item.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">
                      Boundary posture
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                      Tenant-scoped access is the default operating context.
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-black",
                      style.chip,
                    ].join(" ")}
                  >
                    Enforced
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}