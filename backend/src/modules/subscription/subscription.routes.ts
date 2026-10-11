import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toSnakeCase } from "../../lib/caseMapping";
import { decryptNullable } from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import { buildCapacityReport, isCapacityKey, resolveEntitlements } from "../../lib/planLimits";
import {
  daysRemaining,
  isSubscriptionOpen,
  resolveSubscriptionState,
} from "../../lib/subscriptionState";
import { startSubscriptionPayment } from "../../lib/payments/service";
import { requireAuth } from "../../middleware/auth";
import { requireTenant } from "../../middleware/requireTenant";
import { getPlanByCode, listPublicPlans } from "./subscription.service";

/**
 * A workspace's own view of its subscription.
 *
 * Split from the platform console's router because these routes answer for
 * exactly one tenant — the caller's — and are reachable by any signed-in
 * member. What a plan costs and what it allows is not privileged information
 * inside the workspace paying for it.
 */
export const subscriptionRouter = Router();

/** The public catalogue. No auth: the pricing page is on the marketing site. */
subscriptionRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await listPublicPlans();
    sendSuccess(res, { messageKey: "subscription.plansListed", data: { plans } });
  })
);

subscriptionRouter.get(
  "/plans/:code",
  asyncHandler(async (req, res) => {
    const plan = await getPlanByCode(req.params.code);
    sendSuccess(res, { messageKey: "subscription.planFetched", data: { plan } });
  })
);

subscriptionRouter.get(
  "/payment-methods",
  asyncHandler(async (_req, res) => {
    const methods = await prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    sendSuccess(res, {
      messageKey: "payments.methodsListed",
      data: {
        payment_methods: methods.map((method) => ({
          code: method.code,
          name: method.name,
          description: method.description,
          provider: method.provider,
          display_order: method.displayOrder,
          supports_recurring: method.supportsRecurring,
          supports_one_time: method.supportsOneTime,
          currency: method.currency,
          /*
           * Whether this method needs a phone number before it can be
           * charged. The form has to know before it is submitted, and
           * hard-coding "MTN or Airtel" in the browser would drift the first
           * time a method is added in the console.
           */
          requires_phone: method.provider === "mtn" || method.provider === "airtel",
          is_manual: method.provider === "manual",
        })),
      },
    });
  })
);

// ---------------------------------------------- the caller's own workspace ---

subscriptionRouter.use(requireAuth, requireTenant);

/**
 * Everything the frontend's commercial-access layer needs: the plan's
 * features, its ceilings, and how much of each is already spent. Loaded once
 * per session by AuthContext and read from there by PlanGuard.
 */
subscriptionRouter.get(
  "/entitlements",
  asyncHandler(async (req, res) => {
    const entitlements = await resolveEntitlements(req.tenantId!);
    sendSuccess(res, { messageKey: "subscription.entitlementsLoaded", data: entitlements });
  })
);

/**
 * Just the capacity table. Separate from /entitlements because the screens
 * that show "3 of 5 seats used" re-read it after every create, and there is
 * no reason to re-send the feature catalogue each time.
 */
subscriptionRouter.get(
  "/usage",
  asyncHandler(async (req, res) => {
    const capacities = await buildCapacityReport(req.tenantId!);
    sendSuccess(res, { messageKey: "subscription.usageLoaded", data: { capacities } });
  })
);

subscriptionRouter.get(
  "/usage/:limitKey",
  asyncHandler(async (req, res) => {
    const key = req.params.limitKey;
    const capacities = await buildCapacityReport(req.tenantId!);
    const capacity = capacities.find((entry) => entry.limit_key === key);

    if (!capacity) {
      if (!isCapacityKey(key)) throw HttpError.notFound("error.notFound", { code: "unknown_limit" });
      throw HttpError.notFound("error.notFound", { code: "unknown_limit" });
    }

    sendSuccess(res, { messageKey: "subscription.usageLoaded", data: capacity });
  })
);

/** The workspace's current subscription, with the plan it points at. */
subscriptionRouter.get(
  "/current",
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;

    const subscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { paymentMethod: { select: { code: true, name: true } } },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        paymentStatus: true,
        workspaceStatus: true,
        billingCycle: true,
        trialEndsAt: true,
      },
    });

    const planCode = subscription?.planCode ?? tenant?.subscriptionPlan ?? null;
    const plan = planCode ? await getPlanByCode(planCode).catch(() => null) : null;

    /*
     * The period, as something a person can read.
     *
     * "Renews on 26 September" answers a different question from "9 of 30 days
     * used", and the second is the one somebody checks when they are deciding
     * whether to keep paying. Computed here rather than in the browser so the
     * trial and the paid term are measured the same way — a trial's clock runs
     * from trialEndsAt, a paid term's from currentPeriodEnd, and getting that
     * wrong shows a customer the wrong number of days left.
     */
    const state = resolveSubscriptionState(subscription);
    const isTrial = state === "trial";

    const periodStart = isTrial
      ? subscription?.createdAt ?? null
      : subscription?.currentPeriodStart ?? subscription?.createdAt ?? null;

    const periodEnd = isTrial
      ? subscription?.trialEndsAt ?? null
      : subscription?.currentPeriodEnd ?? subscription?.expiresAt ?? null;

    const totalDays =
      periodStart && periodEnd
        ? Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000))
        : null;

    const remaining = daysRemaining(subscription);

    const usedDays =
      totalDays === null || remaining === null
        ? null
        : Math.min(totalDays, Math.max(0, totalDays - Math.max(0, remaining)));

    sendSuccess(res, {
      messageKey: "subscription.entitlementsLoaded",
      data: {
        tenant: toSnakeCase(tenant ?? {}),
        plan,
        period: {
          state,
          is_open: isSubscriptionOpen(state),
          is_trial: isTrial,
          starts_at: periodStart,
          ends_at: periodEnd,
          total_days: totalDays,
          used_days: usedDays,
          /* Negative once the term has run out, which the screens read as "overdue by". */
          remaining_days: remaining,
          percent_used:
            totalDays && usedDays !== null
              ? Math.min(100, Math.round((usedDays / totalDays) * 100))
              : null,
        },
        subscription: subscription
          ? {
              id: subscription.id,
              plan_code: subscription.planCode,
              billing_cycle: subscription.billingCycle,
              amount: subscription.subscriptionAmount,
              currency: subscription.subscriptionCurrency,
              status: subscription.subscriptionStatus,
              payment_status: subscription.paymentStatus,
              approval_status: subscription.approvalStatus,
              payment_method_code: subscription.paymentMethodCode,
              payment_method_name: subscription.paymentMethod?.name ?? null,
              payment_reference: subscription.paymentReference,
              current_period_start: subscription.currentPeriodStart,
              current_period_end: subscription.currentPeriodEnd,
              expires_at: subscription.expiresAt,
              trial_ends_at: subscription.trialEndsAt,
              activated_at: subscription.activatedAt,
              created_at: subscription.createdAt,
            }
          : null,
      },
    });
  })
);

const checkoutSchema = z.object({
  /** Omitted means "pay for what I am already on" — the renewal case. */
  planCode: z.string().trim().min(1).max(32).optional(),
  billingCycle: z.enum(["monthly", "six_months", "annual"]).optional(),
  paymentMethodCode: z.string().trim().min(1).max(32),
  payerPhone: z.string().trim().max(32).nullable().optional(),
});

/**
 * Charges the workspace for its subscription — first payment or renewal.
 *
 * Switching plan at the same time is allowed and is the normal way an upgrade
 * happens: the subscription row is moved to the new plan and cycle *before*
 * the charge, so the amount put on the wire and the plan the workspace ends
 * up on cannot disagree. The workspace is not opened here; that waits for the
 * gateway to confirm (lib/payments/service.ts).
 */
subscriptionRouter.post(
  "/checkout",
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const input = checkoutSchema.parse({
      planCode: body.planCode ?? body.plan_code,
      billingCycle: body.billingCycle ?? body.billing_cycle,
      paymentMethodCode: body.paymentMethodCode ?? body.payment_method_code ?? body.paymentMethod,
      payerPhone: body.payerPhone ?? body.payer_phone ?? body.phone,
    });

    const subscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      throw HttpError.badRequest("payments.noSubscription", { code: "no_subscription" });
    }

    const planCode = input.planCode ?? subscription.planCode;
    const billingCycle = input.billingCycle ?? subscription.billingCycle;

    const price = await prisma.subscriptionPlanPrice.findFirst({
      where: { planCode, billingCycle, isActive: true },
    });

    if (!price) {
      throw HttpError.badRequest("workspace.invalidPrice", {
        code: "invalid_price",
        params: { plan: planCode, cycle: billingCycle },
      });
    }

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { code: input.paymentMethodCode, isActive: true },
    });

    if (!paymentMethod) {
      throw HttpError.badRequest("workspace.invalidPaymentMethod", {
        code: "invalid_payment_method",
        params: { method: input.paymentMethodCode },
      });
    }

    // Moving the subscription first means a gateway callback that arrives
    // while this request is still finishing activates the plan that was
    // actually paid for.
    const updated = await prisma.tenantSubscription.update({
      where: { id: subscription.id },
      data: {
        planCode,
        billingCycle,
        billingMonths: price.billingMonths,
        subscriptionAmount: price.finalPrice,
        subscriptionCurrency: price.currency,
        subscriptionDiscountPercent: price.discountPercent,
        paymentMethodCode: paymentMethod.code,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { emailEncrypted: true, displayNameEncrypted: true },
    });

    const result = await startSubscriptionPayment({
      tenantId,
      userId: req.user!.id,
      subscriptionId: updated.id,
      planCode,
      billingCycle,
      amount: Number(price.finalPrice),
      currency: price.currency,
      paymentMethodCode: paymentMethod.code,
      payerPhone: input.payerPhone ?? null,
      email: decryptNullable(user?.emailEncrypted ?? null) ?? "",
      name: decryptNullable(user?.displayNameEncrypted ?? null) ?? "Workspace owner",
      purpose: updated.activatedAt ? "renewal" : "subscription",
    });

    sendSuccess(res, { messageKey: "payments.initiated", data: result, status: 202 });
  })
);
