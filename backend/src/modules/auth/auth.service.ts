import { prisma } from "../../db/prisma";
import { loadPermissions } from "../../middleware/requirePermission";
import {
  decryptNullable,
  emailBlindIndex,
  encrypt,
  encryptNullable,
  phoneBlindIndexNullable,
} from "../../lib/crypto";
import {
  sendAccountCreatedEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendSubscriptionActivatedEmail,
} from "../../lib/email/notifications";
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

type StoredUser = { id: string; emailEncrypted: string; displayNameEncrypted: string | null };

/**
 * The only place a User row is turned back into readable fields. Everything
 * that returns a user to a caller goes through here, so decryption is not
 * scattered across the module.
 */
function publicUser(user: StoredUser) {
  return {
    id: user.id,
    email: decryptNullable(user.emailEncrypted),
    displayName: decryptNullable(user.displayNameEncrypted),
  };
}

export async function signup(input: SignupInput) {
  const emailHash = emailBlindIndex(input.email);

  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    throw HttpError.conflict("auth.emailExists");
  }

  // The phone is unique across profiles, so reject a duplicate here with a
  // clear 409 rather than letting the database constraint surface as a 500.
  const phoneHash = phoneBlindIndexNullable(input.businessPhone);
  if (phoneHash) {
    const phoneTaken = await prisma.profile.findUnique({ where: { phoneHash } });
    if (phoneTaken) {
      throw HttpError.conflict("auth.phoneExists");
    }
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      emailEncrypted: encrypt(input.email),
      emailHash,
      passwordHash,
      displayNameEncrypted: encrypt(input.displayName),
      metadata: {
        businessName: input.businessName,
        // Business phone is PII too, so it is encrypted inside the metadata
        // blob rather than sitting in the clear in JSON.
        businessPhone: encryptNullable(input.businessPhone),
        businessLocation: input.businessLocation ?? null,
        businessType: input.businessType ?? null,
        teamSize: input.teamSize ?? null,
      },
    },
  });

  await prisma.profile.create({
    data: {
      id: user.id,
      displayNameEncrypted: encrypt(input.displayName),
      phoneEncrypted: encryptNullable(input.businessPhone),
      phoneHash,
      language: input.language || "en",
    },
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

  // Fire-and-forget: a delivery failure must not fail a signup that has
  // already committed. sendNotification swallows and logs its own errors.
  const language = input.language ?? "en";
  void sendAccountCreatedEmail({
    to: input.email,
    name: input.displayName,
    workspace: input.businessName,
    language,
  });
  void sendSubscriptionActivatedEmail({
    to: input.email,
    name: input.displayName,
    workspace: input.businessName,
    plan: input.planCode,
    cycle: input.billingCycle,
    language,
  });

  return { user: publicUser(user), tenantId, ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { emailHash: emailBlindIndex(input.email) } });
  if (!user) {
    throw HttpError.unauthorized("auth.invalidCredentials", { code: "invalid_credentials" });
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw HttpError.unauthorized("auth.invalidCredentials", { code: "invalid_credentials" });
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
    throw HttpError.unauthorized("auth.invalidRefreshToken", { code: "invalid_refresh_token" });
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    throw HttpError.unauthorized("auth.invalidRefreshToken", { code: "invalid_refresh_token" });
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
    throw HttpError.unauthorized("auth.invalidToken", { code: "user_not_found" });
  }

  const membership = await primaryMembership(userId);

  const permissions = membership?.tenantId
    ? (await loadPermissions(userId, membership.tenantId)).permissions
    : [];

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
    /*
     * The permissions the server will actually enforce for this caller, so the
     * client can hide what would be refused rather than guessing. This was an
     * empty array with a note saying it was out of scope, which left the whole
     * frontend permission model — RoleGate, canViewModule — fed by nothing.
     *
     * Also what the desktop app caches for offline use: with no connection it
     * cannot ask, so it must already know.
     */
    permissions,
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
  const user = await prisma.user.findUnique({
    where: { emailHash: emailBlindIndex(email) },
    include: { profile: true },
  });
  if (user) {
    const reset = generatePasswordResetToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: reset.hash, expiresAt: reset.expiresAt },
    });
    await sendPasswordResetEmail({
      to: email,
      name: decryptNullable(user.displayNameEncrypted) ?? email,
      resetToken: reset.token,
      language: user.profile?.language,
    });
  }
  // Always the same response, whether or not the account exists.
}

export async function completePasswordReset(token: string, newPassword: string) {
  const tokenHash = hashPasswordResetToken(token);
  const stored = await prisma.passwordResetToken.findFirst({ where: { tokenHash } });

  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw HttpError.badRequest("auth.invalidResetToken", { code: "invalid_reset_token" });
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

  // Tell the account holder their password changed — the signal that matters
  // if someone else did it.
  const owner = await prisma.user.findUnique({
    where: { id: stored.userId },
    include: { profile: true },
  });
  if (owner) {
    const email = decryptNullable(owner.emailEncrypted);
    if (email) {
      void sendPasswordChangedEmail({
        to: email,
        name: decryptNullable(owner.displayNameEncrypted) ?? email,
        language: owner.profile?.language,
      });
    }
  }
}
