import crypto from "node:crypto";
import { prisma } from "../../db/prisma";
import {
  decryptNullable,
  emailBlindIndex,
  encrypt,
  encryptNullable,
  phoneBlindIndexNullable,
} from "../../lib/crypto";
import { sendUserInvitedWithCredentialsEmail } from "../../lib/email/notifications";
import { HttpError } from "../../lib/httpError";
import { hashPassword } from "../../lib/password";
import { sendUserInvitedSms } from "../../lib/sms/notifications";
import { resolvePermissions, roleLabel } from "../../lib/permissions";

/**
 * Creating a member outright, with a generated password, rather than by
 * invite link.
 *
 * This is the shared core behind two thin route handlers: a tenant admin
 * calling `POST /users/create` (users.routes.ts) and a platform admin
 * calling `POST /platform/tenants/:tenantId/users` (platform.routes.ts).
 * Both trust their own caller-authorisation checks (outranks(), or platform
 * admin status) before reaching here — this function only enforces the
 * invariants that do not depend on who is calling: no duplicate membership,
 * no cross-tenant branch, and the password never leaves this function in
 * anything but the outbound email.
 */

const PASSWORD_LENGTH = 14;

// Ambiguous characters (0/O, 1/l/I) are left out so a password read off a
// screen or a printed onboarding sheet cannot be mistyped into a lockout.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*?-_";
const ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS;

function randomChar(charset: string): string {
  return charset[crypto.randomInt(charset.length)];
}

/**
 * A strong, printable temporary password: one of each required character
 * class, padded out to length and shuffled so the classes aren't always in
 * the same position. Same shape the signup form itself demands (lib/
 * auth.schemas.ts) — a temporary password must not be weaker than the one a
 * founding owner would have been made to choose.
 */
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

export type CreateMemberInput = {
  tenantId: string;
  email: string;
  displayName: string;
  role: string;
  department?: string | null;
  branchId?: string | null;
  invitedByUserId: string;
  language?: string | null;
  /** Optional second channel for the invitation. Plaintext in; encrypted before storage. */
  phone?: string | null;
};

export async function createMemberWithGeneratedPassword(input: CreateMemberInput) {
  const emailHash = emailBlindIndex(input.email);

  // Reuse an existing User row across tenants — same rule signup() applies
  // via its own emailHash uniqueness check — rather than rejecting a person
  // who already has an account elsewhere on the platform.
  const existingUser = await prisma.user.findFirst({ where: { emailHash } });

  if (existingUser) {
    const alreadyMember = await prisma.tenantMember.findFirst({
      where: { tenantId: input.tenantId, userId: existingUser.id },
    });
    if (alreadyMember) {
      throw HttpError.conflict("users.alreadyMember", { code: "already_member" });
    }
  }

  // Checked rather than left to the foreign key, and scoped to this tenant so
  // a branch id from another workspace cannot be assigned — same check the
  // existing PATCH /members/:userId/profile handler makes.
  let branchId: string | null = null;
  if (input.branchId && input.branchId !== "all") {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, tenantId: input.tenantId } });
    if (!branch) throw HttpError.notFound("branches.notFound");
    branchId = branch.id;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId }, select: { name: true } });
  if (!tenant) throw HttpError.notFound();

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);

  const { user, tenantMember, isNewUser } = await prisma.$transaction(async (tx) => {
    let user = existingUser;
    let isNewUser = false;

    if (!user) {
      user = await tx.user.create({
        data: {
          emailEncrypted: encrypt(input.email),
          emailHash,
          passwordHash,
          displayNameEncrypted: encrypt(input.displayName),
          metadata: { mustChangePassword: true },
        },
      });
      isNewUser = true;

      /*
       * phoneHash is unique across profiles, so a number already on file
       * would fail the constraint mid-transaction and roll the whole member
       * back. The number is a convenience for delivering the invitation, not
       * a reason to refuse the account — so a clash simply stores no number
       * and the invitation goes by email alone.
       */
      const phoneHash = phoneBlindIndexNullable(input.phone ?? null);
      const phoneTaken = phoneHash
        ? await tx.profile.findUnique({ where: { phoneHash } })
        : null;

      await tx.profile.create({
        data: {
          id: user.id,
          displayNameEncrypted: encrypt(input.displayName),
          language: input.language || "en",
          phoneEncrypted: phoneTaken ? null : encryptNullable(input.phone ?? null),
          phoneHash: phoneTaken ? null : phoneHash,
        },
      });
    } else {
      // Merge rather than clobber: an existing user may already carry
      // signup-time metadata (business fields — see auth.service.ts
      // signup()) that this write must not erase.
      const existingMetadata =
        user.metadata && typeof user.metadata === "object" && !Array.isArray(user.metadata)
          ? (user.metadata as Record<string, unknown>)
          : {};

      /*
       * Raising the password gate has to clear any outstanding code gate.
       *
       * This person may have signed in elsewhere and still be carrying an
       * unspent `otpRequired`. Handing them a fresh temporary password starts
       * the first-sign-in flow over, and leaving both flags set puts the route
       * guards in a state where each one redirects to the other's screen —
       * the workspace becomes unreachable. changePassword() raises a new code
       * at the end of this flow anyway, so nothing is lost by dropping the
       * old one here.
       */
      const restartedMetadata: Record<string, unknown> = {
        ...existingMetadata,
        mustChangePassword: true,
      };
      delete restartedMetadata.otpRequired;

      user = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          metadata: restartedMetadata as never,
        },
      });
    }

    const tenantMember = await tx.tenantMember.create({
      data: {
        tenantId: input.tenantId,
        userId: user.id,
        role: input.role,
        branchId,
        department: input.department || null,
        status: "active",
      },
    });

    return { user, tenantMember, isNewUser };
  });

  // Never thrown out of this function — an audit failure must not undo a
  // member that has already been created. Mirrors the audit() helper in
  // users.routes.ts, duplicated rather than imported so this service has no
  // dependency on the router module.
  try {
    await prisma.activityLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.invitedByUserId,
        action: "member_created",
        module: "users",
        targetId: user.id,
        description: `Created a ${input.role} account with a generated password`,
        metadata: { role: input.role, newUser: isNewUser },
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[users] could not write activity log:", error);
  }

  // Fire-and-forget, exactly like every other transactional email in this
  // codebase (see auth.service.ts signup()) — delivery failure must not fail
  // a request that has already committed. This is the only place the
  // plaintext password is ever used again after hashing.
  void sendUserInvitedWithCredentialsEmail({
    to: input.email,
    name: input.displayName,
    workspace: tenant.name,
    tempPassword,
    role: roleLabel(input.role),
    language: input.language,
  });

  /*
   * The same credentials by text, when a number was given.
   *
   * Fire-and-forget alongside the email rather than instead of it: the email
   * is the record a person can search for later, the SMS is the one that
   * actually arrives today. Both carry the temporary password because it is
   * generated once and stored only as a hash — if neither message lands, the
   * account cannot be entered by anyone.
   */
  void sendUserInvitedSms({
    to: input.phone,
    workspace: tenant.name,
    email: input.email,
    tempPassword,
    language: input.language,
  });

  const branch = branchId
    ? await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } })
    : null;

  const overrides = await prisma.rolePermission.findMany({
    where: { tenantId: input.tenantId, role: input.role },
    select: { permission: true, granted: true },
  });

  // Same shape GET /members returns, so the caller can drop this straight
  // into the member list it already renders without a special case.
  return {
    id: tenantMember.id,
    userId: user.id,
    email: decryptNullable(user.emailEncrypted),
    displayName: input.displayName,
    phone: null as string | null,
    avatarUrl: null as string | null,
    language: input.language || "en",
    role: tenantMember.role,
    permissions: resolvePermissions(input.role, overrides),
    branchId: tenantMember.branchId,
    branchName: branch?.name ?? null,
    department: tenantMember.department,
    status: tenantMember.status,
    joinedAt: tenantMember.createdAt,
  };
}
