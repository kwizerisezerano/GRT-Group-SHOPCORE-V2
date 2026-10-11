import { prisma } from "../../db/prisma";
import { emailBlindIndex, encrypt, encryptNullable, phoneBlindIndexNullable } from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";

export type CreatePendingWorkspaceInput = {
  userId: string;
  email: string;
  displayName: string; // plaintext in; encrypted server-side before storage
  businessName: string;
  businessPhone?: string; // plaintext in; encrypted server-side before storage
  businessLocation?: string;
  businessType?: string;
  teamSize?: string;
  language?: string;
  planCode: string;
  billingCycle: "monthly" | "six_months" | "annual";
  paymentMethod?: string; // PaymentMethod.code, optional
  /**
   * Whether an unpaid workspace should open on the plan's trial. Defaults to
   * true when the plan offers one; set false to create it closed and awaiting
   * payment instead.
   */
  startTrial?: boolean;
};

export type CreatePendingWorkspaceResult = {
  tenantId: string;
  subscriptionId: string | null;
  /** True when money still has to move before the workspace opens. */
  requiresPayment: boolean;
  amount: number;
  currency: string;
  planCode: string;
  billingCycle: string;
  trialEndsAt: Date | null;
  trialDays: number;
};

/**
 * Port of V2's `create_pending_workspace_for_user` RPC intent, adapted per
 * this migration pass's scope decisions:
 *  - no email-confirmation gate (workspace is always created synchronously)
 *
 * ## When the workspace opens
 *
 * Three outcomes, decided by how the customer said they would pay:
 *
 *  - **A plan with trial days** opens immediately and runs on the trial. This
 *    is the only path that grants access before any money moves, and it is
 *    time-boxed by `trialEndsAt`.
 *  - **Bank transfer** waits for a human. It is a push payment with no
 *    gateway callback - somebody has to look at a bank statement, which is
 *    what the platform console's approval queue is for.
 *  - **Mobile money and card** wait for the gateway. The charge is started by
 *    the caller (auth.service.ts signup) as soon as this returns, and the
 *    workspace opens from the payment callback (lib/payments/service.ts).
 *
 * What is gone is the old fourth outcome: treating a card or MoMo signup as
 * settled the moment the form was submitted. There was no gateway then; there
 * is now, and marking a subscription paid before anyone has paid is the one
 * bug in a billing system that costs real money.
 */
export async function createPendingWorkspace(
  input: CreatePendingWorkspaceInput
): Promise<CreatePendingWorkspaceResult> {
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { code: input.planCode, isActive: true },
  });
  if (!plan) {
    throw HttpError.badRequest("workspace.invalidPlan", { code: "invalid_plan", params: { plan: input.planCode } });
  }

  const price = await prisma.subscriptionPlanPrice.findFirst({
    where: { planCode: input.planCode, billingCycle: input.billingCycle, isActive: true },
  });
  if (!price) {
    throw HttpError.badRequest("workspace.invalidPrice", {
      code: "invalid_price",
      params: { plan: input.planCode, cycle: input.billingCycle },
    });
  }

  if (input.paymentMethod) {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { code: input.paymentMethod, isActive: true },
    });
    if (!paymentMethod) {
      throw HttpError.badRequest("workspace.invalidPaymentMethod", {
        code: "invalid_payment_method",
        params: { method: input.paymentMethod },
      });
    }
  }

  // Idempotency: if this user already has a tenant, return it rather than
  // creating a duplicate workspace.
  const existingMembership = await prisma.tenantMember.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "asc" },
  });
  if (existingMembership) {
    const existingSubscription = await prisma.tenantSubscription.findFirst({
      where: { tenantId: existingMembership.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return {
      tenantId: existingMembership.tenantId,
      subscriptionId: existingSubscription?.id ?? null,
      requiresPayment: existingSubscription?.paymentStatus !== "paid",
      amount: Number(existingSubscription?.subscriptionAmount ?? price.finalPrice),
      currency: existingSubscription?.subscriptionCurrency ?? price.currency,
      planCode: existingSubscription?.planCode ?? input.planCode,
      billingCycle: existingSubscription?.billingCycle ?? input.billingCycle,
      trialEndsAt: existingSubscription?.trialEndsAt ?? null,
      trialDays: 0,
    };
  }

  const now = new Date();

  /*
   * Bank transfer has no callback - a person has to match it against a bank
   * statement, which is what the console's approval queue is for. Mobile
   * money and card do have one, so they wait for it. A method the gateway
   * cannot charge and that is not bank transfer is treated as manual too:
   * safer to make somebody confirm than to open a workspace nobody has paid
   * for.
   */
  const isBankTransfer = input.paymentMethod === "bank_transfer";

  /*
   * A trial is the only way in before money moves.
   *
   * It is offered to somebody who has *not* chosen how to pay — the "start
   * free, decide later" path. Choosing MTN Mobile Money and then being given
   * fourteen free days would mean the charge the customer just authorised
   * never happens, which is neither what they expect nor what the business
   * wants; so picking a payment method always means paying now.
   */
  const trialDays = plan.trialDays ?? 0;

  /*
   * A trial is the "start free, decide later" path, and it is opt-in rather
   * than a consolation prize: `startTrial` is set by the button that says so.
   * Choosing a payment method always means paying now — being handed fourteen
   * free days after authorising a MoMo charge is not what anybody expects.
   */
  const wantsTrial = !input.paymentMethod && trialDays > 0 && input.startTrial !== false;
  const trialEndsAt = wantsTrial ? new Date(now.getTime() + trialDays * 86_400_000) : null;

  const opensImmediately = wantsTrial;
  const requiresPayment = !opensImmediately;

  const workspaceStatus = opensImmediately ? "active" : "pending_payment";
  const subscriptionStatus = opensImmediately ? (trialEndsAt ? "trial" : "active") : "pending_payment";
  const paymentStatus = opensImmediately && !trialEndsAt ? "paid" : "pending";
  const approvalStatus = isBankTransfer ? "pending" : opensImmediately ? "approved" : "pending";

  const created = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.businessName,
        ownerId: input.userId,
        contactEmailEncrypted: encrypt(input.email),
        contactEmailHash: emailBlindIndex(input.email),
        subscriptionPlan: input.planCode,
        subscriptionStatus,
        paymentStatus,
        trialStatus: trialEndsAt ? "active" : null,
        trialEndsAt,
        billingCycle: input.billingCycle,
        onboardingCompleted: false,
        workspaceStatus,
      },
    });

    await tx.tenantMember.create({
      data: { tenantId: tenant.id, userId: input.userId, role: "owner", isDefault: true },
    });

    await tx.userRole.create({
      data: { userId: input.userId, tenantId: tenant.id, role: "owner" },
    });

    await tx.profile.upsert({
      where: { id: input.userId },
      create: {
        id: input.userId,
        tenantId: tenant.id,
        displayNameEncrypted: encrypt(input.displayName),
        phoneEncrypted: encryptNullable(input.businessPhone),
        phoneHash: phoneBlindIndexNullable(input.businessPhone),
        language: input.language || "en",
      },
      update: { tenantId: tenant.id },
    });

    const subscription = await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        userId: input.userId,
        planCode: input.planCode,
        billingCycle: input.billingCycle,
        billingMonths: price.billingMonths,
        subscriptionAmount: price.finalPrice,
        subscriptionCurrency: price.currency,
        subscriptionDiscountPercent: price.discountPercent,
        paymentMethodCode: input.paymentMethod,
        subscriptionStatus,
        paymentStatus,
        approvalStatus,
        trialEndsAt,
        requestedBy: input.userId,
        requestedAt: now,
        /*
         * Neither is set here, whatever the workspace's state.
         *
         * `activatedAt` means "a payment activated this subscription", and a
         * trial has not been paid for — lib/subscriptionState.ts reads exactly
         * that field to tell a trial apart from a paid term, so stamping it on
         * a trial made every trial resolve as an unpaid subscription and shut
         * the workspace the moment it opened. Both are set by
         * applyPaymentResult when money actually lands.
         */
        activatedAt: undefined,
        currentPeriodStart: undefined,
      },
    });

    return { tenantId: tenant.id, subscriptionId: subscription.id };
  });

  return {
    tenantId: created.tenantId,
    subscriptionId: created.subscriptionId,
    /*
     * True whenever the workspace is closed pending money — including the
     * case where no payment method was chosen and the plan grants no trial,
     * which leaves the customer to pay from the billing screen. The caller
     * reads the chosen payment method separately to tell a chargeable one
     * from bank transfer, which no gateway can settle.
     */
    requiresPayment,
    amount: Number(price.finalPrice),
    currency: price.currency,
    planCode: input.planCode,
    billingCycle: input.billingCycle,
    trialEndsAt,
    /** How long the trial runs, so the caller can say so without re-reading. */
    trialDays: wantsTrial ? trialDays : 0,
  };
}
