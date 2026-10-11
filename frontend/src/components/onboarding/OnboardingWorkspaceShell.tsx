import type {
  ElementType,
  ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

type ShellMode =
  | "payment"
  | "activation";

export type OnboardingProgressStep = {
  label: string;
  complete: boolean;
};

type SummaryItem = {
  icon: ElementType;
  label: string;
  value: string;
};

type OnboardingWorkspaceShellProps = {
  mode: ShellMode;
  children: ReactNode;

  tenantName?: string | null;
  subscriptionPlan?: string | null;
  billingCycle?: string | null;
  workspaceAccessStatus?: string | null;

  progressSteps?: OnboardingProgressStep[];

  sidebarEyebrow?: string;
  sidebarTitle?: string;
  sidebarDescription?: string;

  headerLabel?: string;
  homePath?: string;

  summaryItems?: SummaryItem[];

  footerTitle?: string;
  footerDescription?: string;

  sidebarFooter?: ReactNode;
};

function formatLabel(
  value: string | null | undefined,
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

const modeConfiguration: Record<
  ShellMode,
  {
    headerLabel: string;
    sidebarEyebrow: string;
    sidebarTitle: string;
    sidebarDescription: string;
    footerTitle: string;
    footerDescription: string;
  }
> = {
  payment: {
    headerLabel:
      "Protected subscription payment",
    sidebarEyebrow:
      "Commercial activation center",
    sidebarTitle:
      "Complete billing verification before operational access begins.",
    sidebarDescription:
      "ShopCore verifies your workspace, selected edition, billing cycle, invoice, and payment attempt before activating protected business operations.",
    footerTitle:
      "Trusted payment workflow",
    footerDescription:
      "Payments are confirmed through trusted provider responses, administrative verification, or secured backend processes. Customer interfaces cannot activate their own subscriptions.",
  },

  activation: {
    headerLabel:
      "Protected workspace activation",
    sidebarEyebrow:
      "Activation control center",
    sidebarTitle:
      "Secure access begins after commercial verification.",
    sidebarDescription:
      "ShopCore confirms workspace ownership, package assignment, billing status, and access authorization before protected operations are released.",
    footerTitle:
      "Trusted activation process",
    footerDescription:
      "Payment and trial approvals may require Platform Administration or payment-provider verification. Workspace access becomes available only after the trusted activation process completes.",
  },
};

export default function OnboardingWorkspaceShell({
  mode,
  children,

  tenantName,
  subscriptionPlan,
  billingCycle,
  workspaceAccessStatus,

  progressSteps = [],

  sidebarEyebrow,
  sidebarTitle,
  sidebarDescription,

  headerLabel,
  homePath = "/",

  summaryItems,

  footerTitle,
  footerDescription,

  sidebarFooter,
}: OnboardingWorkspaceShellProps) {
  const configuration =
    modeConfiguration[mode];

  const resolvedSteps =
    progressSteps.length > 0
      ? progressSteps
      : defaultSteps(mode);

  const completedSteps =
    resolvedSteps.filter(
      (step) => step.complete,
    ).length;

  const progressPercentage =
    resolvedSteps.length > 0
      ? Math.round(
          (completedSteps /
            resolvedSteps.length) *
            100,
        )
      : 0;

  const defaultSummaryItems: SummaryItem[] =
    [
      {
        icon: Building2,
        label: "Workspace identity",
        value:
          tenantName ||
          "Workspace pending",
      },
      {
        icon: PackageCheck,
        label: "Commercial edition",
        value: formatLabel(
          subscriptionPlan,
          "Package pending",
        ),
      },
      {
        icon: WalletCards,
        label: "Billing cycle",
        value: formatLabel(
          billingCycle,
          "Monthly",
        ),
      },
      {
        icon: LockKeyhole,
        label: "Access boundary",
        value: formatLabel(
          workspaceAccessStatus,
          "Verification pending",
        ),
      },
    ];

  const resolvedSummaryItems =
    summaryItems?.length
      ? summaryItems
      : defaultSummaryItems;

  return (
    <main className="min-h-screen bg-[#d7dce2] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1420px]">
        <div className="overflow-hidden rounded-[28px] border border-slate-300/70 bg-[#f5f7fa] shadow-[0_35px_100px_-55px_rgba(15,23,42,0.75)]">
          <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>

            <div className="hidden items-center gap-2 text-center sm:flex">
              <ShieldCheck className="h-4 w-4 text-blue-700" />

              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {headerLabel ||
                  configuration.headerLabel}
              </p>
            </div>

            <Link
              to={homePath}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
          </header>

          <div className="grid min-h-[calc(100vh-7rem)] xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="relative overflow-hidden bg-[#080d1a] p-6 text-white sm:p-8">
              <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

              <div className="relative flex h-full flex-col">
                <Link
                  to={homePath}
                  className="inline-flex items-center gap-3"
                >
                  <img
                    src="/shopcore-icon.png"
                    alt="ShopCore"
                    className="h-12 w-12 object-contain"
                  />

                  <div>
                    <p className="text-lg font-black leading-tight">
                      ShopCore
                    </p>

                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                      Business Operating System
                    </p>
                  </div>
                </Link>

                <div className="mt-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                    {sidebarEyebrow ||
                      configuration.sidebarEyebrow}
                  </p>

                  <h1 className="mt-4 text-2xl font-black leading-tight tracking-[-0.02em]">
                    {sidebarTitle ||
                      configuration.sidebarTitle}
                  </h1>

                  <p className="mt-4 text-sm font-medium leading-7 text-white/55">
                    {sidebarDescription ||
                      configuration.sidebarDescription}
                  </p>
                </div>

                <div className="mt-8 space-y-3">
                  {resolvedSummaryItems.map(
                    (item) => (
                      <WorkspaceSummaryItem
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        value={item.value}
                      />
                    ),
                  )}
                </div>

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                      {mode === "payment"
                        ? "Payment progress"
                        : "Activation progress"}
                    </p>

                    <p className="text-xs font-black text-cyan-300">
                      {progressPercentage}%
                    </p>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                      style={{
                        width: `${progressPercentage}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {resolvedSteps.map(
                      (step) => (
                        <div
                          key={step.label}
                          className="flex items-center gap-2.5"
                        >
                          {step.complete ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                          ) : (
                            <Clock3 className="h-4 w-4 shrink-0 text-white/30" />
                          )}

                          <span
                            className={[
                              "text-xs font-semibold",
                              step.complete
                                ? "text-white/75"
                                : "text-white/35",
                            ].join(" ")}
                          >
                            {step.label}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {sidebarFooter ? (
                  <div className="mt-6">
                    {sidebarFooter}
                  </div>
                ) : null}

                <div className="mt-auto pt-8">
                  <div className="flex items-start gap-3 border-t border-white/10 pt-5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />

                    <div>
                      <p className="text-xs font-black text-white/75">
                        {footerTitle ||
                          configuration.footerTitle}
                      </p>

                      <p className="mt-1 text-xs font-medium leading-5 text-white/40">
                        {footerDescription ||
                          configuration.footerDescription}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <section className="min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10">
              <div className="mx-auto max-w-5xl">
                {children}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function WorkspaceSummaryItem({
  icon: Icon,
  label,
  value,
}: SummaryItem) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
            {label}
          </p>

          <p className="mt-1 truncate text-sm font-black text-white/85">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function defaultSteps(
  mode: ShellMode,
): OnboardingProgressStep[] {
  if (mode === "payment") {
    return [
      {
        label: "Workspace created",
        complete: true,
      },
      {
        label: "Package selected",
        complete: true,
      },
      {
        label: "Invoice issued",
        complete: false,
      },
      {
        label: "Payment submitted",
        complete: false,
      },
      {
        label: "Payment verified",
        complete: false,
      },
    ];
  }

  return [
    {
      label: "Account verified",
      complete: true,
    },
    {
      label: "Workspace created",
      complete: false,
    },
    {
      label: "Package assigned",
      complete: false,
    },
    {
      label: "Payment confirmed",
      complete: false,
    },
    {
      label: "Workspace activated",
      complete: false,
    },
  ];
}