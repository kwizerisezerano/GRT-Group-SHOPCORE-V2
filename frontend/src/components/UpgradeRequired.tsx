import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  Gauge,
  Layers3,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useAuth,
  type FeatureAccessLevel,
  type PlanAccessDecision,
  type PlanLimit,
} from "@/contexts/AuthContext";

type UpgradeRequiredVariant =
  | "feature"
  | "capacity"
  | "workspace"
  | "addon";

type UpgradeRequiredProps = {
  title?: string;
  description?: string;
  featureName?: string;
  featureKey?: string;

  variant?: UpgradeRequiredVariant;
  accessLevel?: FeatureAccessLevel;

  reason?: string | null;
  decision?: PlanAccessDecision | null;

  limit?: PlanLimit | null;
  usage?: number;
  remaining?: number | null;

  requiredPlan?: string;
  currentPlan?: string | null;

  icon?: ElementType;
  benefits?: string[];

  compact?: boolean;
  embedded?: boolean;

  primaryActionLabel?: string;
  primaryActionTo?: string;

  secondaryActionLabel?: string;
  secondaryActionTo?: string;

  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;

  children?: ReactNode;
};

const variantConfig: Record<
  UpgradeRequiredVariant,
  {
    icon: ElementType;
    eyebrow: string;
    iconClass: string;
    panelClass: string;
    badgeClass: string;
  }
> = {
  feature: {
    icon: LockKeyhole,
    eyebrow: "Plan-controlled feature",
    iconClass:
      "border-violet-200 bg-violet-50 text-violet-700",
    panelClass:
      "border-violet-200 bg-violet-50/40",
    badgeClass:
      "border-violet-200 bg-violet-50 text-violet-700",
  },
  capacity: {
    icon: Gauge,
    eyebrow: "Subscription capacity",
    iconClass:
      "border-orange-200 bg-orange-50 text-orange-700",
    panelClass:
      "border-orange-200 bg-orange-50/40",
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700",
  },
  workspace: {
    icon: ShieldCheck,
    eyebrow: "Workspace activation required",
    iconClass:
      "border-blue-200 bg-blue-50 text-blue-700",
    panelClass:
      "border-blue-200 bg-blue-50/40",
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700",
  },
  addon: {
    icon: Layers3,
    eyebrow: "Additional subscription module",
    iconClass:
      "border-cyan-200 bg-cyan-50 text-cyan-700",
    panelClass:
      "border-cyan-200 bg-cyan-50/40",
    badgeClass:
      "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
};

const defaultBenefits = [
  "Controlled access through the ShopCore subscription engine",
  "Plan limits enforced across frontend and backend operations",
  "Upgrade path without recreating the workspace",
];

function normalizePlanName(
  value: string | null | undefined,
) {
  if (!value) {
    return "Current plan";
  }

  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function formatCapacityValue(
  value: number | null | undefined,
  unit?: string | null,
) {
  if (value === null || value === undefined) {
    return "Unlimited";
  }

  const formatted = Number(value).toLocaleString(
    "en-RW",
  );

  return unit ? `${formatted} ${unit}` : formatted;
}

export default function UpgradeRequired({
  title,
  description,
  featureName,
  featureKey,

  variant = "feature",
  accessLevel = "unavailable",

  reason,
  decision,

  limit,
  usage = 0,
  remaining = null,

  requiredPlan,
  currentPlan,

  icon,
  benefits = defaultBenefits,

  compact = false,
  embedded = false,

  primaryActionLabel,
  primaryActionTo,

  secondaryActionLabel = "Compare plans",
  secondaryActionTo = "/#pricing",

  onRefresh,
  refreshing = false,

  children,
}: UpgradeRequiredProps) {
  const {
    subscriptionPlan,
    workspaceAccessStatus,
    tenantId,
  } = useAuth();

  const config = variantConfig[variant];
  const Icon = icon || config.icon;

  const resolvedCurrentPlan =
    currentPlan ||
    subscriptionPlan ||
    "Unassigned";

  const resolvedFeatureName =
    featureName ||
    decision?.feature?.name ||
    featureKey ||
    "This capability";

  const resolvedTitle =
    title ||
    (variant === "capacity"
      ? `${limit?.name || resolvedFeatureName} capacity reached`
      : variant === "workspace"
        ? "Activate the workspace to continue"
        : variant === "addon"
          ? `${resolvedFeatureName} requires an add-on`
          : `${resolvedFeatureName} is not included`);

  const resolvedDescription =
    description ||
    reason ||
    decision?.reason ||
    (variant === "workspace"
      ? "Complete payment verification or receive an approved trial before using operational modules."
      : variant === "capacity"
        ? `The current subscription has reached its ${
            limit?.name?.toLowerCase() ||
            "resource"
          } allowance.`
        : "The current commercial edition does not include this capability.");

  const resolvedPrimaryActionTo =
    primaryActionTo ||
    (variant === "workspace" && tenantId
      ? `/onboarding/payment/${tenantId}`
      : "/contact-sales");

  const resolvedPrimaryActionLabel =
    primaryActionLabel ||
    (variant === "workspace"
      ? "Continue activation"
      : variant === "addon"
        ? "Request module access"
        : variant === "capacity"
          ? "Increase capacity"
          : "Review upgrade options");

  const accessBadge =
    accessLevel === "addon"
      ? "Add-on available"
      : accessLevel === "limited"
        ? "Limited access"
        : "Upgrade required";

  const body = (
    <div
      className={[
        "relative overflow-hidden rounded-[28px] border",
        config.panelClass,
        embedded
          ? ""
          : "shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]",
        compact ? "p-5" : "p-6 sm:p-8",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-white/70 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={[
                "flex shrink-0 items-center justify-center rounded-2xl border",
                compact ? "h-11 w-11" : "h-14 w-14",
                config.iconClass,
              ].join(" ")}
            >
              <Icon
                className={
                  compact
                    ? "h-5 w-5"
                    : "h-6 w-6"
                }
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em]",
                    config.badgeClass,
                  ].join(" ")}
                >
                  {config.eyebrow}
                </span>

                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                  {accessBadge}
                </span>
              </div>

              <h2
                className={[
                  "mt-4 font-black tracking-[-0.025em] text-slate-950",
                  compact
                    ? "text-lg"
                    : "text-2xl sm:text-3xl",
                ].join(" ")}
              >
                {resolvedTitle}
              </h2>

              <p
                className={[
                  "mt-3 max-w-3xl font-medium text-slate-600",
                  compact
                    ? "text-xs leading-5"
                    : "text-sm leading-7",
                ].join(" ")}
              >
                {resolvedDescription}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
              Current edition
            </p>

            <p className="mt-1 text-sm font-black text-slate-950">
              {normalizePlanName(
                resolvedCurrentPlan,
              )}
            </p>
          </div>
        </div>

        {variant === "capacity" && limit ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <CapacityMetric
              icon={Users}
              label="Current usage"
              value={formatCapacityValue(
                usage,
                limit.unit,
              )}
            />

            <CapacityMetric
              icon={PackageCheck}
              label="Plan allowance"
              value={
                limit.is_unlimited
                  ? "Unlimited"
                  : formatCapacityValue(
                      limit.value,
                      limit.unit,
                    )
              }
            />

            <CapacityMetric
              icon={Clock3}
              label="Remaining"
              value={
                limit.is_unlimited
                  ? "Unlimited"
                  : formatCapacityValue(
                      remaining,
                      limit.unit,
                    )
              }
            />
          </div>
        ) : null}

        {requiredPlan ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/80 bg-white/75 p-4">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                Recommended edition
              </p>

              <p className="mt-1 text-sm font-black text-slate-950">
                {normalizePlanName(requiredPlan)}
              </p>
            </div>
          </div>
        ) : null}

        {children ? (
          <div className="mt-6">{children}</div>
        ) : benefits.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-white/80 bg-white/75 p-5">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-slate-500">
              What happens next
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-start gap-2.5"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                  <p className="text-xs font-semibold leading-5 text-slate-600">
                    {benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={[
            "mt-6 flex flex-col gap-3",
            compact
              ? "sm:flex-row"
              : "sm:flex-row sm:items-center sm:justify-between",
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="h-11 rounded-xl bg-[#070b67] px-5 font-black hover:bg-[#050950]"
            >
              <Link to={resolvedPrimaryActionTo}>
                {resolvedPrimaryActionLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-11 rounded-xl border-slate-300 bg-white px-5 font-black text-slate-800 hover:bg-slate-50"
            >
              <Link to={secondaryActionTo}>
                {secondaryActionLabel}
              </Link>
            </Button>
          </div>

          {onRefresh ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void onRefresh()}
              disabled={refreshing}
              className="h-11 rounded-xl px-4 font-black text-slate-600"
            >
              <RefreshCw
                className={[
                  "mr-2 h-4 w-4",
                  refreshing ? "animate-spin" : "",
                ].join(" ")}
              />
              Refresh access
            </Button>
          ) : null}
        </div>

        {variant === "workspace" ? (
          <div className="mt-5 flex items-start gap-3 border-t border-slate-200/80 pt-5">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />

            <p className="text-xs font-medium leading-5 text-slate-500">
              Current workspace state:{" "}
              <span className="font-black text-slate-700">
                {normalizePlanName(
                  workspaceAccessStatus,
                )}
              </span>
              . Access will refresh automatically after
              trusted payment or trial approval.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      {body}
    </section>
  );
}

function CapacityMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>

          <p className="mt-1 text-sm font-black text-slate-950">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}