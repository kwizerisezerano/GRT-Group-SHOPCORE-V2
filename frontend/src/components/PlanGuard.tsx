import type {
  ReactNode,
} from "react";
import {
  Loader2,
} from "lucide-react";

import UpgradeRequired from "@/components/UpgradeRequired";
import {
  usePlanAccess,
  type CapacityKey,
} from "@/hooks/usePlanAccess";

type PlanGuardProps = {
  feature: string;
  capacity?: CapacityKey;

  children: ReactNode;
  fallback?: ReactNode;

  title?: string;
  description?: string;
  featureName?: string;
  requiredPlan?: string;

  compact?: boolean;
  embedded?: boolean;

  allowWhileLoading?: boolean;
  hideWhenBlocked?: boolean;

  primaryActionLabel?: string;
  primaryActionTo?: string;

  secondaryActionLabel?: string;
  secondaryActionTo?: string;
};

export default function PlanGuard({
  feature,
  capacity,

  children,
  fallback,

  title,
  description,
  featureName,
  requiredPlan,

  compact = false,
  embedded = false,

  allowWhileLoading = false,
  hideWhenBlocked = false,

  primaryActionLabel,
  primaryActionTo,

  secondaryActionLabel,
  secondaryActionTo,
}: PlanGuardProps) {
  const access = usePlanAccess(
    feature,
    capacity,
  );

  if (access.loading) {
    if (allowWhileLoading) {
      return <>{children}</>;
    }

    return (
      <div
        className={[
          "flex items-center justify-center rounded-2xl border border-slate-200 bg-white",
          compact
            ? "min-h-24 p-4"
            : "min-h-56 p-8",
        ].join(" ")}
      >
        <Loader2 className="h-5 w-5 animate-spin text-blue-700" />

        <p className="ml-3 text-sm font-bold text-slate-500">
          Checking subscription access...
        </p>
      </div>
    );
  }

  if (access.allowed) {
    return <>{children}</>;
  }

  if (hideWhenBlocked) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const variant = access.blockedByWorkspace
    ? "workspace"
    : access.requiresAddon
      ? "addon"
      : access.blockedByCapacity
        ? "capacity"
        : "feature";

  return (
    <UpgradeRequired
      variant={variant}
      title={title}
      description={description}
      featureName={featureName}
      featureKey={feature}
      reason={access.reason}
      decision={access.decision}
      accessLevel={access.accessLevel}
      limit={access.limit}
      usage={access.usage}
      remaining={access.remaining}
      requiredPlan={requiredPlan}
      compact={compact}
      embedded={embedded}
      primaryActionLabel={
        primaryActionLabel
      }
      primaryActionTo={primaryActionTo}
      secondaryActionLabel={
        secondaryActionLabel
      }
      secondaryActionTo={
        secondaryActionTo
      }
    />
  );
}