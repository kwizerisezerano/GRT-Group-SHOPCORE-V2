import {
  BadgeCheck,
  Building2,
 CheckCircle2,
 ClipboardCheck,
 Database,
 FileCheck2,
 Fingerprint,
 Globe2,
 LockKeyhole,
 ReceiptText,
 Scale,
 ServerCog,
 ShieldCheck,
} from "lucide-react";

type ComplianceTone = "trust" | "legal" | "success";

type ComplianceFrameworkProps = {
  tone?: ComplianceTone;
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
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
  legal: {
    accent: "text-blue-700 dark:text-blue-200",
    executiveAccent: "text-blue-600 dark:text-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    executiveIcon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
  success: {
    accent: "text-blue-700 dark:text-blue-200",
    executiveAccent: "text-blue-600 dark:text-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    executiveIcon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
};

const frameworks = [
  {
    icon: ShieldCheck,
    name: "Information Security",
    description:
      "Security controls, authentication, authorization, audit visibility, operational governance, and access accountability.",
    status: "Designed",
  },
  {
    icon: Globe2,
    name: "Privacy Principles",
    description:
      "Purpose limitation, tenant ownership, controlled processing, transparency, and administrative responsibility.",
    status: "Implemented",
  },
  {
    icon: LockKeyhole,
    name: "Identity Governance",
    description:
      "Role-based access, tenant isolation, permission boundaries, device awareness, and session monitoring.",
    status: "Implemented",
  },
  {
    icon: Database,
    name: "Business Data",
    description:
      "Controlled operational records, synchronization, retention, and audit-ready business information.",
    status: "Operational",
  },
  {
    icon: ReceiptText,
    name: "Financial Operations",
    description:
      "Billing, subscriptions, invoices, taxation workflows, payment visibility, and business accountability.",
    status: "Operational",
  },
  {
    icon: Building2,
    name: "Tenant Governance",
    description:
      "Workspace ownership, memberships, enterprise administration, support access, and organizational controls.",
    status: "Operational",
  },
];

const readiness = [
  {
    icon: FileCheck2,
    title: "Policy Governance",
    value: "Ready",
  },
  {
    icon: Fingerprint,
    title: "Identity Controls",
    value: "Ready",
  },
  {
    icon: ServerCog,
    title: "Operational Monitoring",
    value: "Ready",
  },
  {
    icon: ClipboardCheck,
    title: "Audit Visibility",
    value: "Ready",
  },
];

export default function ComplianceFramework({
  tone = "trust",
  title = "Enterprise compliance framework",
  description = "ShopCore is engineered around governance, accountability, operational resilience, tenant isolation, and secure business operations. The platform continuously evolves to support internationally recognized operational and security practices alongside applicable local regulatory obligations.",
}: ComplianceFrameworkProps) {
  const style = toneStyles[tone];

  return (
    <section className="border-b border-border bg-background px-5 py-10 sm:px-6 lg:py-16 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl">

        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">

          <div>

            <p
              className={[
                "text-xs font-black uppercase tracking-[0.22em]",
                style.accent,
              ].join(" ")}
            >
              Enterprise governance
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {title}
            </h2>

            <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="mt-8 space-y-3">

              {readiness.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border bg-muted p-4 dark:border-white/10 dark:bg-slate-800"
                  >
                    <div className="flex items-center justify-between">

                      <div className="flex items-center gap-3">

                        <div
                          className={[
                            "flex h-10 w-10 items-center justify-center rounded-xl border",
                            style.icon,
                          ].join(" ")}
                        >
                          <Icon className="h-5 w-5"/>
                        </div>

                        <div>

                          <p className="text-sm font-black text-slate-950 dark:text-white">
                            {item.title}
                          </p>

                        </div>

                      </div>

                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-black",
                          style.chip,
                        ].join(" ")}
                      >
                        {item.value}
                      </span>

                    </div>
                  </div>
                );
              })}

            </div>

          </div>

          <div
            className={[
              "overflow-hidden rounded-[26px] bg-gradient-to-br p-6 text-slate-950 dark:text-white",
              style.panel,
            ].join(" ")}
          >

            <div className="flex items-center justify-between border-b border-slate-200/10 pb-5 dark:border-white/10">

              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/45">
                  Governance Framework
                </p>

                <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                  Enterprise readiness overview
                </h3>

              </div>

              <div
                className={[
                  "flex h-11 w-11 items-center justify-center rounded-xl border",
                  style.executiveIcon,
                ].join(" ")}
              >
                <Scale className="h-5 w-5"/>
              </div>

            </div>

            <div className="mt-5 grid gap-3">

              {frameworks.map((framework) => {

                const Icon = framework.icon;

                return (

                  <div
                    key={framework.name}
                    className="rounded-2xl border border-slate-200/10 bg-transparent p-4 dark:border-white/10"
                  >

                    <div className="flex gap-3">

                      <div
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-xl border",
                          style.executiveIcon,
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5"/>
                      </div>

                      <div className="flex-1">

                        <div className="flex items-center justify-between gap-3">

                          <h4 className="text-sm font-black text-slate-950 dark:text-white">
                            {framework.name}
                          </h4>

                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200">
                            <CheckCircle2 className="h-3 w-3"/>
                            {framework.status}
                          </span>

                        </div>

                        <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-white/65">
                          {framework.description}
                        </p>

                      </div>

                    </div>

                  </div>

                );

              })}

            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-800">

              <div className="flex items-center gap-3">

                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-xl border",
                    style.icon,
                  ].join(" ")}
                >
                  <BadgeCheck className="h-5 w-5"/>
                </div>

                <div>

                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Continuous governance
                  </p>

                  <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-400">
                    ShopCore continues improving its operational governance,
                    security architecture, compliance capabilities, audit
                    visibility, infrastructure resilience, and enterprise
                    administration as the platform evolves.
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}