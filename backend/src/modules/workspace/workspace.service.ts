import { prisma } from "../../db/prisma";
import { HttpError } from "../../lib/httpError";

export type CreatePendingWorkspaceInput = {
  userId: string;
  email: string;
  displayName: string; // already client-side AES-encrypted, stored as opaque text
  businessName: string;
  businessPhone?: string; // already client-side AES-encrypted, stored as opaque text
  businessLocation?: string;
  businessType?: string;
  teamSize?: string;
  language?: string;
  planCode: string;
  billingCycle: "monthly" | "six_months" | "annual";
  paymentMethod?: string; // PaymentMethod.code, optional
};

/**
 * Port of V2's `create_pending_workspace_for_user` RPC intent, adapted per
 * this migration pass's scope decisions:
 *  - no email-confirmation gate (workspace is always created synchronously)
 *  - no subscription-approval workflow (new subscriptions are created
 *    pre-approved; the approve/reject RPCs and the "pending approval"
 *    login redirect are deferred to a later phase)
 */
export async function createPendingWorkspace(input: CreatePendingWorkspaceInput): Promise<{ tenantId: string }> {
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { code: input.planCode, isActive: true },
  });
  if (!plan) {
    throw HttpError.badRequest(`Invalid or inactive subscription plan: ${input.planCode}`);
  }

  const price = await prisma.subscriptionPlanPrice.findFirst({
    where: { planCode: input.planCode, billingCycle: input.billingCycle, isActive: true },
  });
  if (!price) {
    throw HttpError.badRequest(`No active price for plan ${input.planCode} / ${input.billingCycle}`);
  }

  if (input.paymentMethod) {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { code: input.paymentMethod, isActive: true },
    });
    if (!paymentMethod) {
      throw HttpError.badRequest(`Unknown payment method: ${input.paymentMethod}`);
    }
  }

  // Idempotency: if this user already has a tenant, return it rather than
  // creating a duplicate workspace.
  const existingMembership = await prisma.tenantMember.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "asc" },
  });
  if (existingMembership) {
    return { tenantId: existingMembership.tenantId };
  }

  const tenantId = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.businessName,
        ownerId: input.userId,
        contactEmail: input.email,
        subscriptionPlan: input.planCode,
        subscriptionStatus: "active",
        paymentStatus: "paid",
        billingCycle: input.billingCycle,
        onboardingCompleted: false,
        workspaceStatus: "active",
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
        displayName: input.displayName,
        phone: input.businessPhone,
        language: input.language || "en",
      },
      update: { tenantId: tenant.id },
    });

    await tx.tenantSubscription.create({
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
        subscriptionStatus: "active",
        paymentStatus: "paid",
        approvalStatus: "approved",
        activatedAt: new Date(),
      },
    });

    return tenant.id;
  });

  return { tenantId };
}
