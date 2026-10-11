import { prisma } from "../db/prisma";
import { HttpError } from "./httpError";

/**
 * What a workspace's subscription lets it have, and how much of it is
 * already in use.
 *
 * The rule this file exists to enforce is the plainest one in the product:
 * a plan says "3 users, 2 branches", and the fourth user must not be
 * creatable. Everything else here — the naming, the override table, the
 * remaining-count arithmetic — is in service of that sentence being true on
 * the server rather than merely displayed in the browser.
 *
 * ## Where a limit comes from
 *
 * Three layers, most specific first:
 *
 *   1. TenantLimitOverride — a ceiling negotiated for one workspace.
 *   2. SubscriptionPlanLimit — what the plan says, written by a platform
 *      admin in the console.
 *   3. Nothing at all — treated as unlimited.
 *
 * Layer 3 is deliberate. A limit key that no plan has priced yet must not
 * silently block every workspace on the platform the moment the key is added
 * to this file; the ceiling has to be an explicit decision somebody made.
 */

export const CAPACITY_KEYS = [
  "users",
  "branches",
  "warehouses",
  "products",
  "customers",
  "suppliers",
  "pos_terminals",
  "desktop_devices",
  "storage_gb",
  "monthly_transactions",
] as const;

export type CapacityKey = (typeof CAPACITY_KEYS)[number];

export function isCapacityKey(value: string): value is CapacityKey {
  return (CAPACITY_KEYS as readonly string[]).includes(value);
}

/**
 * Display names used when a plan row does not carry one of its own, and by
 * the platform console's "add a limit" picker so the same capacity is not
 * entered twice under two spellings.
 */
export const CAPACITY_LABELS: Record<CapacityKey, { name: string; unit: string | null }> = {
  users: { name: "Team members", unit: "users" },
  branches: { name: "Branches", unit: "branches" },
  warehouses: { name: "Warehouses", unit: "warehouses" },
  products: { name: "Products", unit: "products" },
  customers: { name: "Customers", unit: "customers" },
  suppliers: { name: "Suppliers", unit: "suppliers" },
  pos_terminals: { name: "POS terminals", unit: "terminals" },
  desktop_devices: { name: "Desktop devices", unit: "devices" },
  storage_gb: { name: "File storage", unit: "GB" },
  monthly_transactions: { name: "Monthly transactions", unit: "sales / month" },
};

export type ResolvedLimit = {
  limit_key: string;
  name: string;
  value: number | null;
  is_unlimited: boolean;
  unit: string | null;
  /** "plan" when the plan set it, "override" when this workspace was given its own. */
  source: "plan" | "override";
};

export type CapacityUsage = Record<CapacityKey, number>;

export type CapacityReport = {
  limit_key: string;
  name: string;
  limit: number | null;
  is_unlimited: boolean;
  unit: string | null;
  usage: number;
  remaining: number | null;
  at_limit: boolean;
  source: "plan" | "override" | "unlimited";
};

const EMPTY_USAGE = (): CapacityUsage =>
  CAPACITY_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as CapacityUsage);

/**
 * The plan a workspace is actually on.
 *
 * The newest subscription row wins over `tenants.subscription_plan`, which is
 * a denormalised mirror kept for the login path and can lag a plan change by
 * however long it takes the writing code to update both. Reading the
 * subscription first means a workspace moved to a bigger plan gets its bigger
 * ceilings on the very next request.
 */
export async function resolveTenantPlanCode(tenantId: string): Promise<string | null> {
  const subscription = await prisma.tenantSubscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { planCode: true },
  });

  if (subscription?.planCode) return subscription.planCode;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true },
  });

  return tenant?.subscriptionPlan ?? null;
}

/** Every ceiling that applies to this workspace, overrides already merged in. */
export async function resolveTenantLimits(tenantId: string): Promise<ResolvedLimit[]> {
  const planCode = await resolveTenantPlanCode(tenantId);

  const [planLimits, overrides] = await Promise.all([
    planCode
      ? prisma.subscriptionPlanLimit.findMany({
          where: { planCode },
          orderBy: [{ displayOrder: "asc" }, { limitKey: "asc" }],
        })
      : Promise.resolve([]),
    prisma.tenantLimitOverride.findMany({ where: { tenantId } }),
  ]);

  const byKey = new Map<string, ResolvedLimit>();

  for (const limit of planLimits) {
    byKey.set(limit.limitKey, {
      limit_key: limit.limitKey,
      name: limit.name,
      value: limit.isUnlimited ? null : limit.value,
      is_unlimited: limit.isUnlimited || limit.value === null,
      unit: limit.unit,
      source: "plan",
    });
  }

  for (const override of overrides) {
    const existing = byKey.get(override.limitKey);
    const fallback = isCapacityKey(override.limitKey) ? CAPACITY_LABELS[override.limitKey] : null;

    byKey.set(override.limitKey, {
      limit_key: override.limitKey,
      name: existing?.name ?? fallback?.name ?? override.limitKey,
      value: override.isUnlimited ? null : override.value,
      is_unlimited: override.isUnlimited || override.value === null,
      unit: existing?.unit ?? fallback?.unit ?? null,
      source: "override",
    });
  }

  return [...byKey.values()];
}

/**
 * How much of each capacity the workspace is using right now.
 *
 * Counted live rather than kept in a counter column. A counter is one missed
 * decrement away from locking a workspace out of a seat it is not using, and
 * these are small, indexed counts on a table that is already filtered by
 * tenant.
 */
export async function resolveTenantUsage(tenantId: string): Promise<CapacityUsage> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    members,
    pendingInvites,
    branches,
    warehouses,
    products,
    customers,
    suppliers,
    monthlySales,
  ] = await Promise.all([
    prisma.tenantMember.count({ where: { tenantId, status: "active" } }),
    /*
     * A pending invitation is a seat already spent. Counting only accepted
     * members lets an admin send ten invitations against three seats and
     * discover the problem only when the seventh person cannot get in — by
     * which point the promise has already been made to them.
     */
    prisma.userInvite.count({
      where: { tenantId, status: "pending", expiresAt: { gt: new Date() } },
    }),
    prisma.branch.count({ where: { tenantId, NOT: { type: "warehouse" } } }),
    prisma.branch.count({ where: { tenantId, type: "warehouse" } }),
    prisma.product.count({ where: { tenantId } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.supplier.count({ where: { tenantId } }),
    prisma.sale.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
  ]);

  const usage = EMPTY_USAGE();

  usage.users = members + pendingInvites;
  usage.branches = branches;
  usage.warehouses = warehouses;
  usage.products = products;
  usage.customers = customers;
  usage.suppliers = suppliers;
  usage.monthly_transactions = monthlySales;
  // Not metered yet: registering a till or a desktop install, and per-tenant
  // object storage, have no source of truth in this schema. Reported as 0
  // rather than omitted, so the shape the frontend consumes never changes.
  usage.pos_terminals = 0;
  usage.desktop_devices = 0;
  usage.storage_gb = 0;

  return usage;
}

/** Limits and usage side by side — what the "3 of 5 users" line is built from. */
export async function buildCapacityReport(tenantId: string): Promise<CapacityReport[]> {
  const [limits, usage] = await Promise.all([
    resolveTenantLimits(tenantId),
    resolveTenantUsage(tenantId),
  ]);

  const limitByKey = new Map(limits.map((limit) => [limit.limit_key, limit]));

  const metered: CapacityReport[] = CAPACITY_KEYS.map((key): CapacityReport => {
    const limit = limitByKey.get(key);
    const used = usage[key] ?? 0;
    const unlimited = !limit || limit.is_unlimited || limit.value === null;

    return {
      limit_key: key,
      name: limit?.name ?? CAPACITY_LABELS[key].name,
      limit: unlimited ? null : limit!.value,
      is_unlimited: unlimited,
      unit: limit?.unit ?? CAPACITY_LABELS[key].unit,
      usage: used,
      remaining: unlimited ? null : Math.max(0, (limit!.value ?? 0) - used),
      at_limit: unlimited ? false : used >= (limit!.value ?? 0),
      source: unlimited ? (limit?.source ?? "unlimited") : limit!.source,
    };
  });

  /*
   * A plan may price a capacity this file does not meter — a platform admin
   * can invent any limit key in the console. Those are reported with their
   * ceiling and a usage of zero rather than dropped, so the console shows the
   * operator exactly what they configured.
   */
  const unmetered: CapacityReport[] = limits
    .filter((limit) => !isCapacityKey(limit.limit_key))
    .map((limit): CapacityReport => ({
      limit_key: limit.limit_key,
      name: limit.name,
      limit: limit.is_unlimited ? null : limit.value,
      is_unlimited: limit.is_unlimited,
      unit: limit.unit,
      usage: 0,
      remaining: limit.is_unlimited ? null : limit.value,
      at_limit: false,
      source: limit.source,
    }));

  return [...metered, ...unmetered];
}

export type CapacityCheck = {
  allowed: boolean;
  limit: number | null;
  is_unlimited: boolean;
  usage: number;
  remaining: number | null;
  name: string;
};

/**
 * Answers "may this workspace create `additional` more of these?" without
 * throwing — for the routes that want to report headroom rather than refuse.
 */
export async function checkCapacity(
  tenantId: string,
  key: CapacityKey,
  additional = 1
): Promise<CapacityCheck> {
  const [limits, usage] = await Promise.all([
    resolveTenantLimits(tenantId),
    resolveTenantUsage(tenantId),
  ]);

  const limit = limits.find((entry) => entry.limit_key === key);
  const used = usage[key] ?? 0;

  if (!limit || limit.is_unlimited || limit.value === null) {
    return {
      allowed: true,
      limit: null,
      is_unlimited: true,
      usage: used,
      remaining: null,
      name: limit?.name ?? CAPACITY_LABELS[key].name,
    };
  }

  return {
    allowed: used + additional <= limit.value,
    limit: limit.value,
    is_unlimited: false,
    usage: used,
    remaining: Math.max(0, limit.value - used),
    name: limit.name,
  };
}

/**
 * The enforcement point. Call immediately before creating the thing.
 *
 * Refuses with 403 and a `capacity_reached` code carrying the numbers, so the
 * frontend can say "5 of 5 team members used — upgrade to add more" instead
 * of a bare failure. Checked here on every path, including the ones a
 * platform admin drives, because a ceiling the server does not check is a
 * suggestion.
 */
export async function assertCapacity(
  tenantId: string,
  key: CapacityKey,
  additional = 1
): Promise<CapacityCheck> {
  const check = await checkCapacity(tenantId, key, additional);

  if (!check.allowed) {
    throw new HttpError(403, "capacity_reached", "subscription.limitReached", {
      params: {
        name: check.name,
        limit: check.limit ?? 0,
        usage: check.usage,
      },
      details: {
        limit_key: key,
        limit: check.limit,
        usage: check.usage,
        remaining: check.remaining,
        name: check.name,
      },
    });
  }

  return check;
}

export type PlanEntitlements = {
  plan_code: string | null;
  plan_name: string | null;
  features: {
    feature_key: string;
    name: string;
    description: string | null;
    category: string;
    feature_type: string;
    access_level: string;
    display_note: string | null;
    is_highlighted: boolean;
  }[];
  limits: {
    limit_key: string;
    name: string;
    value: number | null;
    is_unlimited: boolean;
    unit: string | null;
  }[];
  usage: CapacityUsage;
  capacities: CapacityReport[];
  module_entitlements: {
    id: string | null;
    tenant_id: string | null;
    module_key: string;
    module_name: string;
    status: string;
    seats_included: number;
    seats_used: number;
    usage_count: number;
    last_used_at: Date | null;
    metadata: Record<string, unknown>;
  }[];
};

/**
 * Everything the frontend's commercial-access layer needs in one call:
 * what the plan opens, what it caps, and where the workspace stands against
 * those caps. AuthContext loads this once per session and PlanGuard reads it
 * from there.
 */
export async function resolveEntitlements(tenantId: string): Promise<PlanEntitlements> {
  const planCode = await resolveTenantPlanCode(tenantId);

  const [plan, features, capacities, usage, moduleEntitlements] = await Promise.all([
    planCode
      ? prisma.subscriptionPlan.findUnique({ where: { code: planCode }, select: { name: true } })
      : Promise.resolve(null),
    planCode
      ? prisma.subscriptionPlanFeature.findMany({
          where: { planCode },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    buildCapacityReport(tenantId),
    resolveTenantUsage(tenantId),
    prisma.platformTenantModuleEntitlement.findMany({ where: { tenantId } }),
  ]);

  return {
    plan_code: planCode,
    plan_name: plan?.name ?? null,
    features: features.map((feature) => ({
      feature_key: feature.featureKey,
      name: feature.name,
      description: feature.description,
      category: feature.category,
      feature_type: feature.category,
      access_level: feature.accessLevel,
      display_note: feature.displayNote,
      is_highlighted: feature.isHighlighted,
    })),
    limits: capacities.map((capacity) => ({
      limit_key: capacity.limit_key,
      name: capacity.name,
      value: capacity.limit,
      is_unlimited: capacity.is_unlimited,
      unit: capacity.unit,
    })),
    usage,
    capacities,
    module_entitlements: moduleEntitlements.map((entitlement) => ({
      id: entitlement.id,
      tenant_id: entitlement.tenantId,
      module_key: entitlement.moduleKey,
      module_name: entitlement.moduleName ?? entitlement.moduleKey,
      status: entitlement.status ?? "enabled",
      seats_included: entitlement.seatsIncluded ?? 0,
      seats_used: entitlement.seatsUsed ?? 0,
      usage_count: entitlement.usageCount ?? 0,
      last_used_at: entitlement.lastUsedAt,
      metadata: (entitlement.metadata as Record<string, unknown>) ?? {},
    })),
  };
}
