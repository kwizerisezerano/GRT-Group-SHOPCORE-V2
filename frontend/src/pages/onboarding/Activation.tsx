import { useMemo, useState, type ElementType } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileCheck2,
  Headphones,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  useAuth,
  type WorkspaceAccessStatus,
} from "@/contexts/AuthContext";

const PAYMENT_TENANT_KEY =
  "shopcore_pending_payment_tenant_id";

type ActivationTone =
  | "emerald"
  | "orange"
  | "blue"
  | "rose"
  | "slate"
  | "violet"
  | "cyan";

type StatusConfiguration = {
  label: string;
  title: string;
  description: string;
  operationalMessage: string;
  badge: string;
  panel: string;
  iconPanel: string;
  icon: ElementType;
};

const statusConfiguration: Record<
  WorkspaceAccessStatus,
  StatusConfiguration
> = {
  active: {
    label: "Workspace active",
    title: "Your ShopCore workspace is operational",
    description:
      "Payment or subscription activation has been confirmed. Your organization can now access the operational workspace.",
    operationalMessage:
      "All activation controls have been completed successfully.",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    panel:
      "border-emerald-200 bg-emerald-50",
    iconPanel:
      "border-emerald-200 bg-white text-emerald-700",
    icon: CheckCircle2,
  },

  pending_payment: {
    label: "Payment required",
    title: "Complete payment to activate your workspace",
    description:
      "Your organization and subscription have been prepared. Operational access remains protected until payment is verified or an approved trial is granted.",
    operationalMessage:
      "The workspace is registered and awaiting trusted payment confirmation.",
    badge:
      "border-orange-200 bg-orange-50 text-orange-700",
    panel:
      "border-orange-200 bg-orange-50",
    iconPanel:
      "border-orange-200 bg-white text-orange-700",
    icon: CreditCard,
  },

  trial_active: {
    label: "Approved trial",
    title: "Your trial workspace is operational",
    description:
      "Trial access has been approved. You may use the included ShopCore modules until the approved trial period ends.",
    operationalMessage:
      "The workspace is operating under an approved trial authorization.",
    badge:
      "border-blue-200 bg-blue-50 text-blue-700",
    panel:
      "border-blue-200 bg-blue-50",
    iconPanel:
      "border-blue-200 bg-white text-blue-700",
    icon: CheckCircle2,
  },

  trial_expired: {
    label: "Trial expired",
    title: "Subscription activation is required",
    description:
      "The approved trial period has ended. Complete payment to restore access to the protected ShopCore workspace.",
    operationalMessage:
      "Operational access is paused until a paid subscription is activated.",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700",
    panel:
      "border-rose-200 bg-rose-50",
    iconPanel:
      "border-rose-200 bg-white text-rose-700",
    icon: Clock3,
  },

  blocked: {
    label: "Administrative restriction",
    title: "This workspace requires administrative review",
    description:
      "Platform Administration has restricted the workspace. Payment alone cannot restore access until the account review is completed.",
    operationalMessage:
      "Contact ShopCore Support or Platform Administration for account review.",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700",
    panel:
      "border-rose-200 bg-rose-50",
    iconPanel:
      "border-rose-200 bg-white text-rose-700",
    icon: ShieldAlert,
  },

  unknown: {
    label: "Verification pending",
    title: "Workspace status is being verified",
    description:
      "ShopCore has not yet resolved the current activation state. Refresh the workspace record or sign in again.",
    operationalMessage:
      "Activation information is temporarily unavailable.",
    badge:
      "border-slate-200 bg-slate-100 text-slate-700",
    panel:
      "border-slate-200 bg-slate-50",
    iconPanel:
      "border-slate-200 bg-white text-slate-700",
    icon: AlertTriangle,
  },
};

const toneClasses: Record<
  ActivationTone,
  {
    icon: string;
    border: string;
    text: string;
  }
> = {
  emerald: {
    icon:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },

  orange: {
    icon:
      "border-orange-200 bg-orange-50 text-orange-700",
    border: "border-orange-200",
    text: "text-orange-700",
  },

  blue: {
    icon:
      "border-blue-200 bg-blue-50 text-blue-700",
    border: "border-blue-200",
    text: "text-blue-700",
  },

  rose: {
    icon:
      "border-rose-200 bg-rose-50 text-rose-700",
    border: "border-rose-200",
    text: "text-rose-700",
  },

  slate: {
    icon:
      "border-slate-200 bg-slate-50 text-slate-700",
    border: "border-slate-200",
    text: "text-slate-700",
  },

  violet: {
    icon:
      "border-violet-200 bg-violet-50 text-violet-700",
    border: "border-violet-200",
    text: "text-violet-700",
  },

  cyan: {
    icon:
      "border-cyan-200 bg-cyan-50 text-cyan-700",
    border: "border-cyan-200",
    text: "text-cyan-700",
  },
};

function formatLabel(
  value: string | null | undefined,
  fallback = "Not available",
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

function formatDate(
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getTrialDaysRemaining(
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const end = new Date(value).getTime();

  if (!Number.isFinite(end)) {
    return null;
  }

  const remaining = end - Date.now();

  return Math.max(
    Math.ceil(remaining / 86_400_000),
    0,
  );
}

export default function Activation() {
  const {
    user,
    loading,
    bootstrapping,

    tenantId,
    tenantName,

    subscriptionPlan,
    subscriptionStatus,
    billingCycle,
    currentPeriodStart,
    currentPeriodEnd,

    paymentStatus,
    trialStatus,
    trialEndsAt,
    workspaceStatus,
    workspaceAccessStatus,

    onboardingCompleted,
    refreshTenant,
    signOut,
    isWorkspaceActive,
  } = useAuth();

  const [refreshing, setRefreshing] =
    useState(false);

  const [signingOut, setSigningOut] =
    useState(false);

  const recoveredTenantId =
    tenantId ||
    sessionStorage.getItem(
      PAYMENT_TENANT_KEY,
    ) ||
    localStorage.getItem(
      PAYMENT_TENANT_KEY,
    );

  const configuration =
    statusConfiguration[
      workspaceAccessStatus
    ] ?? statusConfiguration.unknown;

  const StatusIcon = configuration.icon;

  const trialEndLabel =
    formatDate(trialEndsAt);

  const currentPeriodStartLabel =
    formatDate(currentPeriodStart);

  const currentPeriodEndLabel =
    formatDate(currentPeriodEnd);

  const trialDaysRemaining =
    getTrialDaysRemaining(trialEndsAt);

  const canContinuePayment =
    Boolean(recoveredTenantId) &&
    workspaceAccessStatus !== "active" &&
    workspaceAccessStatus !==
      "trial_active" &&
    workspaceAccessStatus !== "blocked";

  const activationProgress = useMemo(() => {
    const steps = [
      {
        label: "Account verified",
        complete: Boolean(user),
      },
      {
        label: "Workspace created",
        complete: Boolean(tenantId),
      },
      {
        label: "Package assigned",
        complete: Boolean(
          subscriptionPlan,
        ),
      },
      {
        label: "Payment confirmed",
        complete: [
          "paid",
          "confirmed",
          "completed",
          "verified",
          "successful",
        ].includes(
          paymentStatus
            ?.trim()
            .toLowerCase() || "",
        ),
      },
      {
        label: "Workspace activated",
        complete: isWorkspaceActive,
      },
    ];

    return {
      steps,
      completed:
        steps.filter(
          (step) => step.complete,
        ).length,
      percentage: Math.round(
        (steps.filter(
          (step) => step.complete,
        ).length /
          steps.length) *
          100,
      ),
    };
  }, [
    isWorkspaceActive,
    paymentStatus,
    subscriptionPlan,
    tenantId,
    user,
  ]);

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);

    try {
      await refreshTenant();

      toast.success(
        "Workspace activation status refreshed.",
      );
    } catch (error: any) {
      console.error(
        "Workspace activation refresh failed:",
        error,
      );

      toast.error(
        error?.message ||
          "The workspace activation status could not be refreshed.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      await signOut();
    } catch (error: any) {
      console.error(
        "Sign-out failed:",
        error,
      );

      toast.error(
        error?.message ||
          "The account could not be signed out.",
      );

      setSigningOut(false);
    }
  };

  if (loading || bootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#d7dce2] px-4">
        <div className="w-full max-w-lg overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_90px_-55px_rgba(15,23,42,0.7)]">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-slate-50 px-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>

            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              ShopCore Activation
            </span>
          </div>

          <div className="p-8 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-700" />

            <h1 className="mt-5 text-xl font-black text-slate-950">
              Verifying workspace access
            </h1>

            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Loading your workspace,
              subscription, payment, trial,
              and activation controls.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{
          continueOnboarding: true,
          returnTo: "/activation",
        }}
      />
    );
  }

  if (isWorkspaceActive) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

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
                Protected workspace activation
              </p>
            </div>

            <Link
              to="/"
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
                  to="/"
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
                      Business Operating
                      System
                    </p>
                  </div>
                </Link>

                <div className="mt-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                    Activation control center
                  </p>

                  <h1 className="mt-4 text-2xl font-black leading-tight tracking-[-0.02em]">
                    Secure access begins after
                    commercial verification.
                  </h1>

                  <p className="mt-4 text-sm font-medium leading-7 text-white/55">
                    ShopCore confirms workspace
                    ownership, package assignment,
                    billing status, and access
                    authorization before protected
                    operations are released.
                  </p>
                </div>

                <div className="mt-8 space-y-3">
                  <ActivationSideItem
                    icon={Building2}
                    title="Workspace identity"
                    value={
                      tenantName ||
                      "Workspace pending"
                    }
                  />

                  <ActivationSideItem
                    icon={PackageCheck}
                    title="Commercial edition"
                    value={formatLabel(
                      subscriptionPlan,
                      "Package pending",
                    )}
                  />

                  <ActivationSideItem
                    icon={WalletCards}
                    title="Billing cycle"
                    value={formatLabel(
                      billingCycle,
                      "Monthly",
                    )}
                  />

                  <ActivationSideItem
                    icon={LockKeyhole}
                    title="Access boundary"
                    value={formatLabel(
                      workspaceAccessStatus,
                    )}
                  />
                </div>

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                      Activation progress
                    </p>

                    <p className="text-xs font-black text-cyan-300">
                      {
                        activationProgress.percentage
                      }
                      %
                    </p>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan-300 transition-all"
                      style={{
                        width: `${activationProgress.percentage}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {activationProgress.steps.map(
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

                <div className="mt-auto pt-8">
                  <div className="flex items-start gap-3 border-t border-white/10 pt-5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />

                    <p className="text-xs font-medium leading-5 text-white/40">
                      Payment approval and workspace
                      activation are controlled by
                      trusted platform processes.
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            <section className="min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10">
              <div className="mx-auto max-w-5xl">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black",
                        configuration.badge,
                      ].join(" ")}
                    >
                      <StatusIcon className="h-4 w-4" />
                      {configuration.label}
                    </div>

                    <h2 className="mt-5 max-w-3xl text-2xl font-black tracking-[-0.025em] text-slate-950 sm:text-3xl">
                      {configuration.title}
                    </h2>

                    <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-slate-500">
                      {
                        configuration.description
                      }
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-xl border-slate-300 bg-white font-black"
                    disabled={refreshing}
                    onClick={() =>
                      void handleRefresh()
                    }
                  >
                    <RefreshCw
                      className={[
                        "mr-2 h-4 w-4",
                        refreshing
                          ? "animate-spin"
                          : "",
                      ].join(" ")}
                    />

                    {refreshing
                      ? "Refreshing..."
                      : "Refresh status"}
                  </Button>
                </div>

                <div
                  className={[
                    "mt-7 rounded-2xl border p-5",
                    configuration.panel,
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                          configuration.iconPanel,
                        ].join(" ")}
                      >
                        <StatusIcon className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-black text-slate-950">
                          Current activation state
                        </p>

                        <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                          {
                            configuration.operationalMessage
                          }
                        </p>
                      </div>
                    </div>

                    <span
                      className={[
                        "w-fit rounded-full border px-3 py-1.5 text-xs font-black",
                        configuration.badge,
                      ].join(" ")}
                    >
                      {formatLabel(
                        workspaceAccessStatus,
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <StatusCard
                    icon={Building2}
                    label="Workspace"
                    value={
                      tenantName ||
                      "Pending workspace"
                    }
                    detail={
                      recoveredTenantId
                        ? `Tenant ${recoveredTenantId.slice(
                            0,
                            8,
                          )}`
                        : "Tenant identifier unavailable"
                    }
                    tone="slate"
                  />

                  <StatusCard
                    icon={PackageCheck}
                    label="Package"
                    value={formatLabel(
                      subscriptionPlan,
                      "Pending package",
                    )}
                    detail={formatLabel(
                      billingCycle,
                      "Billing cycle pending",
                    )}
                    tone="blue"
                  />

                  <StatusCard
                    icon={CreditCard}
                    label="Payment"
                    value={formatLabel(
                      paymentStatus,
                      "Unpaid",
                    )}
                    detail={
                      workspaceAccessStatus ===
                      "pending_payment"
                        ? "Verification required"
                        : undefined
                    }
                    tone="orange"
                  />

                  <StatusCard
                    icon={ReceiptText}
                    label="Subscription"
                    value={formatLabel(
                      subscriptionStatus,
                      "Pending payment",
                    )}
                    detail={
                      currentPeriodEndLabel
                        ? `Period ends ${currentPeriodEndLabel}`
                        : currentPeriodStartLabel
                          ? `Started ${currentPeriodStartLabel}`
                          : undefined
                    }
                    tone="emerald"
                  />

                  <StatusCard
                    icon={CalendarDays}
                    label="Trial authorization"
                    value={formatLabel(
                      trialStatus,
                      "Not approved",
                    )}
                    detail={
                      trialEndLabel
                        ? trialDaysRemaining !==
                          null
                          ? `${trialDaysRemaining} day${
                              trialDaysRemaining ===
                              1
                                ? ""
                                : "s"
                            } remaining · Ends ${trialEndLabel}`
                          : `Ends ${trialEndLabel}`
                        : "No active trial period"
                    }
                    tone="violet"
                  />

                  <StatusCard
                    icon={LockKeyhole}
                    label="Workspace control"
                    value={formatLabel(
                      workspaceStatus ||
                        workspaceAccessStatus,
                    )}
                    detail={
                      onboardingCompleted
                        ? "Onboarding recorded"
                        : "Onboarding incomplete"
                    }
                    tone="rose"
                  />
                </div>

                {workspaceAccessStatus ===
                "trial_expired" ? (
                  <OperationalNotice
                    icon={Clock3}
                    title="Trial access has ended"
                    description="Continue to payment to activate the selected subscription and restore operational workspace access."
                    tone="rose"
                  />
                ) : null}

                {workspaceAccessStatus ===
                "blocked" ? (
                  <OperationalNotice
                    icon={ShieldAlert}
                    title="Administrative review required"
                    description="This workspace cannot be restored through payment alone. Contact ShopCore Support for an account and subscription review."
                    tone="rose"
                  >
                    <Button
                      asChild
                      variant="outline"
                      className="mt-4 h-10 rounded-xl border-rose-300 bg-white font-black text-rose-700"
                    >
                      <Link to="/support-center">
                        <Headphones className="mr-2 h-4 w-4" />
                        Open Support Center
                      </Link>
                    </Button>
                  </OperationalNotice>
                ) : null}

                {!recoveredTenantId &&
                workspaceAccessStatus ===
                  "pending_payment" ? (
                  <OperationalNotice
                    icon={AlertTriangle}
                    title="Workspace identifier unavailable"
                    description="The payment route cannot be opened because the tenant identifier has not been recovered. Refresh the activation record or sign in again."
                    tone="orange"
                  />
                ) : null}

                <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
                        <FileCheck2 className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-black text-slate-950">
                          Activation control
                        </p>

                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                          Continue the commercial
                          activation process or refresh
                          this workspace after trusted
                          payment verification.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {canContinuePayment &&
                      recoveredTenantId ? (
                        <Button
                          asChild
                          className="h-12 rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
                        >
                          <Link
                            to={`/onboarding/payment/${recoveredTenantId}`}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Continue to payment
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant={
                          canContinuePayment
                            ? "outline"
                            : "default"
                        }
                        className={[
                          "h-12 rounded-xl font-black",
                          canContinuePayment
                            ? "border-slate-300 bg-white"
                            : "bg-[#070b67] hover:bg-[#050950]",
                        ].join(" ")}
                        disabled={refreshing}
                        onClick={() =>
                          void handleRefresh()
                        }
                      >
                        <RefreshCw
                          className={[
                            "mr-2 h-4 w-4",
                            refreshing
                              ? "animate-spin"
                              : "",
                          ].join(" ")}
                        />

                        {refreshing
                          ? "Refreshing..."
                          : "Refresh activation"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-[#0b1220] p-5 text-white shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-cyan-300">
                        <UserRoundCheck className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-black">
                          Signed-in account
                        </p>

                        <p className="mt-1 break-all text-xs font-medium leading-5 text-white/50">
                          {user.email ||
                            "Authenticated ShopCore user"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/10 pt-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                        Last status check
                      </p>

                      <p className="mt-1 text-xs font-semibold text-white/70">
                        {formatDateTime(
                          new Date().toISOString(),
                        )}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-4 h-10 w-full rounded-xl border border-white/10 bg-white/5 font-black text-white hover:bg-white/10 hover:text-white"
                      disabled={signingOut}
                      onClick={() =>
                        void handleSignOut()
                      }
                    >
                      {signingOut ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LockKeyhole className="mr-2 h-4 w-4" />
                      )}

                      {signingOut
                        ? "Signing out..."
                        : "Sign out"}
                    </Button>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                    <div>
                      <p className="text-sm font-black text-slate-900">
                        Trusted activation process
                      </p>

                      <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-slate-500">
                        Payment and trial approvals may
                        require Platform Administration
                        or provider verification. The
                        workspace will become available
                        after the trusted activation
                        process completes.
                      </p>
                    </div>
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    className="h-10 shrink-0 rounded-xl bg-white font-black"
                  >
                    <Link to="/support-center">
                      <Headphones className="mr-2 h-4 w-4" />
                      Activation support
                    </Link>
                  </Button>
                </div>

                {workspaceAccessStatus ===
                "active" ? (
                  <Button
                    asChild
                    className="mt-6 h-12 w-full rounded-xl bg-emerald-600 font-black hover:bg-emerald-700"
                  >
                    <Link to="/dashboard">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Open workspace
                    </Link>
                  </Button>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function ActivationSideItem({
  icon: Icon,
  title,
  value,
}: {
  icon: ElementType;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
            {title}
          </p>

          <p className="mt-1 truncate text-sm font-black text-white/85">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail?: string;
  tone: ActivationTone;
}) {
  const classes = toneClasses[tone];

  return (
    <article
      className={[
        "rounded-2xl border bg-white p-5 shadow-sm",
        classes.border,
      ].join(" ")}
    >
      <div
        className={[
          "flex h-10 w-10 items-center justify-center rounded-xl border",
          classes.icon,
        ].join(" ")}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-black text-slate-950">
        {value}
      </p>

      {detail ? (
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
          {detail}
        </p>
      ) : null}
    </article>
  );
}

function OperationalNotice({
  icon: Icon,
  title,
  description,
  tone,
  children,
}: {
  icon: ElementType;
  title: string;
  description: string;
  tone: "rose" | "orange" | "blue";
  children?: React.ReactNode;
}) {
  const styles = {
    rose: {
      panel:
        "border-rose-200 bg-rose-50",
      icon: "text-rose-700",
      title: "text-rose-950",
      text: "text-rose-800",
    },

    orange: {
      panel:
        "border-orange-200 bg-orange-50",
      icon: "text-orange-700",
      title: "text-orange-950",
      text: "text-orange-800",
    },

    blue: {
      panel:
        "border-blue-200 bg-blue-50",
      icon: "text-blue-700",
      title: "text-blue-950",
      text: "text-blue-800",
    },
  };

  const style = styles[tone];

  return (
    <div
      className={[
        "mt-6 rounded-2xl border p-5",
        style.panel,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={[
            "mt-0.5 h-5 w-5 shrink-0",
            style.icon,
          ].join(" ")}
        />

        <div>
          <p
            className={[
              "text-sm font-black",
              style.title,
            ].join(" ")}
          >
            {title}
          </p>

          <p
            className={[
              "mt-1 text-xs font-medium leading-5",
              style.text,
            ].join(" ")}
          >
            {description}
          </p>

          {children}
        </div>
      </div>
    </div>
  );
}