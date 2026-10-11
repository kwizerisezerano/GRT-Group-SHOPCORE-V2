import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileWarning,
  Headphones,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MessageSquare,
  MonitorCheck,
  Network,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from "lucide-react";

type ResponseTone = "trust" | "legal" | "success";

type SecurityResponseCenterProps = {
  tone?: ResponseTone;
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
    action: "bg-blue-600 hover:bg-blue-700",
  },
  legal: {
    accent: "text-blue-700 dark:text-blue-200",
    executiveAccent: "text-blue-600 dark:text-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    executiveIcon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
    action: "bg-blue-600 hover:bg-blue-700",
  },
  success: {
    accent: "text-blue-700 dark:text-blue-200",
    executiveAccent: "text-blue-600 dark:text-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    executiveIcon:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
    action: "bg-blue-600 hover:bg-blue-700",
  },
};

const responsePriorities = [
  {
    code: "P1",
    title: "Critical security or continuity incident",
    description:
      "Confirmed unauthorized access, tenant-wide outage, active data exposure, payment compromise, or loss of critical business access.",
    target: "Immediate triage",
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: Siren,
  },
  {
    code: "P2",
    title: "Major operational disruption",
    description:
      "POS interruption, synchronization failure, subscription blockage, desktop deployment failure, or multi-user workflow impact.",
    target: "Priority review",
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: AlertTriangle,
  },
  {
    code: "P3",
    title: "Standard support case",
    description:
      "Configuration issues, reporting concerns, permission errors, module behavior, device questions, or workflow assistance.",
    target: "Business support queue",
    tone: "border-blue-200 bg-blue-50 text-blue-700",
    icon: LifeBuoy,
  },
  {
    code: "P4",
    title: "Guidance and advisory",
    description:
      "Implementation planning, training, architecture review, data preparation, process design, or best-practice guidance.",
    target: "Advisory routing",
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: MessageSquare,
  },
];

const responseFlow = [
  {
    icon: FileWarning,
    title: "Report",
    text: "Provide the tenant, affected module, user, device, time, screenshots, and exact operational impact.",
  },
  {
    icon: ShieldAlert,
    title: "Classify",
    text: "The case is assessed by severity, security exposure, revenue impact, user scope, and continuity risk.",
  },
  {
    icon: Network,
    title: "Route",
    text: "The issue is assigned to business support, technical operations, security response, billing, or implementation.",
  },
  {
    icon: LockKeyhole,
    title: "Authorize",
    text: "Sensitive access requires explicit approval, limited scope, and accountable support handling.",
  },
  {
    icon: MonitorCheck,
    title: "Resolve",
    text: "The team investigates, validates the fix, documents the outcome, and restores normal operation.",
  },
  {
    icon: BadgeCheck,
    title: "Review",
    text: "Critical cases should include closure review, lessons learned, and follow-up controls where appropriate.",
  },
];

const secureReportingRules = [
  "Never share account passwords or unrestricted administrator credentials.",
  "Use authorized support channels for screenshots, logs, and business records.",
  "Remove unnecessary customer or financial details before sharing evidence.",
  "Grant temporary support access only for the minimum required scope.",
  "Revoke access after resolution and review the support audit trail.",
  "Report suspected data exposure or unauthorized access without delay.",
];

const operatingStatus = [
  {
    label: "Authentication",
    status: "Operational",
    icon: LockKeyhole,
  },
  {
    label: "Tenant workspaces",
    status: "Operational",
    icon: ShieldCheck,
  },
  {
    label: "Offline synchronization",
    status: "Monitored",
    icon: Activity,
  },
  {
    label: "Support routing",
    status: "Available",
    icon: Headphones,
  },
];

export default function SecurityResponseCenter({
  tone = "trust",
  title = "Security and operational response center",
  description = "A structured response framework for security concerns, access incidents, continuity risks, platform disruptions, and sensitive tenant support.",
}: SecurityResponseCenterProps) {
  const style = toneStyles[tone];

  return (
    <section className="border-b border-border bg-muted px-5 py-10 sm:px-6 lg:py-16 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <div>
            <p
              className={[
                "text-xs font-black uppercase tracking-[0.22em]",
                style.accent,
              ].join(" ")}
            >
              Response operations
            </p>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-white/10 dark:bg-slate-800">
              <div className="flex gap-3">
                <div
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                    style.icon,
                  ].join(" ")}
                >
                  <ShieldAlert className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Report urgent concerns immediately
                  </p>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                    Suspected unauthorized access, data exposure, payment abuse,
                    or critical business interruption should be classified with
                    the highest reasonable priority.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {operatingStatus.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "flex h-9 w-9 items-center justify-center rounded-xl border",
                          style.icon,
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                        {item.label}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-200">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                      {item.status}
                    </span>
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
                    Incident operations
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    Priority, routing, authorization, and resolution
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-slate-600 dark:text-white/60">
                    Every case should be classified by operational impact,
                    security risk, affected scope, and required response path.
                  </p>
                </div>

                <div
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                    style.executiveIcon,
                  ].join(" ")}
                >
                  <Siren className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {responsePriorities.map((priority) => {
                  const Icon = priority.icon;

                  return (
                    <article
                      key={priority.code}
                      className="rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={[
                            "flex h-10 w-10 items-center justify-center rounded-xl border",
                            priority.tone,
                          ].join(" ")}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <span
                          className={[
                            "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                            priority.tone,
                          ].join(" ")}
                        >
                          {priority.code}
                        </span>
                      </div>

                      <h4 className="mt-4 text-sm font-black text-slate-950 dark:text-white">
                        {priority.title}
                      </h4>

                      <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                        {priority.description}
                      </p>

                      <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3 text-xs font-black text-slate-700 dark:border-white/10 dark:text-slate-300">
                        <Clock3 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        {priority.target}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/10 bg-slate-100/10 p-4 dark:border-white/10 dark:bg-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Response workflow
                  </p>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-black",
                      style.executiveIcon,
                    ].join(" ")}
                  >
                    Controlled path
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {responseFlow.map((step, index) => {
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.title}
                        className="rounded-xl border border-slate-200/10 bg-slate-100/10 p-3 dark:border-white/10 dark:bg-white/10"
                      >
                        <div className="flex items-center justify-between">
                          <Icon
                            className={[
                              "h-4 w-4",
                              style.executiveAccent,
                            ].join(" ")}
                          />
                          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/35">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>

                        <p className="mt-3 text-xs font-black text-slate-950 dark:text-white">
                          {step.title}
                        </p>

                        <p className="mt-1 text-[10px] font-medium leading-4 text-slate-600 dark:text-white/50">
                          {step.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-xl border",
                        style.icon,
                      ].join(" ")}
                    >
                      <ShieldCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-black text-slate-950 dark:text-white">
                        Secure reporting requirements
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        Protect credentials and minimize unnecessary exposure.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {secureReportingRules.map((item) => (
                      <div key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                        <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-400">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/10 bg-slate-100/10 p-4 dark:border-white/10 dark:bg-white/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">
                    Contact channels
                  </p>

                  <div className="mt-4 space-y-3">
                    <Link
                      to="/auth"
                      className={[
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-black text-white transition",
                        style.action,
                      ].join(" ")}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Headphones className="h-4 w-4" />
                        Tenant support
                      </span>
                      <span>→</span>
                    </Link>

                    <Link
                      to="/support-center"
                      className="flex items-center justify-between rounded-xl border border-slate-200/15 bg-slate-100/10 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200/10 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                    >
                      <span className="inline-flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Public support
                      </span>
                      <span>→</span>
                    </Link>

                    <div className="rounded-xl border border-slate-200/15 bg-slate-100/10 px-4 py-3 dark:border-white/15 dark:bg-white/10">
                      <div className="flex items-center gap-2">
                        <Mail
                          className={[
                            "h-4 w-4",
                            style.executiveAccent,
                          ].join(" ")}
                        />
                        <span className="text-xs font-black text-slate-950 dark:text-white">
                          Privacy & security office
                        </span>
                      </div>

                      <p className="mt-2 text-[10px] font-medium leading-4 text-slate-600 dark:text-white/50">
                        Use the authorized ShopCore contact channel assigned to
                        your tenant, contract, or implementation team.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">
                      Response posture
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                      Sensitive incidents require controlled access and
                      documented resolution.
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-black",
                      style.chip,
                    ].join(" ")}
                  >
                    Response ready
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