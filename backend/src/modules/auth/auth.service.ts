import crypto from "node:crypto";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
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
  sendLoginOtpEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendSubscriptionActivatedEmail,
} from "../../lib/email/notifications";
import { HttpError } from "../../lib/httpError";
import { sendLoginOtpSms } from "../../lib/sms/notifications";
import {
  generatePasswordResetToken,
  generateRefreshToken,
  hashPasswordResetToken,
  hashRefreshToken,
  signAccessToken,
} from "../../lib/jwt";
import { hashPassword, verifyPassword } from "../../lib/password";
import {
  daysRemaining,
  isSubscriptionOpen,
  resolveSubscriptionState,
} from "../../lib/subscriptionState";
import { gatewayMethodFor } from "../../lib/payments/lmbtech";
import { startSubscriptionPayment } from "../../lib/payments/service";
import { createPendingWorkspace } from "../workspace/workspace.service";
import { LoginInput, SignupInput } from "./auth.schemas";

/**
 * Exported because creating a workspace changes which tenant the caller
 * belongs to, and the tenant is baked into the access token. The endpoint
 * that opens a workspace has to hand back a token that knows about it —
 * see modules/workspace/workspace.routes.ts.
 */
export async function issueTokenPair(
  user: { id: string },
  tenantId: string | null,
  role: string | null
) {
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

/**
 * The workspace name to stamp on outbound mail to this person.
 *
 * Best-effort by design. A password reset can be asked for by someone whose
 * tenant was never finished, and a platform admin has no membership at all —
 * neither is a reason to fail or delay the email, so an unresolved name just
 * leaves the workspace line off it.
 */
async function mailWorkspaceName(userId: string): Promise<string | null> {
  try {
    const membership = await primaryMembership(userId);
    return membership?.tenant?.name ?? null;
  } catch (error) {
    console.error("[auth] could not resolve a workspace name for email:", error);
    return null;
  }
}

type StoredUser = {
  id: string;
  emailEncrypted: string;
  displayNameEncrypted: string | null;
  metadata?: unknown;
};

/** True once `metadata.mustChangePassword` has been set and not yet cleared. */
function mustChangePassword(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).mustChangePassword === true
  );
}

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
    // Set on a member created with a generated password (see
    // users.service.ts) and cleared the moment they change it themselves
    // (see changePassword below). The client uses this to route a first
    // sign-in straight to "choose a new password" before anything else.
    mustChangePassword: mustChangePassword(user.metadata),
    // Set by changePassword() for a first-time member and cleared by
    // verifyLoginOtp(); the client routes on it exactly as it does for
    // mustChangePassword above.
    otpRequired: otpRequired(user.metadata),
  };
}

/* ------------------------------------------------------------------------ */
/* Second factor                                                             */
/* ------------------------------------------------------------------------ */

/**
 * A member created with a generated password proves two things before they
 * reach the app: that they can choose a password of their own, and that they
 * control the mailbox the credentials were sent to. The first is
 * changePassword(); this is the second.
 *
 * `metadata.otpRequired` is the gate, set by changePassword() and cleared by
 * verifyLoginOtp(). It lives beside `mustChangePassword` so a single /me call
 * tells the client which step the account is on.
 */
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

/** Only ever stored and compared as a hash, like refresh and reset tokens. */
function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateOtp(): string {
  // randomInt over the whole range rather than digit-by-digit: a uniform
  // draw cannot be skewed by a modulo, and leading zeros stay possible.
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** True once `metadata.otpRequired` has been set and not yet cleared. */
function otpRequired(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).otpRequired === true
  );
}

function readMetadata(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
}

/**
 * Issues a fresh code and emails it, replacing any code still outstanding so
 * only the newest one works — otherwise "resend" would widen the window an
 * attacker has instead of narrowing it.
 */
export async function requestLoginOtp(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user) {
    throw HttpError.unauthorized("auth.invalidToken", { code: "user_not_found" });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.loginOtp.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.loginOtp.create({
      data: { userId, codeHash: hashOtp(code), purpose: "login", expiresAt },
    });
  });

  const email = decryptNullable(user.emailEncrypted);

  /*
   * Outside production, the code is printed to the server console.
   *
   * The code is only ever stored as a SHA-256, so when email is unavailable —
   * a provider's daily quota reached, a domain not yet verified, an inbox that
   * files it as spam — there is no way back into your own local database. That
   * turns a mail problem into a total lockout, and the failure gives no hint
   * that mail was even the cause.
   *
   * Printing it changes nothing about who can get in: reading this output
   * means having the server process, and anyone with that already has the
   * database and could mint a session outright. `NODE_ENV=production` is
   * checked directly rather than through a flag someone might set by
   * accident.
   */
  if (env.NODE_ENV !== "production") {
    /*
     * Width is measured, not counted by hand. A box drawn with hard-coded
     * padding goes ragged the moment an address is longer or shorter than the
     * one it was tuned against, which is most of them.
     */
    const lines = [
      `sign-in code:  ${code}`,
      `for:           ${email ?? userId}`,
      `expires in:    ${OTP_TTL_MINUTES} minutes`,
    ];

    const width = Math.max(...lines.map((line) => line.length)) + 2;
    const rule = "─".repeat(width);

    console.info(
      [
        "",
        `  ┌${rule}┐`,
        ...lines.map((line) => `  │ ${line.padEnd(width - 1)}│`),
        `  └${rule}┘`,
        "",
      ].join("\n"),
    );
  }

  if (email) {
    const workspace = await mailWorkspaceName(userId);
    // Fire-and-forget like every other transactional email here; a delivery
    // failure must not roll back a code that is already stored.
    void sendLoginOtpEmail({
      to: email,
      name: decryptNullable(user.displayNameEncrypted) ?? email,
      code,
      minutes: OTP_TTL_MINUTES,
      workspace,
      language: user.profile?.language,
    });

    /*
     * And by text, when the profile carries a number. A sign-in code is
     * useless if it arrives after it has expired, which is exactly what a
     * spam-filtered inbox does to it.
     */
    void sendLoginOtpSms({
      to: decryptNullable(user.profile?.phoneEncrypted ?? null),
      code,
      minutes: OTP_TTL_MINUTES,
      language: user.profile?.language,
    });
  }

  // The code itself is never returned — only where it went, so the UI can say
  // "sent to j***@example.com" without the caller learning the address.
  return { sentTo: maskEmail(email), expiresInMinutes: OTP_TTL_MINUTES };
}

/** j***@example.com — enough to recognise, not enough to harvest. */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

/**
 * Checks a submitted code and, on success, lifts the gate.
 *
 * Attempts are counted on the stored row rather than in memory so the limit
 * survives a restart and cannot be reset by reconnecting.
 */
export async function verifyLoginOtp(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw HttpError.unauthorized("auth.invalidToken", { code: "user_not_found" });
  }

  const record = await prisma.loginOtp.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw HttpError.badRequest("auth.otpExpired", { code: "otp_expired" });
  }

  if (record.expiresAt < new Date()) {
    await prisma.loginOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    throw HttpError.badRequest("auth.otpExpired", { code: "otp_expired" });
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.loginOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    throw HttpError.badRequest("auth.otpTooManyAttempts", { code: "otp_attempts_exceeded" });
  }

  // timingSafeEqual over the hashes: both sides are fixed-length hex, so the
  // comparison cannot leak how much of the code was right.
  const submitted = Buffer.from(hashOtp(code.trim()), "hex");
  const expected = Buffer.from(record.codeHash, "hex");
  const matches =
    submitted.length === expected.length && crypto.timingSafeEqual(submitted, expected);

  if (!matches) {
    await prisma.loginOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw HttpError.badRequest("auth.otpInvalid", { code: "otp_invalid" });
  }

  const metadata = readMetadata(user.metadata);
  delete metadata.otpRequired;

  const [, updated] = await prisma.$transaction([
    prisma.loginOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { metadata: metadata as never } }),
  ]);

  return { user: publicUser(updated) };
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
        /*
         * Confirm the mailbox before the account is worth anything.
         *
         * Signing up proves somebody can type an address, not that they own
         * it — and this account is about to be attached to a paid
         * subscription and a workspace full of business data. The code goes
         * out below; the route guards hold the person on /verify-otp until it
         * is entered (frontend ProtectedRoute reads `otpRequired`).
         */
        otpRequired: true,
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

  /*
   * No plan chosen means no workspace yet: the account exists, and the plan
   * screen that follows creates the workspace once they have picked one.
   */
  const workspace = !input.planCode
    ? null
    : await createPendingWorkspace({
    userId: user.id,
    email: input.email,
    displayName: input.displayName,
    businessName: input.businessName,
    businessPhone: input.businessPhone,
    businessLocation: input.businessLocation,
    businessType: input.businessType,
    teamSize: input.teamSize,
    language: input.language,
    // Narrowed by the guard above: this branch only runs with a plan chosen.
    planCode: input.planCode!,
    billingCycle: input.billingCycle!,
    paymentMethod: input.paymentMethod,
  });

  const tenantId = workspace?.tenantId ?? null;

  /*
   * Put the charge on the wire before answering.
   *
   * A customer who has just chosen MTN Mobile Money expects their phone to
   * buzz, not to be handed a second screen asking them to pay again - and the
   * signup form already collected everything the gateway needs. Card payers
   * get a redirect URL back and are sent to the gateway's own page.
   *
   * Failure here is deliberately not fatal: the account and the workspace
   * have already committed, and the customer can retry from the billing
   * screen. What they must not get is a 500 that hides the fact that their
   * account now exists.
   */
  const gatewayMethod = input.paymentMethod ? gatewayMethodFor(input.paymentMethod) : null;
  let payment = null;

  if (workspace && tenantId && workspace.requiresPayment && gatewayMethod) {
    try {
      payment = await startSubscriptionPayment({
        tenantId,
        userId: user.id,
        subscriptionId: workspace.subscriptionId,
        planCode: workspace.planCode,
        billingCycle: workspace.billingCycle,
        amount: workspace.amount,
        currency: workspace.currency,
        paymentMethodCode: input.paymentMethod!,
        payerPhone: input.payerPhone ?? input.businessPhone ?? null,
        email: input.email,
        name: input.displayName,
        purpose: "subscription",
      });
    } catch (error) {
      console.error("[auth] signup payment could not be started", {
        tenantId,
        method: input.paymentMethod,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // "owner" only once there is a workspace to own; before that the token
  // carries no tenant and reaches only the plan/payment routes.
  const tokens = await issueTokenPair(user, tenantId, tenantId ? "owner" : null);

  // Fire-and-forget: a delivery failure must not fail a signup that has
  // already committed. sendNotification swallows and logs its own errors.
  const language = input.language ?? "en";
  void sendAccountCreatedEmail({
    to: input.email,
    name: input.displayName,
    workspace: input.businessName,
    language,
  });

  /*
   * The verification code, sent as part of signing up rather than waiting for
   * the client to ask. Awaited — unlike the mail above — because the very next
   * screen tells the person to go and read it, and racing that would show them
   * a code entry box before the code has been generated.
   */
  await requestLoginOtp(user.id).catch((error) => {
    console.error("[auth] could not send the signup verification code", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  // Only when the workspace is genuinely open. Telling somebody their
  // subscription is active while it is still waiting on a MoMo prompt is how
  // a support ticket starts.
  if (workspace && !workspace.requiresPayment) {
    void sendSubscriptionActivatedEmail({
      to: input.email,
      name: input.displayName,
      workspace: input.businessName,
      plan: input.planCode!,
      cycle: input.billingCycle!,
      language,
    });
  }

  return {
    user: publicUser(user),
    tenantId,
    /** True until a plan is chosen — the client's cue to show the plan screen. */
    needsPlan: !workspace,
    /** Always true on a fresh signup: the mailbox has not been proved yet. */
    otpRequired: true,
    workspace: workspace
      ? {
          requiresPayment: workspace.requiresPayment,
          amount: workspace.amount,
          currency: workspace.currency,
          trialEndsAt: workspace.trialEndsAt,
        }
      : null,
    payment,
    ...tokens,
  };
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

  /*
   * Second factor on every sign-in. The password proves knowledge; the code
   * proves the person also controls the mailbox, so a leaked or shared
   * password alone does not reach the workspace.
   *
   * Skipped only when the account still owes a first password change — that
   * user is sent to /force-password-change first (mustChangePassword ranks
   * ahead of otpRequired in the route guard), and changePassword() raises the
   * factor and sends the code at the end of that step instead. Raising it
   * here too would just send a code that the change flow immediately replaces.
   *
   * The token pair is still issued: the client needs it to call
   * /auth/otp/verify, and the route guard keeps every other screen out of
   * reach until otpRequired clears (frontend ProtectedRoute).
   */
  let effectiveUser = user;
  let otp: Awaited<ReturnType<typeof requestLoginOtp>> | null = null;

  if (!mustChangePassword(user.metadata)) {
    const metadata = readMetadata(user.metadata);
    metadata.otpRequired = true;
    await prisma.user.update({ where: { id: user.id }, data: { metadata: metadata as never } });

    otp = await requestLoginOtp(user.id);
    // Re-read so the returned user carries the flag the client routes on.
    effectiveUser = (await prisma.user.findUnique({ where: { id: user.id } })) ?? user;
  }

  const membership = await primaryMembership(user.id);
  const tokens = await issueTokenPair(user, membership?.tenantId ?? null, membership?.role ?? null);

  return {
    user: publicUser(effectiveUser),
    tenant: membership ? { id: membership.tenant.id, name: membership.tenant.name, role: membership.role } : null,
    otp,
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

  /*
   * The subscription's state is resolved from its dates every time it is
   * asked for, rather than trusted from the column (lib/subscriptionState.ts).
   * Nothing ages a subscription out on a schedule, so a workspace whose term
   * ended last month still says "active" in the database — reading it
   * literally is how an unpaid workspace stays open indefinitely.
   */
  const state = resolveSubscriptionState(subscription);
  const open = isSubscriptionOpen(state);

  return {
    user: publicUser(user),
    tenant: membership
      ? {
          id: membership.tenant.id,
          name: membership.tenant.name,
          subscription_plan: membership.tenant.subscriptionPlan,
          // The resolved state, not the stored one, so the login path and the
          // billing screen cannot disagree about whether the term has run out.
          subscription_status: subscription ? state : membership.tenant.subscriptionStatus,
          payment_status: membership.tenant.paymentStatus,
          trial_status: membership.tenant.trialStatus,
          trial_ends_at: membership.tenant.trialEndsAt,
          onboarding_completed: membership.tenant.onboardingCompleted,
          workspace_status:
            subscription && !open
              ? state === "expired"
                ? "expired"
                : state === "trial_expired"
                  ? "trial_expired"
                  : state === "suspended" || state === "cancelled"
                    ? "blocked"
                    : "pending_payment"
              : membership.tenant.workspaceStatus,
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
          status: state,
          /** What the row itself says, for support and the audit trail. */
          stored_status: subscription.subscriptionStatus,
          is_open: open,
          days_remaining: daysRemaining(subscription),
          billing_cycle: subscription.billingCycle,
          current_period_start: subscription.currentPeriodStart,
          current_period_end: subscription.currentPeriodEnd,
          trial_ends_at: subscription.trialEndsAt,
          amount: subscription.subscriptionAmount,
          currency: subscription.subscriptionCurrency,
          payment_method_code: subscription.paymentMethodCode,
          payment_reference: subscription.paymentReference,
          approval_status: subscription.approvalStatus,
          rejection_reason: subscription.rejectionReason,
          requested_at: subscription.requestedAt,
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
      workspace: await mailWorkspaceName(user.id),
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
  /*
   * Choosing a password through a mailed link satisfies the first-sign-in
   * gate, so it has to clear it.
   *
   * A member created with a generated password carries
   * metadata.mustChangePassword until they pick their own. Leaving it set
   * here sent them to /force-password-change on their very next sign-in and
   * asked for "the temporary password you were emailed" — a credential this
   * reset had just replaced. They could dig their way out by entering the new
   * password twice, but the screen was asking for something that no longer
   * existed.
   */
  const resetting = await prisma.user.findUnique({ where: { id: stored.userId } });
  const metadata = readMetadata(resetting?.metadata);
  delete metadata.mustChangePassword;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash, metadata: metadata as never },
    }),
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
        workspace: await mailWorkspaceName(owner.id),
        language: owner.profile?.language,
      });
    }
  }
}

/**
 * A signed-in user changing their own password.
 *
 * Distinct from `completePasswordReset`: that flow proves identity with a
 * mailed token because the caller has no session; this one proves it with
 * the current password because the caller already does. Both end the same
 * way — a new hash and a notification — but only this one is also how
 * `User.metadata.mustChangePassword` gets cleared, since it is the only path
 * that represents the account holder actually having picked a password of
 * their own.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user) {
    throw HttpError.unauthorized("auth.invalidToken", { code: "user_not_found" });
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw HttpError.unauthorized("auth.invalidCredentials", { code: "invalid_credentials" });
  }

  const passwordHash = await hashPassword(newPassword);

  // Merge rather than clobber: metadata may still carry the signup-time
  // business fields (see signup()), and only the one key is this call's to
  // remove.
  const existingMetadata = readMetadata(user.metadata);
  const wasFirstSignIn = existingMetadata.mustChangePassword === true;
  delete existingMetadata.mustChangePassword;

  /*
   * The second factor is raised on every password change, not only the first.
   *
   * It was once limited to first sign-in, on the reasoning that a code should
   * not stand in front of people who already own their password. Login raises
   * the factor for everybody now, so that reasoning no longer holds — and a
   * password change is precisely the moment re-proving the mailbox is worth
   * most. If someone else changed it, the real account holder receives a code
   * they did not ask for, which is the earliest possible warning; and the
   * session that made the change cannot reach the workspace on the strength
   * of the change alone.
   */
  existingMetadata.otpRequired = true;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, metadata: existingMetadata as never },
  });

  const email = decryptNullable(updated.emailEncrypted);
  if (email) {
    void sendPasswordChangedEmail({
      to: email,
      name: decryptNullable(updated.displayNameEncrypted) ?? email,
      workspace: await mailWorkspaceName(userId),
      language: user.profile?.language,
    });
  }

  // Send the code straight away so the verification screen has something to
  // check the moment the client lands on it.
  const otp = await requestLoginOtp(userId);

  return { user: publicUser(updated), otp, wasFirstSignIn };
}
