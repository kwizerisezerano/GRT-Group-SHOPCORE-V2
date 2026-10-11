import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { addMonths, monthsForCycle } from "../../lib/billingPeriod";
import {
  emailBlindIndex,
  encrypt,
  encryptNullable,
  phoneBlindIndexNullable,
} from "../../lib/crypto";
import { sendAccountCreatedEmail, sendUserInvitedWithCredentialsEmail } from "../../lib/email/notifications";
import { HttpError } from "../../lib/httpError";
import { hashPassword } from "../../lib/password";
import { sendUserInvitedSms } from "../../lib/sms/notifications";
import { roleLabel } from "../../lib/permissions";

/**
 * Creating a workspace from the platform console.
 *
 * The same thing signup does, driven by a super admin instead of by the
 * customer: an owner account, a workspace, and a subscription on a chosen
 * plan. It exists because most workspaces on a product sold in this market
 * are opened by the vendor during a sales call, not by someone filling in a
 * web form at midnight — and doing that through the customer's own signup
 * page means knowing a password the customer should own.
 *
 * The owner therefore gets a generated password and is made to change it on
 * first sign-in (`mustChangePassword`), exactly like a member created by a
 * workspace admin.
 */

const PASSWORD_LENGTH = 14;
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*?-_";
const ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS;

const randomChar = (charset: string) => charset[crypto.randomInt(charset.length)];

/** Same recipe as users.service.ts: one of each class, shuffled, no lookalikes. */
function generateTemporaryPassword(): string {
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SYMBOLS)];
  const rest = Array.from({ length: PASSWORD_LENGTH - required.length }, () => randomChar(ALL_CHARS));
  const combined = [...required, ...rest];

  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join("");
}

export type CreateOrganizationInput = {
  businessName: string;
  ownerEmail: string;
  ownerName: string;
  ownerPhone?: string | null;
  businessLocation?: string | null;
  businessType?: string | null;
  teamSize?: string | null;
  language?: string | null;
  planCode: string;
  billingCycle: "monthly" | "six_months" | "annual";
  paymentMethodCode?: string | null;
  /**
   * Whether the workspace opens immediately. A super admin creating a
   * workspace after a signed contract marks it active; one recording an
   * enquiry leaves it awaiting payment.
   */
  activateImmediately: boolean;
  /** Free days granted on top of the plan's own trial. */
  trialDays?: number | null;
  createdByUserId: string;
};

export async function createOrganization(input: CreateOrganizationInput) {
  const emailHash = emailBlindIndex(input.ownerEmail);

  const existingUser = await prisma.user.findUnique({ where: { emailHash } });
  if (existingUser) {
    // Reusing the account would silently attach this workspace to someone
    // else's login. The console can add an existing person to an existing
    // workspace; creating a new one for them is a different decision and
    // belongs to a human.
    throw HttpError.conflict("platform.ownerEmailTaken", { code: "owner_email_taken" });
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: input.planCode } });
  if (!plan) {
    throw HttpError.badRequest("workspace.invalidPlan", {
      code: "invalid_plan",
      params: { plan: input.planCode },
    });
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

  if (input.paymentMethodCode) {
    const method = await prisma.paymentMethod.findFirst({
      where: { code: input.paymentMethodCode, isActive: true },
    });
    if (!method) {
      throw HttpError.badRequest("workspace.invalidPaymentMethod", {
        code: "invalid_payment_method",
        params: { method: input.paymentMethodCode },
      });
    }
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  const now = new Date();

  const trialDays = input.trialDays ?? plan.trialDays ?? 0;
  const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 86_400_000) : null;

  const months = monthsForCycle(input.billingCycle, price.billingMonths);
  const periodEnd = input.activateImmediately ? addMonths(now, months) : null;

  const phoneHash = phoneBlindIndexNullable(input.ownerPhone ?? undefined);
  const phoneTaken = phoneHash ? await prisma.profile.findUnique({ where: { phoneHash } }) : null;

  const { tenantId, userId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        emailEncrypted: encrypt(input.ownerEmail),
        emailHash,
        passwordHash,
        displayNameEncrypted: encrypt(input.ownerName),
        metadata: {
          mustChangePassword: true,
          createdByPlatformAdmin: true,
          businessName: input.businessName,
          businessPhone: encryptNullable(input.ownerPhone ?? undefined),
          businessLocation: input.businessLocation ?? null,
          businessType: input.businessType ?? null,
          teamSize: input.teamSize ?? null,
        },
      },
    });

    const tenant = await tx.tenant.create({
      data: {
        name: input.businessName,
        ownerId: user.id,
        contactEmailEncrypted: encrypt(input.ownerEmail),
        contactEmailHash: emailHash,
        subscriptionPlan: input.planCode,
        subscriptionStatus: input.activateImmediately ? "active" : "pending_payment",
        paymentStatus: input.activateImmediately ? "paid" : "pending",
        workspaceStatus: input.activateImmediately ? "active" : "pending_payment",
        billingCycle: input.billingCycle,
        trialStatus: trialEndsAt ? "active" : null,
        trialEndsAt,
        onboardingCompleted: false,
      },
    });

    await tx.tenantMember.create({
      data: { tenantId: tenant.id, userId: user.id, role: "owner", isDefault: true, status: "active" },
    });

    await tx.userRole.create({ data: { userId: user.id, tenantId: tenant.id, role: "owner" } });

    await tx.profile.create({
      data: {
        id: user.id,
        tenantId: tenant.id,
        displayNameEncrypted: encrypt(input.ownerName),
        // A number already on file belongs to somebody else's profile and the
        // hash is unique — storing none is better than failing the whole
        // workspace over a contact detail.
        phoneEncrypted: phoneTaken ? null : encryptNullable(input.ownerPhone ?? undefined),
        phoneHash: phoneTaken ? null : phoneHash,
        language: input.language || "en",
      },
    });

    await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        planCode: input.planCode,
        billingCycle: input.billingCycle,
        billingMonths: price.billingMonths,
        subscriptionAmount: price.finalPrice,
        subscriptionCurrency: price.currency,
        subscriptionDiscountPercent: price.discountPercent,
        paymentMethodCode: input.paymentMethodCode ?? null,
        subscriptionStatus: input.activateImmediately ? "active" : "pending_payment",
        paymentStatus: input.activateImmediately ? "paid" : "pending",
        approvalStatus: input.activateImmediately ? "approved" : "pending",
        requestedBy: input.createdByUserId,
        requestedAt: now,
        approvedBy: input.activateImmediately ? input.createdByUserId : null,
        approvedAt: input.activateImmediately ? now : null,
        activatedAt: input.activateImmediately ? now : null,
        currentPeriodStart: input.activateImmediately ? now : null,
        currentPeriodEnd: periodEnd,
        expiresAt: periodEnd,
        trialEndsAt,
      },
    });

    await tx.activityLog.create({
      data: {
        tenantId: tenant.id,
        userId: input.createdByUserId,
        action: "workspace_created",
        module: "platform",
        targetId: tenant.id,
        description: `Workspace created from the platform console on the ${plan.name} plan`,
        metadata: {
          plan: input.planCode,
          billingCycle: input.billingCycle,
          activated: input.activateImmediately,
        } as Prisma.InputJsonValue,
      },
    });

    return { tenantId: tenant.id, userId: user.id };
  });

  /*
   * Fire-and-forget, like every other transactional message here: the
   * workspace has already committed, and a mail failure must not report it as
   * not created. This is the only place the plaintext password is used after
   * hashing — it is never logged and never returned to the console.
   */
  const language = input.language ?? "en";

  void sendAccountCreatedEmail({
    to: input.ownerEmail,
    name: input.ownerName,
    workspace: input.businessName,
    language,
  });

  void sendUserInvitedWithCredentialsEmail({
    to: input.ownerEmail,
    name: input.ownerName,
    workspace: input.businessName,
    tempPassword,
    role: roleLabel("owner"),
    language,
  });

  if (input.ownerPhone) {
    void sendUserInvitedSms({
      to: input.ownerPhone,
      workspace: input.businessName,
      email: input.ownerEmail,
      tempPassword,
      language,
    });
  }

  return { tenantId, userId };
}
