import {
  Archive,
  CheckCircle2,
  Database,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type DataLifecycleTone = "trust" | "legal" | "success";

type DataLifecycleMapProps = {
  tone?: DataLifecycleTone;
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

const lifecycleSteps = [
  {
    label: "Collect",
    detail: "Business records enter ShopCore through users, modules, imports, integrations, desktop activity, and workspace operations.",
    icon: Database,
  },
  {
    label: "Validate",
    detail: "Tenant context, required fields, role permissions, subscription state, and operational rules are checked before processing.",
    icon: CheckCircle2,
  },
  {
    label: "Protect",
    detail: "Identity, role control, tenant boundaries, secure sessions, and device awareness govern access to sensitive activity.",
    icon: LockKeyhole,
  },
  {
    label: "Process",
    detail: "ERP workflows handle sales, inventory, purchases, billing, reporting, support, synchronization, and administration.",
    icon: RefreshCcw,
  },
  {
    label: "Audit",
    detail: "Sensitive actions are designed to remain traceable for governance, support, security review, and operational accountability.",
    icon: FileCheck2,
  },
  {
    label: "Retain",
    detail: "Records remain available according to tenant operations, business needs, legal obligations, configuration, and product capability.",
    icon: Archive,
  },
  {
    label: "Review",
    detail: "Authorized administrators can review access, users, sessions, devices, reports, support activity, and operational records.",
    icon: Fingerprint,
  },
  {
    label: "Remove",
    detail: "Eligible data may be corrected, exported, archived, restricted, or removed through authorized administrative or support workflows.",
    icon: Trash2,
  },
];

const controlPoints = [
  "Tenant boundary",
  "Role validation",
  "Session posture",
  "Offline queue",
  "Audit trail",
  "Support access",
];

export default function DataLifecycleMap({
  tone = "trust",
  title = "Business data lifecycle",
  description = "ShopCore treats data protection as an operating lifecycle: from collection and validation to processing, audit, retention, review, and authorized removal.",
}: DataLifecycleMapProps) {
  const style = toneStyles[tone];

  return (
    <section className="border-b border-border bg-muted px-5 py-10 sm:px-6 lg:py-14 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[26px] border border-border bg-card shadow-sm dark:bg-slate-900">
        <div className="grid gap-0 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="bg-card p-6 sm:p-8 dark:bg-slate-800">
            <p
              className={[
                "text-xs font-black uppercase tracking-[0.22em]",
                style.accent,
              ].join(" ")}
            >
              Data lifecycle
            </p>

            <h2 className="mt-4 max-w-3xl text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="mt-7 rounded-2xl border border-border bg-muted p-5 dark:border-white/10 dark:bg-slate-800">
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                    style.icon,
                  ].join(" ")}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Governed from entry to removal
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                    Data movement should remain tied to identity, tenant
                    context, permissions, operational purpose, audit visibility,
                    and authorized administrative workflows.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {controlPoints.map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                >
                  {item}
                </div>
              ))}
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
                    Data operating lifecycle
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    From collection to controlled removal
                  </h3>
                </div>

                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-xl border",
                    style.executiveIcon,
                  ].join(" ")}
                >
                  <Database className="h-5 w-5" />
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-5 top-8 hidden h-[calc(100%-4rem)] w-px bg-slate-200/10 md:block dark:bg-white/10" />

                <div className="space-y-3">
                  {lifecycleSteps.map((step, index) => {
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.label}
                        className="relative rounded-2xl border border-slate-200/10 bg-transparent p-4 dark:border-white/10"
                      >
                        <div className="flex gap-3">
                          <div
                            className={[
                              "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                              style.executiveIcon,
                            ].join(" ")}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-black text-slate-950 dark:text-white">
                                {step.label}
                              </h4>

                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-100">
                                Phase {index + 1}
                              </span>
                            </div>

                            <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-white/60">
                              {step.detail}
                            </p>
                          </div>
                        </div>

                        {index < lifecycleSteps.length - 1 ? (
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
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Lifecycle posture
                  </p>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-black",
                      style.chip,
                    ].join(" ")}
                  >
                    Controlled
                  </span>
                </div>

                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                  Every stage should remain connected to purpose limitation,
                  administrative control, tenant scope, and accountable business
                  operation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}