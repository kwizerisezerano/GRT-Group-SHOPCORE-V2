import { prisma } from "../../db/prisma";
import { sendPasswordResetEmail } from "../../lib/email";
import { HttpError } from "../../lib/httpError";
import {
  generatePasswordResetToken,
  generateRefreshToken,
  hashPasswordResetToken,
  hashRefreshToken,
  signAccessToken,
} from "../../lib/jwt";
import { hashPassword, verifyPassword } from "../../lib/password";
import { createPendingWorkspace } from "../workspace/workspace.service";
import { LoginInput, SignupInput } from "./auth.schemas";

async function issueTokenPair(user: { id: string }, tenantId: string | null, role: string | null) {
  const accessToken = signAccessToken({ sub: user.id, tenantId, role });
  const refresh = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: refresh.hash, expiresAt: refresh.expiresAt },
  });
  return { accessToken, refreshToken: refresh.token };
}

async function primaryMembership(userId: string) {
  return prisma.tenantMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { tenant: true },
  });
}

function publicUser(user: { id: string; email: string; displayName: string | null }) {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw HttpError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      metadata: {
        businessName: input.businessName,
        businessPhone: input.businessPhone ?? null,
        businessLocation: input.businessLocation ?? null,
        businessType: input.businessType ?? null,
        teamSize: input.teamSize ?? null,
      },
    },
  });

  await prisma.profile.create({
    data: { id: user.id, displayName: input.displayName, language: input.language || "en" },
  });

  const { tenantId } = await createPendingWorkspace({
    userId: user.id,
    email: input.email,
    displayName: input.displayName,
    businessName: input.businessName,
    businessPhone: input.businessPhone,
    businessLocation: input.businessLocation,
    businessType: input.businessType,
    teamSize: input.teamSize,
    language: input.language,
    planCode: input.planCode,
    billingCycle: input.billingCycle,
    paymentMethod: input.paymentMethod,
  });

  const tokens = await issueTokenPair(user, tenantId, "owner");

  return { user: publicUser(user), tenantId, ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw HttpError.unauthorized("Invalid email or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw HttpError.unauthorized("Invalid email or password");
  }

  const membership = await primaryMembership(user.id);
  const tokens = await issueTokenPair(user, membership?.tenantId ?? null, membership?.role ?? null);

  return {
    user: publicUser(user),
    tenant: membership ? { id: membership.tenant.id, name: membership.tenant.name, role: membership.role } : null,
    ...tokens,
  };
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw HttpError.unauthorized("Invalid or expired refresh token");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    throw HttpError.unauthorized("Invalid or expired refresh token");
  }

  const membership = await primaryMembership(user.id);
  return issueTokenPair(user, membership?.tenantId ?? null, membership?.role ?? null);
}

export async function logout(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw HttpError.unauthorized("User not found");
  }

  const membership = await primaryMembership(userId);
  const subscription = membership
    ? await prisma.tenantSubscription.findFirst({
        where: { tenantId: membership.tenantId },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return {
    user: publicUser(user),
    tenant: membership
      ? {
          id: membership.tenant.id,
          name: membership.tenant.name,
          subscription_plan: membership.tenant.subscriptionPlan,
          subscription_status: membership.tenant.subscriptionStatus,
          payment_status: membership.tenant.paymentStatus,
          trial_status: membership.tenant.trialStatus,
          trial_ends_at: membership.tenant.trialEndsAt,
          onboarding_completed: membership.tenant.onboardingCompleted,
          workspace_status: membership.tenant.workspaceStatus,
          billing_cycle: membership.tenant.billingCycle,
        }
      : null,
    role: membership?.role ?? null,
    // Fine-grained role_permissions loading is out of Phase 1 scope (that
    // table isn't modeled yet - see Phase 5 in the migration roadmap).
    permissions: [] as string[],
    subscription: subscription
      ? {
          plan_code: subscription.planCode,
          status: subscription.subscriptionStatus,
          billing_cycle: subscription.billingCycle,
          current_period_start: subscription.currentPeriodStart,
          current_period_end: subscription.currentPeriodEnd,
          trial_ends_at: subscription.trialEndsAt,
        }
      : null,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  if (user) {
    const reset = generatePasswordResetToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: reset.hash, expiresAt: reset.expiresAt },
    });
    await sendPasswordResetEmail(email, reset.token, user.profile?.language);
  }
  // Always the same response, whether or not the account exists.
}

export async function completePasswordReset(token: string, newPassword: string) {
  const tokenHash = hashPasswordResetToken(token);
  const stored = await prisma.passwordResetToken.findFirst({ where: { tokenHash } });

  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw HttpError.badRequest("Invalid or expired reset token");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
