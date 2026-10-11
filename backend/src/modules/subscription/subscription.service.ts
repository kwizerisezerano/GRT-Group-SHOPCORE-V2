import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../lib/httpError";
import { TEST_PLAN_CODE } from "./testPlan";

/**
 * Reading the plan catalogue.
 *
 * One serializer feeds three audiences — the public pricing/signup screens,
 * the platform console's plan editor, and the workspace's own billing page —
 * so a plan a super admin creates in the console is on the signup page as
 * soon as it is saved, with the same prices, the same ceilings and the same
 * feature list. That was the whole point of moving plans out of a seed file
 * and into editable rows.
 */

const planInclude = {
  prices: { orderBy: { billingMonths: "asc" } },
  limits: { orderBy: [{ displayOrder: "asc" }, { limitKey: "asc" }] },
  features: { orderBy: [{ displayOrder: "asc" }, { name: "asc" }] },
} satisfies Prisma.SubscriptionPlanInclude;

type PlanWithRelations = Prisma.SubscriptionPlanGetPayload<{ include: typeof planInclude }>;

const toNumber = (value: Prisma.Decimal | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

/**
 * The wire shape for a plan.
 *
 * Carries the three headline prices as flat fields *and* the full price rows.
 * The flat fields are what a pricing card renders without arithmetic; the
 * rows are what the checkout needs when a customer picks a cycle. Deriving
 * one from the other at every call site is how the two drift apart.
 */
export function serializePlan(plan: PlanWithRelations) {
  const priceFor = (cycle: string) => plan.prices.find((price) => price.billingCycle === cycle);

  const monthly = priceFor("monthly");
  const sixMonths = priceFor("six_months");
  const annual = priceFor("annual");

  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    tagline: plan.tagline,
    description: plan.description,
    short_description: plan.tagline ?? plan.description,
    currency: monthly?.currency ?? plan.prices[0]?.currency ?? "RWF",

    monthly_price: toNumber(monthly?.finalPrice),
    six_month_price: toNumber(sixMonths?.finalPrice),
    yearly_price: toNumber(annual?.finalPrice),
    six_month_discount: toNumber(sixMonths?.discountPercent),
    yearly_discount: toNumber(annual?.discountPercent),

    is_active: plan.isActive,
    is_public: plan.isPublic,
    is_popular: plan.isPopular,
    badge_text: plan.badgeText,
    button_label: null as string | null,
    trial_days: plan.trialDays,
    display_order: plan.displayOrder,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,

    prices: plan.prices.map((price) => ({
      id: price.id,
      billing_cycle: price.billingCycle,
      billing_months: price.billingMonths ?? 1,
      list_price: toNumber(price.listPrice),
      final_price: toNumber(price.finalPrice),
      discount_percent: toNumber(price.discountPercent),
      currency: price.currency,
      is_active: price.isActive,
    })),

    limits: plan.limits.map((limit) => ({
      id: limit.id,
      limit_key: limit.limitKey,
      name: limit.name,
      value: limit.isUnlimited ? null : limit.value,
      is_unlimited: limit.isUnlimited || limit.value === null,
      unit: limit.unit,
      display_order: limit.displayOrder,
    })),

    features: plan.features.map((feature) => ({
      id: feature.id,
      feature_key: feature.featureKey,
      name: feature.name,
      description: feature.description,
      category: feature.category,
      feature_type: feature.category,
      access_level: feature.accessLevel,
      display_note: feature.displayNote,
      is_highlighted: feature.isHighlighted,
      display_order: feature.displayOrder,
    })),
  };
}

export type SerializedPlan = ReturnType<typeof serializePlan>;

/**
 * What the signup and pricing screens may offer.
 *
 * The test plan is excluded here rather than by `isPublic`, because it has to
 * stay public to be selectable during onboarding when testing is switched on —
 * the plan screens read exactly this list. `SHOW_TEST_PLAN` is therefore the
 * only thing between "available for a RWF 100 rehearsal" and "on the pricing
 * page next to Professional".
 */
export async function listPublicPlans(): Promise<SerializedPlan[]> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
      isPublic: true,
      ...(env.SHOW_TEST_PLAN ? {} : { code: { not: TEST_PLAN_CODE } }),
    },
    include: planInclude,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return plans.map(serializePlan);
}

/** Every plan, shelved ones included — the platform console's view. */
export async function listAllPlans(): Promise<SerializedPlan[]> {
  const plans = await prisma.subscriptionPlan.findMany({
    include: planInclude,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return plans.map(serializePlan);
}

export async function getPlanByCode(code: string): Promise<SerializedPlan> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { code },
    include: planInclude,
  });

  if (!plan) throw HttpError.notFound("subscription.planNotFound", { code: "plan_not_found" });

  return serializePlan(plan);
}

export { planInclude };
