import {
  Activity,
  Building2,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  MonitorCheck,
  Network,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

type IdentityJourneyTone = "trust" | "legal" | "success";

type IdentityJourneyTimelineProps = {
  tone?: IdentityJourneyTone;
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
    executiveIcon:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    line: "bg-blue-600/40 dark:bg-blue-300/40",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
};

const journeySteps = [
  {
    icon: UserCheck,
    title: "Identity created",
    text: "A user account is created, invited, or provisioned for an authorized business role.",
    state: "Registered",
  },
  {
    icon: Fingerprint,
    title: "Authentication",
    text: "Credentials, cached access, session state, and device context are evaluated before entry.",
    state: "Verified",
  },
  {
    icon: Building2,
    title: "Tenant association",
    text: "The user is connected to the correct organization, workspace, branch, and membership context.",
    state: "Scoped",
  },
  {
    icon: LockKeyhole,
    title: "Authorization",
    text: "Roles, permissions, module entitlements, subscription state, and administrative boundaries are applied.",
    state: "Controlled",
  },
  {
    icon: Network,
    title: "Business operation",
    text: "The user can access approved modules, workflows, records, reports, and operational tools.",
    state: "Active",
  },
  {
    icon: MonitorCheck,
    title: "Session monitoring",
    text: "Device, app version, session posture, connectivity, and support activity can be reviewed.",
    state: "Observed",
  },
  {
    icon: FileCheck2,
    title: "Audit visibility",
    text: "Sensitive actions remain traceable for security, governance, support, and accountability.",
    state: "Recorded",
  },
  {
    icon: Activity,
    title: "Access lifecycle",
    text: "Sessions may be renewed, revoked, blocked, expired, or reviewed through administrative controls.",
    state: "Governed",
  },
];

const lifecycleControls = [
  {
    icon: KeyRound,
    label: "Credential protection",
  },
  {
    icon: Building2,
    label: "Tenant scope",
  },
  {
    icon: LockKeyhole,
    label: "Permission enforcement",
  },
  {
    icon: FileCheck2,
    label: "Audit review",
  },
];

export default function IdentityJourneyTimeline({
  tone = "trust",
  title = "Identity and access journey",
  description = "ShopCore governs user access as a complete lifecycle, from account creation and authentication to tenant scope, authorization, monitoring, audit, and access termination.",
}: IdentityJourneyTimelineProps) {
  const style = toneStyles[tone];

  return (
    <section className="border-b border-border bg-background px-5 py-10 sm:px-6 lg:py-14 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div>
            <p
              className={[
                "text-xs font-black uppercase tracking-[0.22em]",
                style.accent,
              ].join(" ")}
            >
              Identity governance
            </p>

            <h2 className="mt-4 max-w-3xl text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {lifecycleControls.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-muted p-4 dark:border-white/10 dark:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-xl border",
                          style.icon,
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                        {item.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-muted p-5 dark:border-white/10 dark:bg-slate-800">
              <div className="flex gap-3">
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
                    Access is never treated as a single login event
                  </p>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                    Identity, session posture, tenant context, permissions,
                    device trust, and audit history work together throughout the
                    user lifecycle.
                  </p>
                </div>
              </div>
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
                    Identity control path
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    From account creation to governed access
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-slate-600 dark:text-white/60">
                    Each step adds context, control, and traceability before a
                    user can operate inside the business workspace.
                  </p>
                </div>

                <div
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                    style.executiveIcon,
                  ].join(" ")}
                >
                  <Fingerprint className="h-5 w-5" />
                </div>
              </div>

              <div className="relative mt-6">
                <div className="absolute left-[1.15rem] top-5 hidden h-[calc(100%-2.5rem)] w-px bg-slate-200/15 md:block dark:bg-white/15" />

                <div className="space-y-3">
                  {journeySteps.map((step, index) => {
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.title}
                        className="relative rounded-2xl border border-slate-200/10 bg-slate-100/10 p-4 dark:border-white/10 dark:bg-white/10"
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

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-black text-slate-950 dark:text-white">
                                  {step.title}
                                </h4>

                                <span className="rounded-full border border-slate-200/10 bg-slate-100/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-white/45">
                                  Step {index + 1}
                                </span>
                              </div>

                              <span
                                className={[
                                  "rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]",
                                  style.executiveIcon,
                                ].join(" ")}
                              >
                                {step.state}
                              </span>
                            </div>

                            <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-white/60">
                              {step.text}
                            </p>
                          </div>
                        </div>

                        {index < journeySteps.length - 1 ? (
                          <div
                            className={[
                              "absolute -bottom-3 left-[1.2rem] hidden h-6 w-px md:block",
                              style.line,
                            ].join(" ")}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">
                      Identity posture
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                      Access remains contextual, monitored, and revocable.
                    </p>
                  </div>

                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black",
                      style.chip,
                    ].join(" ")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Governed
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