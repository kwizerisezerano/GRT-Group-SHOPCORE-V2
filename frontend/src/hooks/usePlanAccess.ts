import { useMemo } from "react";

import {
  useAuth,
  type FeatureAccessLevel,
  type PlanAccessDecision,
  type PlanLimit,
} from "@/contexts/AuthContext";

export type CapacityKey =
  | "users"
  | "branches"
  | "warehouses"
  | "products"
  | "pos_terminals"
  | "desktop_devices"
  | "storage_gb"
  | "monthly_transactions";

export type PlanAccessResult = {
  moduleKey: string;

  loading: boolean;
  workspaceActive: boolean;

  allowed: boolean;
  accessLevel: FeatureAccessLevel;
  reason: string | null;

  decision: PlanAccessDecision;

  limit: PlanLimit | null;
  usage: number;
  remaining: number | null;
  unlimited: boolean;
  atLimit: boolean;

  requiresUpgrade: boolean;
  requiresAddon: boolean;
  blockedByWorkspace: boolean;
  blockedByPlan: boolean;
  blockedByCapacity: boolean;
};

const normalizeKey = (
  value: string | null | undefined,
) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "") || "";

export function usePlanAccess(
  moduleKey: string,
  capacityKey?: CapacityKey,
): PlanAccessResult {
  const {
    bootstrapping,
    entitlementLoading,
    isWorkspaceActive,

    getModuleAccess,
    getLimit,
    getUsage,
    getRemainingCapacity,
    isAtLimit,
  } = useAuth();

  const normalizedModuleKey =
    normalizeKey(moduleKey);

  const normalizedCapacityKey =
    capacityKey
      ? normalizeKey(capacityKey)
      : null;

  return useMemo(() => {
    const decision = getModuleAccess(
      normalizedModuleKey,
    );

    const limit = normalizedCapacityKey
      ? getLimit(normalizedCapacityKey)
      : null;

    const usage = normalizedCapacityKey
      ? getUsage(normalizedCapacityKey)
      : 0;

    const remaining =
      normalizedCapacityKey
        ? getRemainingCapacity(
            normalizedCapacityKey,
          )
        : null;

    const atLimit =
      normalizedCapacityKey
        ? isAtLimit(normalizedCapacityKey)
        : false;

    const unlimited =
      Boolean(limit?.is_unlimited) ||
      Boolean(
        normalizedCapacityKey &&
          limit === null,
      );

    const blockedByWorkspace =
      !isWorkspaceActive;

    const blockedByPlan =
      isWorkspaceActive &&
      !decision.allowed;

    const blockedByCapacity =
      isWorkspaceActive &&
      decision.allowed &&
      atLimit;

    const requiresAddon =
      decision.accessLevel === "addon";

    const requiresUpgrade =
      blockedByPlan ||
      blockedByCapacity ||
      requiresAddon;

    return {
      moduleKey: normalizedModuleKey,

      loading:
        bootstrapping ||
        entitlementLoading,

      workspaceActive:
        isWorkspaceActive,

      allowed:
        isWorkspaceActive &&
        decision.allowed &&
        !atLimit,

      accessLevel:
        decision.accessLevel,

      reason:
        blockedByWorkspace
          ? "The workspace must be active before this operation can be used."
          : blockedByCapacity
            ? limit
              ? `${limit.name} capacity has been reached for the current subscription.`
              : "The current subscription capacity has been reached."
            : decision.reason,

      decision,

      limit,
      usage,
      remaining,
      unlimited,
      atLimit,

      requiresUpgrade,
      requiresAddon,
      blockedByWorkspace,
      blockedByPlan,
      blockedByCapacity,
    };
  }, [
    bootstrapping,
    entitlementLoading,
    getLimit,
    getModuleAccess,
    getRemainingCapacity,
    getUsage,
    isAtLimit,
    isWorkspaceActive,
    normalizedCapacityKey,
    normalizedModuleKey,
  ]);
}

export function useFeatureAccess(
  featureKey: string,
) {
  const {
    bootstrapping,
    entitlementLoading,
    isWorkspaceActive,
    getModuleAccess,
  } = useAuth();

  const normalizedFeatureKey =
    normalizeKey(featureKey);

  return useMemo(() => {
    const decision = getModuleAccess(
      normalizedFeatureKey,
    );

    return {
      loading:
        bootstrapping ||
        entitlementLoading,

      featureKey:
        normalizedFeatureKey,

      workspaceActive:
        isWorkspaceActive,

      allowed:
        isWorkspaceActive &&
        decision.allowed,

      accessLevel:
        decision.accessLevel,

      reason:
        !isWorkspaceActive
          ? "The workspace must be active before this feature can be used."
          : decision.reason,

      requiresUpgrade:
        isWorkspaceActive &&
        !decision.allowed,

      requiresAddon:
        decision.accessLevel === "addon",

      decision,
    };
  }, [
    bootstrapping,
    entitlementLoading,
    getModuleAccess,
    isWorkspaceActive,
    normalizedFeatureKey,
  ]);
}

export function useCapacityAccess(
  capacityKey: CapacityKey,
) {
  const {
    bootstrapping,
    entitlementLoading,
    isWorkspaceActive,
    getLimit,
    getUsage,
    getRemainingCapacity,
    isAtLimit,
  } = useAuth();

  const normalizedCapacityKey =
    normalizeKey(capacityKey);

  return useMemo(() => {
    const limit = getLimit(
      normalizedCapacityKey,
    );

    const usage = getUsage(
      normalizedCapacityKey,
    );

    const remaining =
      getRemainingCapacity(
        normalizedCapacityKey,
      );

    const atLimit = isAtLimit(
      normalizedCapacityKey,
    );

    const unlimited =
      Boolean(limit?.is_unlimited) ||
      limit === null;

    return {
      loading:
        bootstrapping ||
        entitlementLoading,

      capacityKey:
        normalizedCapacityKey,

      workspaceActive:
        isWorkspaceActive,

      limit,
      usage,
      remaining,
      atLimit,
      unlimited,

      allowed:
        isWorkspaceActive &&
        !atLimit,

      reason:
        !isWorkspaceActive
          ? "The workspace must be active before additional resources can be created."
          : atLimit
            ? limit
              ? `${limit.name} capacity has been reached for the current subscription.`
              : "The current subscription capacity has been reached."
            : null,

      requiresUpgrade:
        isWorkspaceActive &&
        atLimit,
    };
  }, [
    bootstrapping,
    entitlementLoading,
    getLimit,
    getRemainingCapacity,
    getUsage,
    isAtLimit,
    isWorkspaceActive,
    normalizedCapacityKey,
  ]);
}

export default usePlanAccess;