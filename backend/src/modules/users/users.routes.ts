import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toCamelCase, toSnakeCase } from "../../lib/caseMapping";
import { decryptNullable, emailBlindIndex, encrypt, normalizeEmail } from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLES,
  isPermission,
  isRole,
  outranks,
  resolvePermissions,
} from "../../lib/permissions";
import { requireAuth } from "../../middleware/auth";
import { loadPermissions, requirePermission } from "../../middleware/requirePermission";
import { requireTenant } from "../../middleware/requireTenant";

/**
 * Who is in this workspace, what they may do, and who changed it.
 *
 * Every write here is an authority change, so three rules run through the
 * whole module:
 *
 *   1. You cannot act on someone who outranks you, or hand out a role at or
 *      above your own. Without that, "assign role" is a way to seize a
 *      workspace: a manager promotes themselves to owner and every other check
 *      becomes decorative.
 *   2. A workspace always has an owner. The last one cannot be demoted or
 *      removed, or nobody can ever administer it again.
 *   3. Everything is written to the activity log. "It was like that when I got
 *      here" is not an acceptable answer about who granted whom what.
 */

export const usersRouter = Router();
usersRouter.use(requireAuth, requireTenant);

const INVITE_TTL_DAYS = 7;

const roleSchema = z.string().refine(isRole, {
  message: `Role must be one of: ${ROLES.join(", ")}`,
});

/** Records an authority change. Never throws — an audit failure must not undo the act. */
async function audit(input: {
  tenantId: string;
  userId: string;
  action: string;
  targetId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        module: "users",
        targetId: input.targetId ?? null,
        description: input.description,
        metadata: (input.metadata ?? {}) as never,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[users] could not write activity log:", error);
  }
}

/** The caller's own role, read fresh — never from the token. See requirePermission. */
async function actorRole(req: { user?: { id: string }; tenantId?: string | null }) {
  const membership = await prisma.tenantMember.findFirst({
    where: { userId: req.user!.id, tenantId: req.tenantId! },
    select: { role: true },
  });
  return membership?.role ?? null;
}

async function ownerCount(tenantId: string) {
  return prisma.tenantMember.count({ where: { tenantId, role: "owner" } });
}

// ------------------------------------------------------------------ members ---

usersRouter.get(
  "/members",
  requirePermission("users.view"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;

    const members = await prisma.tenantMember.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            emailEncrypted: true,
            displayNameEncrypted: true,
            createdAt: true,
          },
        },
        // Joined rather than fetched separately so the screen can label a
        // posting without a second round trip per member.
        branch: { select: { id: true, name: true } },
      },
    });

    const profiles = await prisma.profile.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
      select: { id: true, displayNameEncrypted: true, phoneEncrypted: true, avatarUrl: true, language: true },
    });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const overrides = await prisma.rolePermission.findMany({ where: { tenantId } });
    const overridesByRole = new Map<string, { permission: string; granted: boolean }[]>();
    for (const row of overrides) {
      const list = overridesByRole.get(row.role) ?? [];
      list.push({ permission: row.permission, granted: row.granted });
      overridesByRole.set(row.role, list);
    }

    const data = members.map((member) => {
      const profile = profileById.get(member.userId);

      return {
        id: member.id,
        userId: member.userId,
        // Decrypted here, never on the wire in its stored form. Hashes never
        // leave the API at all.
        email: decryptNullable(member.user.emailEncrypted),
        displayName:
          decryptNullable(profile?.displayNameEncrypted) ??
          decryptNullable(member.user.displayNameEncrypted),
        phone: decryptNullable(profile?.phoneEncrypted),
        avatarUrl: profile?.avatarUrl ?? null,
        language: profile?.language ?? "en",
        role: member.role,
        permissions: resolvePermissions(member.role, overridesByRole.get(member.role) ?? []),
        branchId: member.branchId,
        branchName: member.branch?.name ?? null,
        department: member.department,
        status: member.status,
        joinedAt: member.createdAt,
      };
    });

    sendSuccess(res, { messageKey: "users.membersListed", data: toSnakeCase(data) });
  })
);

const assignRoleSchema = z.object({ role: roleSchema });

usersRouter.patch(
  "/members/:userId/role",
  requirePermission("users.assignRole"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const targetUserId = req.params.userId;
    const { role: nextRole } = assignRoleSchema.parse(req.body ?? {});

    const actor = await actorRole(req);
    if (!actor) throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });

    const target = await prisma.tenantMember.findFirst({
      where: { tenantId, userId: targetUserId },
    });
    if (!target) throw HttpError.notFound("users.memberNotFound");

    if (target.userId === req.user!.id) {
      // Otherwise the rank check below is trivially satisfiable in the wrong
      // direction: you always outrank nobody, so self-promotion would slip
      // through as "acting on someone you outrank".
      throw HttpError.forbidden("users.cannotChangeOwnRole", { code: "cannot_change_own_role" });
    }

    if (!outranks(actor, target.role)) {
      throw HttpError.forbidden("users.targetOutranksYou", {
        code: "target_outranks_you",
        params: { role: target.role },
      });
    }

    if (!outranks(actor, nextRole)) {
      // You may not create a peer or a superior. An admin promoting someone to
      // admin, or to owner, is how a workspace gets taken over.
      throw HttpError.forbidden("users.roleAboveYours", {
        code: "role_above_yours",
        params: { role: nextRole },
      });
    }

    if (target.role === "owner" && nextRole !== "owner" && (await ownerCount(tenantId)) <= 1) {
      throw HttpError.conflict("users.lastOwner", { code: "last_owner" });
    }

    const updated = await prisma.tenantMember.update({
      where: { id: target.id },
      data: { role: nextRole },
    });

    await audit({
      tenantId,
      userId: req.user!.id,
      action: "role_changed",
      targetId: targetUserId,
      description: `Role changed from ${target.role} to ${nextRole}`,
      metadata: { from: target.role, to: nextRole },
    });

    sendSuccess(res, { messageKey: "users.roleAssigned", data: toSnakeCase(updated) });
  })
);

/**
 * Where a member works and whether their membership is live.
 *
 * Separate from the role endpoint because these are different decisions with
 * different consequences: moving a cashier from one shop to another changes
 * nothing about what they may do, while `users.assignRole` is the gate on that.
 * Both are administrative, so both need `users.assignRole` to reach — but the
 * rank rules below are the role endpoint's, deliberately, because suspending
 * someone is a way of removing them and must not be a route around seniority.
 *
 * `branch_id: "all"` means workspace-wide; the screen's dropdown says "All
 * branches" and this is what that sends.
 */
const memberProfileSchema = z
  .object({
    branchId: z.string().trim().nullable().optional(),
    department: z.string().trim().max(191).nullable().optional(),
    status: z.enum(["active", "suspended", "inactive"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

usersRouter.patch(
  "/members/:userId/profile",
  requirePermission("users.assignRole"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const targetUserId = req.params.userId;
    const input = memberProfileSchema.parse(toCamelCase(req.body ?? {}));

    const actor = await actorRole(req);
    if (!actor) throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });

    const target = await prisma.tenantMember.findFirst({
      where: { tenantId, userId: targetUserId },
    });
    if (!target) throw HttpError.notFound("users.memberNotFound");

    const isSelf = target.userId === req.user!.id;

    /*
     * Suspending yourself locks you out of your own workspace with no way back
     * in. Refused for the same reason self-demotion and self-removal are.
     *
     * Checked before the rank rule, not after, so the message is the true
     * reason: `outranks` is strictly greater, so you never outrank yourself,
     * and the rank rule would otherwise answer every self-edit with "that
     * person is senior to you" — which about yourself is nonsense.
     */
    if (isSelf && input.status && input.status !== "active") {
      throw HttpError.forbidden("users.cannotSuspendSelf", { code: "cannot_suspend_self" });
    }

    /*
     * Adjusting your own branch or department is allowed; it changes nothing
     * about what you may do. Acting on anyone senior is not.
     *
     * Note what this already covers: nobody outranks an owner, so an owner
     * cannot be suspended by anyone at all — which is a stronger guarantee
     * than a last-owner count would give, and the reason there is no
     * owner-count check here as there is on the role and removal endpoints.
     */
    if (!isSelf && !outranks(actor, target.role)) {
      throw HttpError.forbidden("users.targetOutranksYou", {
        code: "target_outranks_you",
        params: { role: target.role },
      });
    }

    const data: { branchId?: string | null; department?: string | null; status?: string } = {};

    if (input.branchId !== undefined) {
      const branchId = input.branchId === "all" || input.branchId === "" ? null : input.branchId;

      // Checked rather than left to the foreign key: an unknown id should read
      // as "no such branch", not as a database constraint error, and a branch
      // belonging to another workspace must not be assignable at all.
      if (branchId) {
        const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
        if (!branch) throw HttpError.notFound("branches.notFound");
      }

      data.branchId = branchId;
    }

    if (input.department !== undefined) data.department = input.department || null;
    if (input.status !== undefined) data.status = input.status;

    const updated = await prisma.tenantMember.update({
      where: { id: target.id },
      include: { branch: { select: { id: true, name: true } } },
      data,
    });

    await audit({
      tenantId,
      userId: req.user!.id,
      action: "member_profile_updated",
      targetId: targetUserId,
      description: "Member posting updated",
      metadata: {
        from: {
          branchId: target.branchId,
          department: target.department,
          status: target.status,
        },
        to: data,
      },
    });

    sendSuccess(res, {
      messageKey: "users.memberProfileUpdated",
      data: toSnakeCase({
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        branchId: updated.branchId,
        branchName: updated.branch?.name ?? null,
        department: updated.department,
        status: updated.status,
      }),
    });
  })
);

usersRouter.delete(
  "/members/:userId",
  requirePermission("users.remove"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const targetUserId = req.params.userId;

    const actor = await actorRole(req);
    if (!actor) throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });

    const target = await prisma.tenantMember.findFirst({
      where: { tenantId, userId: targetUserId },
    });
    if (!target) throw HttpError.notFound("users.memberNotFound");

    if (target.userId === req.user!.id) {
      throw HttpError.forbidden("users.cannotRemoveSelf", { code: "cannot_remove_self" });
    }

    if (!outranks(actor, target.role)) {
      throw HttpError.forbidden("users.targetOutranksYou", {
        code: "target_outranks_you",
        params: { role: target.role },
      });
    }

    if (target.role === "owner" && (await ownerCount(tenantId)) <= 1) {
      throw HttpError.conflict("users.lastOwner", { code: "last_owner" });
    }

    await prisma.tenantMember.delete({ where: { id: target.id } });

    await audit({
      tenantId,
      userId: req.user!.id,
      action: "member_removed",
      targetId: targetUserId,
      description: `Removed a ${target.role} from the workspace`,
      metadata: { role: target.role },
    });

    sendSuccess(res, { messageKey: "users.memberRemoved", data: null });
  })
);

// -------------------------------------------------------------- permissions ---

usersRouter.get(
  "/permissions",
  requirePermission("users.view"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const overrides = await prisma.rolePermission.findMany({ where: { tenantId } });

    const byRole = new Map<string, { permission: string; granted: boolean }[]>();
    for (const row of overrides) {
      const list = byRole.get(row.role) ?? [];
      list.push({ permission: row.permission, granted: row.granted });
      byRole.set(row.role, list);
    }

    /*
     * The whole matrix, not just the differences. A screen that has to merge
     * defaults with overrides itself will drift from what the server enforces
     * the first time either changes — so the server answers with what it will
     * actually do, and marks which entries the workspace has customised.
     */
    sendSuccess(res, {
      messageKey: "users.permissionsListed",
      data: toSnakeCase({
        catalogue: ALL_PERMISSIONS,
        roles: ROLES.map((role) => ({
          role,
          defaults: DEFAULT_ROLE_PERMISSIONS[role],
          effective: resolvePermissions(role, byRole.get(role) ?? []),
          customised: byRole.get(role) ?? [],
        })),
      }),
    });
  })
);

const setPermissionSchema = z.object({
  role: roleSchema,
  permission: z.string().refine(isPermission, { message: "Unknown permission" }),
  granted: z.boolean(),
});

usersRouter.put(
  "/permissions",
  requirePermission("users.managePermissions"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const input = setPermissionSchema.parse(req.body ?? {});

    const actor = await actorRole(req);
    if (!actor) throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });

    if (!outranks(actor, input.role)) {
      // Editing what your own role — or a senior one — may do is a way to
      // grant yourself anything. Only roles below you are yours to shape.
      throw HttpError.forbidden("users.roleAboveYours", {
        code: "role_above_yours",
        params: { role: input.role },
      });
    }

    const isDefault = (DEFAULT_ROLE_PERMISSIONS[input.role] as readonly string[]).includes(
      input.permission
    );

    if (isDefault === input.granted) {
      /*
       * Setting a permission back to what the default already says is not a
       * customisation — storing it would freeze that role's behaviour against
       * future changes to the defaults, which is the opposite of what the
       * person clicking "reset" wants.
       */
      await prisma.rolePermission.deleteMany({
        where: { tenantId, role: input.role, permission: input.permission },
      });
    } else {
      await prisma.rolePermission.upsert({
        where: {
          tenantId_role_permission: {
            tenantId,
            role: input.role,
            permission: input.permission,
          },
        },
        create: {
          tenantId,
          role: input.role,
          permission: input.permission,
          granted: input.granted,
          updatedBy: req.user!.id,
        },
        update: { granted: input.granted, updatedBy: req.user!.id },
      });
    }

    await audit({
      tenantId,
      userId: req.user!.id,
      action: input.granted ? "permission_granted" : "permission_revoked",
      description: `${input.granted ? "Granted" : "Revoked"} ${input.permission} for ${input.role}`,
      metadata: { role: input.role, permission: input.permission, granted: input.granted },
    });

    const overrides = await prisma.rolePermission.findMany({
      where: { tenantId, role: input.role },
      select: { permission: true, granted: true },
    });

    sendSuccess(res, {
      messageKey: "users.permissionsUpdated",
      data: toSnakeCase({
        role: input.role,
        effective: resolvePermissions(input.role, overrides),
      }),
    });
  })
);

// ------------------------------------------------------------------ invites ---

const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(191),
  role: roleSchema,
});

usersRouter.get(
  "/invites",
  requirePermission("users.view"),
  asyncHandler(async (req, res) => {
    const invites = await prisma.userInvite.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const data = invites.map((invite) => ({
      id: invite.id,
      email: decryptNullable(invite.emailEncrypted),
      role: invite.role,
      status: invite.expiresAt < new Date() && invite.status === "pending" ? "expired" : invite.status,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      createdAt: invite.createdAt,
      // tokenHash is deliberately absent: it is a credential, not a field.
    }));

    sendSuccess(res, { messageKey: "users.invitesListed", data: toSnakeCase(data) });
  })
);

usersRouter.post(
  "/invites",
  requirePermission("users.invite"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const input = inviteSchema.parse(req.body ?? {});

    const actor = await actorRole(req);
    if (!actor) throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });

    if (!outranks(actor, input.role)) {
      throw HttpError.forbidden("users.roleAboveYours", {
        code: "role_above_yours",
        params: { role: input.role },
      });
    }

    const emailHash = emailBlindIndex(input.email);

    const existingUser = await prisma.user.findFirst({ where: { emailHash }, select: { id: true } });
    if (existingUser) {
      const alreadyMember = await prisma.tenantMember.findFirst({
        where: { tenantId, userId: existingUser.id },
      });
      if (alreadyMember) {
        throw HttpError.conflict("users.alreadyMember", { code: "already_member" });
      }
    }

    const livePending = await prisma.userInvite.findFirst({
      where: { tenantId, emailHash, status: "pending", expiresAt: { gt: new Date() } },
    });
    if (livePending) {
      throw HttpError.conflict("users.inviteAlreadyPending", { code: "invite_pending" });
    }

    /*
     * The token is generated here, hashed for storage, and returned exactly
     * once. An invite link is a credential until it is used: keeping only the
     * hash means a leaked database cannot be turned into workspace access, in
     * the same way a leaked password table cannot be turned into logins.
     */
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invite = await prisma.userInvite.create({
      data: {
        tenantId,
        emailEncrypted: encrypt(normalizeEmail(input.email)),
        emailHash,
        role: input.role,
        tokenHash,
        invitedBy: req.user!.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await audit({
      tenantId,
      userId: req.user!.id,
      action: "member_invited",
      targetId: invite.id,
      description: `Invited a ${input.role}`,
      metadata: { role: input.role },
    });

    sendSuccess(res, {
      messageKey: "users.inviteCreated",
      status: 201,
      data: toSnakeCase({
        id: invite.id,
        email: input.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        token,
      }),
    });
  })
);

usersRouter.delete(
  "/invites/:id",
  requirePermission("users.invite"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;

    const invite = await prisma.userInvite.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!invite) throw HttpError.notFound("users.inviteNotFound");

    await prisma.userInvite.update({
      where: { id: invite.id },
      data: { status: "cancelled" },
    });

    await audit({
      tenantId,
      userId: req.user!.id,
      action: "invite_cancelled",
      targetId: invite.id,
      description: `Cancelled an invitation for a ${invite.role}`,
      metadata: { role: invite.role },
    });

    sendSuccess(res, { messageKey: "users.inviteCancelled", data: null });
  })
);

// ------------------------------------------------------------------- audit ---

usersRouter.get(
  "/activity",
  requirePermission("activity.view"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 200) || 200, 1000);

    const logs = await prisma.activityLog.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    sendSuccess(res, { messageKey: "users.activityListed", data: toSnakeCase(logs) });
  })
);

/**
 * What the signed-in caller may do, without needing to be an administrator to
 * ask. The client uses it to hide what would be refused — the same answer the
 * server will enforce, so the two cannot drift.
 */
usersRouter.get(
  "/me/permissions",
  asyncHandler(async (req, res) => {
    const resolved = await loadPermissions(req.user!.id, req.tenantId!);

    sendSuccess(res, {
      messageKey: "users.permissionsListed",
      data: toSnakeCase({ role: resolved.role, permissions: resolved.permissions }),
    });
  })
);
