import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { CAPACITY_KEYS, CAPACITY_LABELS } from "../../lib/planLimits";
import { getPlanByCode, listAllPlans } from "../subscription/subscription.service";

/**
 * The platform console's plan editor.
 *
 * This is where "3 users, 2 branches" is actually typed. A super admin
 * creates the plan, prices it per billing cycle, and lists the ceilings it
 * imposes; the same rows are then read by the signup page (what a customer
 * buys), by lib/planLimits.ts (what the server refuses) and by the workspace's
 * own usage panel (what it has left). Nothing about a plan lives in code.
 *
 * Prices, limits and features are edited as whole sets rather than row by
 * row. A plan is a document a person writes and saves; a PATCH-per-row API
 * would let a save half-apply and leave a plan priced for a cycle it no
 * longer offers.
 */
export const platformPlansRouter = Router();

const planCodeSchema = z
  .string()
  .trim()
  .min(2, "A plan code is required")
  .max(32)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers and underscores, starting with a letter");

const priceSchema = z.object({
  billingCycle: z.enum(["monthly", "six_months", "annual"]),
  billingMonths: z.coerce.number().int().min(1).max(60).optional(),
  listPrice: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  currency: z.string().trim().min(2).max(8).default("RWF"),
  isActive: z.boolean().default(true),
});

const limitSchema = z
  .object({
    limitKey: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers and underscores"),
    name: z.string().trim().min(1).max(191),
    value: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
    isUnlimited: z.boolean().default(false),
    unit: z.string().trim().max(32).nullable().optional(),
    displayOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .superRefine((limit, ctx) => {
    // A ceiling that is neither a number nor explicitly unlimited is not a
    // ceiling — it is a plan that silently allows everything, which is the
    // exact failure this whole feature exists to prevent.
    if (!limit.isUnlimited && (limit.value === null || limit.value === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Enter a number, or mark the limit unlimited",
      });
    }
  });

const featureSchema = z.object({
  featureKey: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_.]*$/, "Use lowercase letters, numbers, dots and underscores"),
  name: z.string().trim().min(1).max(191),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(64).default("modules"),
  accessLevel: z.enum(["included", "limited", "addon", "unavailable"]).default("included"),
  displayNote: z.string().trim().max(255).nullable().optional(),
  isHighlighted: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const planBodySchema = z.object({
  name: z.string().trim().min(1).max(191),
  tagline: z.string().trim().max(255).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  badgeText: z.string().trim().max(64).nullable().optional(),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
  prices: z.array(priceSchema).default([]),
  limits: z.array(limitSchema).default([]),
  features: z.array(featureSchema).default([]),
});

/** camelCase or snake_case on the wire; the console sends one, scripts the other. */
function readPlanBody(body: Record<string, unknown>) {
  return {
    name: body.name,
    tagline: body.tagline,
    description: body.description,
    isActive: body.isActive ?? body.is_active,
    isPublic: body.isPublic ?? body.is_public,
    isPopular: body.isPopular ?? body.is_popular,
    badgeText: body.badgeText ?? body.badge_text,
    trialDays: body.trialDays ?? body.trial_days,
    displayOrder: body.displayOrder ?? body.display_order,
    prices: readRows(body.prices, (row) => ({
      billingCycle: row.billingCycle ?? row.billing_cycle,
      billingMonths: row.billingMonths ?? row.billing_months,
      listPrice: row.listPrice ?? row.list_price,
      discountPercent: row.discountPercent ?? row.discount_percent,
      currency: row.currency,
      isActive: row.isActive ?? row.is_active,
    })),
    limits: readRows(body.limits, (row) => ({
      limitKey: row.limitKey ?? row.limit_key,
      name: row.name,
      value: row.value,
      isUnlimited: row.isUnlimited ?? row.is_unlimited,
      unit: row.unit,
      displayOrder: row.displayOrder ?? row.display_order,
    })),
    features: readRows(body.features, (row) => ({
      featureKey: row.featureKey ?? row.feature_key,
      name: row.name,
      description: row.description,
      category: row.category,
      accessLevel: row.accessLevel ?? row.access_level,
      displayNote: row.displayNote ?? row.display_note,
      isHighlighted: row.isHighlighted ?? row.is_highlighted,
      displayOrder: row.displayOrder ?? row.display_order,
    })),
  };
}

function readRows(
  value: unknown,
  map: (row: Record<string, unknown>) => Record<string, unknown>
): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((row) => {
    const mapped = map((row ?? {}) as Record<string, unknown>);
    // Drop keys the caller did not send so Zod's defaults still apply.
    return Object.fromEntries(Object.entries(mapped).filter(([, v]) => v !== undefined));
  });
}

const finalPrice = (listPrice: number, discountPercent: number) =>
  Math.round(listPrice * (1 - discountPercent / 100));

const CYCLE_MONTHS: Record<string, number> = { monthly: 1, six_months: 6, annual: 12 };

type PlanInput = z.infer<typeof planBodySchema>;

/**
 * Replaces a plan's prices, limits and features in one transaction.
 *
 * `deleteMany` then `createMany`, rather than a diff: the editor sends the
 * complete intended set, and rebuilding it is both simpler and impossible to
 * get subtly wrong. The plan itself is never deleted, so nothing that points
 * at it by code is disturbed.
 */
async function writePlanRelations(planCode: string, input: PlanInput) {
  await prisma.$transaction([
    prisma.subscriptionPlanPrice.deleteMany({ where: { planCode } }),
    prisma.subscriptionPlanPrice.createMany({
      data: input.prices.map((price) => ({
        planCode,
        billingCycle: price.billingCycle,
        billingMonths: price.billingMonths ?? CYCLE_MONTHS[price.billingCycle] ?? 1,
        listPrice: new Prisma.Decimal(price.listPrice),
        finalPrice: new Prisma.Decimal(finalPrice(price.listPrice, price.discountPercent)),
        discountPercent: new Prisma.Decimal(price.discountPercent),
        currency: price.currency,
        isActive: price.isActive,
      })),
    }),
    prisma.subscriptionPlanLimit.deleteMany({ where: { planCode } }),
    prisma.subscriptionPlanLimit.createMany({
      data: input.limits.map((limit) => ({
        planCode,
        limitKey: limit.limitKey,
        name: limit.name,
        value: limit.isUnlimited ? null : limit.value ?? 0,
        isUnlimited: limit.isUnlimited,
        unit: limit.unit ?? null,
        displayOrder: limit.displayOrder,
      })),
    }),
    prisma.subscriptionPlanFeature.deleteMany({ where: { planCode } }),
    prisma.subscriptionPlanFeature.createMany({
      data: input.features.map((feature) => ({
        planCode,
        featureKey: feature.featureKey,
        name: feature.name,
        description: feature.description ?? null,
        category: feature.category,
        accessLevel: feature.accessLevel,
        displayNote: feature.displayNote ?? null,
        isHighlighted: feature.isHighlighted,
        displayOrder: feature.displayOrder,
      })),
    }),
  ]);
}

/**
 * The capacities this server actually meters, offered to the console's limit
 * picker so an operator types "users" rather than "user_seats" and finds out
 * six months later that nothing was ever enforced.
 */
platformPlansRouter.get(
  "/capacity-keys",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      messageKey: "subscription.plansListed",
      data: {
        capacity_keys: CAPACITY_KEYS.map((key) => ({
          limit_key: key,
          name: CAPACITY_LABELS[key].name,
          unit: CAPACITY_LABELS[key].unit,
          /*
           * Honest about what is checked. A ceiling on a capacity nothing
           * counts yet is still worth advertising on a pricing page, but the
           * operator should know the server will not stop anyone.
           */
          enforced: !["pos_terminals", "desktop_devices", "storage_gb"].includes(key),
        })),
      },
    });
  })
);

platformPlansRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const plans = await listAllPlans();

    const counts = await prisma.tenantSubscription.groupBy({
      by: ["planCode"],
      _count: { _all: true },
    });
    const subscriberByPlan = new Map(counts.map((row) => [row.planCode, row._count._all]));

    sendSuccess(res, {
      messageKey: "subscription.plansListed",
      data: {
        plans: plans.map((plan) => ({
          ...plan,
          subscriber_count: subscriberByPlan.get(plan.code) ?? 0,
        })),
      },
    });
  })
);

platformPlansRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const plan = await getPlanByCode(req.params.code);
    sendSuccess(res, { messageKey: "subscription.planFetched", data: { plan } });
  })
);

platformPlansRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = planCodeSchema.parse(body.code ?? body.planCode ?? body.plan_code);
    const input = planBodySchema.parse(readPlanBody(body));

    const existing = await prisma.subscriptionPlan.findUnique({ where: { code } });
    if (existing) throw HttpError.conflict("subscription.planCodeTaken", { code: "plan_code_taken" });

    if (input.isActive && input.prices.length === 0) {
      throw HttpError.badRequest("subscription.priceRequired", { code: "price_required" });
    }

    await prisma.subscriptionPlan.create({
      data: {
        code,
        name: input.name,
        tagline: input.tagline ?? null,
        description: input.description ?? null,
        isActive: input.isActive,
        isPublic: input.isPublic,
        isPopular: input.isPopular,
        badgeText: input.badgeText ?? null,
        trialDays: input.trialDays,
        displayOrder: input.displayOrder,
      },
    });

    await writePlanRelations(code, input);

    const plan = await getPlanByCode(code);
    sendSuccess(res, { messageKey: "subscription.planCreated", status: 201, data: { plan } });
  })
);

platformPlansRouter.patch(
  "/:code",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const existing = await prisma.subscriptionPlan.findUnique({ where: { code } });
    if (!existing) throw HttpError.notFound("subscription.planNotFound", { code: "plan_not_found" });

    const input = planBodySchema.parse(readPlanBody(body));

    if (input.isActive && input.prices.length === 0) {
      throw HttpError.badRequest("subscription.priceRequired", { code: "price_required" });
    }

    await prisma.subscriptionPlan.update({
      where: { code },
      data: {
        name: input.name,
        tagline: input.tagline ?? null,
        description: input.description ?? null,
        isActive: input.isActive,
        isPublic: input.isPublic,
        isPopular: input.isPopular,
        badgeText: input.badgeText ?? null,
        trialDays: input.trialDays,
        displayOrder: input.displayOrder,
      },
    });

    await writePlanRelations(code, input);

    const plan = await getPlanByCode(code);
    sendSuccess(res, { messageKey: "subscription.planUpdated", data: { plan } });
  })
);

/**
 * Deleting a plan is refused while any workspace is on it.
 *
 * Cascading would take the prices and ceilings with it and leave those
 * workspaces resolving to no limits at all — which reads as "unlimited" to
 * lib/planLimits.ts. Deactivating is the operation the operator actually
 * wants: it clears the plan off the pricing page while everyone on it keeps
 * exactly what they bought.
 */
platformPlansRouter.delete(
  "/:code",
  asyncHandler(async (req, res) => {
    const code = req.params.code;

    const existing = await prisma.subscriptionPlan.findUnique({ where: { code } });
    if (!existing) throw HttpError.notFound("subscription.planNotFound", { code: "plan_not_found" });

    const subscribers = await prisma.tenantSubscription.count({ where: { planCode: code } });
    if (subscribers > 0) {
      throw HttpError.conflict("subscription.planInUse", {
        code: "plan_in_use",
        details: { subscriber_count: subscribers },
      });
    }

    await prisma.subscriptionPlan.delete({ where: { code } });
    sendSuccess(res, { messageKey: "subscription.planDeleted" });
  })
);
