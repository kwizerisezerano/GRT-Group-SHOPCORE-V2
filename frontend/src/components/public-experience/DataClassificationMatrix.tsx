import {
  BarChart3,
  Building2,
  Database,
  FileCheck2,
  Fingerprint,
  Globe2,
  HardDrive,
  LockKeyhole,
  ReceiptText,
  ServerCog,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

type MatrixTone = "trust" | "legal" | "success";

type DataClassificationMatrixProps = {
  tone?: MatrixTone;
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

const rows = [
  {
    icon: Fingerprint,
    category: "Identity",
    level: "Critical",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
    examples: "Users, authentication, MFA, sessions, invitations",
    protection:
      "Identity verification, tenant isolation, role enforcement, audit visibility",
  },
  {
    icon: Building2,
    category: "Tenant",
    level: "Restricted",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
    examples: "Organizations, subscriptions, licenses, workspaces",
    protection:
      "Administrative ownership, permission validation, workspace boundaries",
  },
  {
    icon: Database,
    category: "Business Data",
    level: "Confidential",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
    examples:
      "Sales, inventory, procurement, warehouses, customers, suppliers",
    protection:
      "Role-controlled access, offline validation, synchronization governance",
  },
  {
    icon: ReceiptText,
    category: "Financial",
    level: "Restricted",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
    examples:
      "Invoices, billing, payments, taxation, subscriptions, EBM",
    protection:
      "Administrative approval, audit logging, financial traceability",
  },
  {
    icon: ServerCog,
    category: "Infrastructure",
    level: "Internal",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
    examples:
      "Storage, monitoring, diagnostics, synchronization, services",
    protection:
      "Platform administration, operational monitoring, controlled maintenance",
  },
  {
    icon: BarChart3,
    category: "Analytics",
    level: "Business",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
    examples:
      "Reports, KPIs, trends, forecasting, operational intelligence",
    protection:
      "Aggregated business visibility respecting tenant isolation",
  },
];

const principles = [
  {
    icon: ShieldCheck,
    title: "Purpose limitation",
    text: "Every category exists only to operate, secure, and improve the platform.",
  },
  {
    icon: LockKeyhole,
    title: "Least privilege",
    text: "Users access only information required for their assigned responsibilities.",
  },
  {
    icon: HardDrive,
    title: "Operational continuity",
    text: "Offline execution preserves business continuity while maintaining governance.",
  },
  {
    icon: Globe2,
    title: "Tenant separation",
    text: "Organizations remain isolated from one another throughout the platform.",
  },
];

export default function DataClassificationMatrix({
  tone = "trust",
}: DataClassificationMatrixProps) {
  const style = toneStyles[tone];

  return (
    <section className="border-b border-border bg-background px-5 py-10 sm:px-6 lg:py-14 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[26px] border border-border bg-card shadow-sm dark:bg-slate-900">

        <div className="grid lg:grid-cols-[0.78fr_1.22fr]">

          <div className="bg-muted p-7 dark:bg-slate-800">

            <p
              className={[
                "text-xs font-black uppercase tracking-[0.22em]",
                style.accent,
              ].join(" ")}
            >
              Data Classification
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              Information governance matrix
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              ShopCore classifies operational information according to
              business sensitivity, governance responsibility,
              operational value, and administrative visibility.
            </p>

            <div className="mt-8 space-y-4">

              {principles.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-slate-800"
                  >
                    <div className="flex gap-3">

                      <div
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-xl border",
                          style.icon,
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5"/>
                      </div>

                      <div>

                        <h3 className="text-sm font-black text-slate-950 dark:text-white">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                          {item.text}
                        </p>

                      </div>

                    </div>
                  </div>
                );
              })}

            </div>

          </div>

          <div className="p-6">

            <div
              className={[
                "overflow-hidden rounded-[22px] bg-gradient-to-br p-6 text-slate-950 dark:text-white",
                style.panel,
              ].join(" ")}
            >

              <div className="mb-6 flex items-center justify-between">

                <div>

                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/45">
                    Governance Matrix
                  </p>

                  <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    Enterprise Classification
                  </h3>

                </div>

                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-xl border",
                    style.executiveIcon,
                  ].join(" ")}
                >
                  <Database className="h-5 w-5"/>
                </div>

              </div>

              <div className="overflow-hidden rounded-2xl bg-card dark:bg-slate-800">

                <table className="w-full">

                  <thead className="bg-muted dark:bg-slate-800">

                    <tr className="text-left">

                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Category
                      </th>

                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Level
                      </th>

                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Protection
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {rows.map((row) => {

                      const Icon = row.icon;

                      return (

                        <tr
                          key={row.category}
                          className="border-t border-border align-top dark:border-slate-700"
                        >

                          <td className="px-4 py-4">

                            <div className="flex gap-3">

                              <div
                                className={[
                                  "flex h-10 w-10 items-center justify-center rounded-xl border",
                                  style.icon,
                                ].join(" ")}
                              >
                                <Icon className="h-5 w-5"/>
                              </div>

                              <div>

                                <p className="font-black text-slate-900 dark:text-white">
                                  {row.category}
                                </p>

                                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                  {row.examples}
                                </p>

                              </div>

                            </div>

                          </td>

                          <td className="px-4 py-4">

                            <span
                              className={[
                                "rounded-full px-3 py-1 text-xs font-black",
                                row.color,
                              ].join(" ")}
                            >
                              {row.level}
                            </span>

                          </td>

                          <td className="px-4 py-4">

                            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {row.protection}
                            </p>

                          </td>

                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}