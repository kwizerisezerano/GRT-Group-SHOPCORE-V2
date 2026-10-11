import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { sendSuccess } from "../../lib/apiResponse";
import { asyncHandler } from "../../lib/asyncHandler";
import { toCamelCase, toSnakeCase } from "../../lib/caseMapping";
import {
  decryptNullable,
  emailBlindIndex,
  encrypt,
  encryptNullable,
  normalizeEmail,
  phoneBlindIndexNullable,
} from "../../lib/crypto";
import { HttpError } from "../../lib/httpError";
import { assertCapacity, buildCapacityReport } from "../../lib/planLimits";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLES,
  isPermission,
  isRole,
  outranks,
  overridesForPermissionSet,
  overridesForMemberPermissionSet,
  resolvePermissions,
} from "../../lib/permissions";
import { requireAuth } from "../../middleware/auth";
import { loadPermissions, requirePermission } from "../../middleware/requirePermission";
import { requireTenant } from "../../middleware/requireTenant";
import { createMemberWithGeneratedPassword } from "./users.service";

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
        tenantId: member.tenantId,
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

/**
 * Creating a member outright, with a server-generated password, rather than
 * by invite link. Both are legitimate: an invite link is more secure (the
 * recipient proves control of the address by clicking it) but requires them
 * to complete a step; this is faster when an administrator wants the account
 * to exist immediately — the new member signs in with the mailed password
 * and is required to change it on first use (User.metadata.mustChangePassword,
 * see users.service.ts and auth.service.ts changePassword()).
 *
 * The actual creation is shared with the platform-admin equivalent
 * (POST /platform/tenants/:tenantId/users) in users.service.ts. This handler
 * only owns what is specific to a tenant admin calling it: the same
 * `users.invite` permission and the same outranks() rule the invite endpoint
 * below enforces.
 */
const createMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(191),
  displayName: z.string().trim().min(1, "Name is required").max(191),
  role: roleSchema,
  department: z.string().trim().max(191).nullable().optional(),
  branchId: z.string().trim().nullable().optional(),
  /*
   * Optional, and the reason the invitation can reach someone whose email
   * lands in spam. The generated password exists in that one message and
   * nowhere else, so a second channel is what makes the account recoverable.
   */
  phone: z.string().trim().max(32).nullable().optional(),
});

usersRouter.post(
  "/create",
  requirePermission("users.invite"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = createMemberSchema.parse({
      email: body.email,
      displayName: body.displayName ?? body.display_name ?? body.full_name ?? body.fullName,
      role: body.role,
      department: body.department,
      branchId: body.branchId ?? body.branch_id,
      phone: body.phone ?? body.phone_number ?? body.phoneNumber,
    });

    const actor = await actorRole(req);
    if (!actor) throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });

    if (!outranks(actor, input.role)) {
      throw HttpError.forbidden("users.roleAboveYours", {
        code: "role_above_yours",
        params: { role: input.role },
      });
    }

    /*
     * The subscription's seat ceiling, checked here rather than only in the
     * browser. The screen already shows how many seats are left, but a limit
     * that only the frontend enforces is not a limit — this is the line that
     * makes "3 users" mean three users.
     */
    const seats = await assertCapacity(tenantId, "users");

    const member = await createMemberWithGeneratedPassword({
      tenantId,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      department: input.department ?? null,
      branchId: input.branchId ?? null,
      phone: input.phone ?? null,
      invitedByUserId: req.user!.id,
      language: res.locals.language,
    });

    sendSuccess(res, {
      messageKey: "users.memberCreated",
      status: 201,
      // Seat headway travels back with the member so the screen can update
      // its "2 of 5 used" line without a second request.
      data: toSnakeCase({
        ...member,
        seats: {
          limit: seats.limit,
          isUnlimited: seats.is_unlimited,
          usage: seats.usage + 1,
          remaining: seats.remaining === null ? null : Math.max(0, seats.remaining - 1),
        },
      }),
    });
  })
);

/**
 * How much of the subscription this workspace has spent. Read by the member
 * screens before they offer an "add user" button, so the ceiling is visible
 * before somebody fills in a form they cannot submit.
 */
usersRouter.get(
  "/capacity",
  asyncHandler(async (req, res) => {
    const capacities = await buildCapacityReport(req.tenantId!);
    sendSuccess(res, { messageKey: "subscription.usageLoaded", data: toSnakeCase({ capacities }) });
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
    /*
     * Editable here because accounts that predate the phone field have none,
     * and without a number they get no sign-in code by text — only the email,
     * which is the channel this exists to back up. An administrator has to be
     * able to fill one in without deleting and recreating the person.
     */
    phone: z.string().trim().max(32).nullable().optional(),
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

    /*
     * Phone lives on Profile, which is per-user rather than per-workspace, so
     * it is written separately from the posting fields above.
     *
     * upsert, not update: a Profile row is not guaranteed to exist. Accounts
     * created before profiles were introduced have none, and those are
     * exactly the accounts most likely to be missing a number.
     *
     * phoneHash is unique across profiles, so a number already on file would
     * fail the constraint. That is reported rather than silently dropped —
     * unlike member creation, where the account still had to be created; here
     * the whole point of the request was the number, so "it did not save" has
     * to reach the screen.
     */
    if (input.phone !== undefined) {
      const phone = input.phone || null;
      const phoneHash = phoneBlindIndexNullable(phone);

      if (phoneHash) {
        const clash = await prisma.profile.findUnique({ where: { phoneHash } });
        if (clash && clash.id !== targetUserId) {
          throw HttpError.badRequest("users.phoneAlreadyInUse", {
            code: "phone_already_in_use",
          });
        }
      }

      const displayName = decryptNullable(
        (await prisma.user.findUnique({ where: { id: targetUserId } }))?.displayNameEncrypted ?? null
      );

      await prisma.profile.upsert({
        where: { id: targetUserId },
        update: { phoneEncrypted: encryptNullable(phone), phoneHash },
        create: {
          id: targetUserId,
          displayNameEncrypted: encrypt(displayName ?? ""),
          language: "en",
          phoneEncrypted: encryptNullable(phone),
          phoneHash,
        },
      });
    }

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
        // The number is deliberately not logged — the activity log is read by
        // more people than may see a member's contact details.
        to: input.phone !== undefined ? { ...data, phone: "changed" } : data,
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
        phone: decryptNullable(
          (await prisma.profile.findUnique({ where: { id: targetUserId } }))?.phoneEncrypted ?? null
        ),
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

/**
 * Setting a whole role at once.
 *
 * ## Why this is not "just call PUT /permissions in a loop"
 *
 * The editor has one switch per permission and there are well over a hundred
 * of them, so "give this role everything" or "take everything away" through
 * the single-permission route is a hundred-odd sequential HTTP requests. That
 * is slow enough to look broken, and it is not atomic: a dropped connection
 * halfway leaves the role in a state nobody chose — half granted, half not,
 * with no way to tell which half. An owner clearing a role's access during an
 * incident cannot be left holding that.
 *
 * So the desired set is sent once and written in one transaction. Either the
 * role ends up exactly as asked, or it is untouched.
 *
 * ## The modes are one operation
 *
 * `grant_all`, `revoke_all` and `defaults` are conveniences over the same
 * thing — a target set of permissions — rather than three code paths. They
 * exist as names because that is what the buttons say, and because a client
 * should not have to send the entire catalogue to express "everything".
 */
const bulkPermissionSchema = z
  .object({
    role: roleSchema,
    mode: z.enum(["grant_all", "revoke_all", "defaults", "set"]).optional(),
    permissions: z.array(z.string()).max(1000).optional(),
  })
  .refine((input) => input.mode !== undefined || input.permissions !== undefined, {
    message: "Send a mode, or the exact permissions the role should hold",
  });

usersRouter.put(
  "/permissions/bulk",
  requirePermission("users.managePermissions"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const input = bulkPermissionSchema.parse(req.body ?? {});

    const actor = await actorRole(req);
    if (!actor) throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });

    if (!outranks(actor, input.role)) {
      /*
       * The same rule as the single-permission route, and it matters more
       * here: without it, "grant everything to my own role" is one request.
       * Owner is unreachable for everyone including owners, which is what
       * keeps the top of the workspace from being edited at all.
       */
      throw HttpError.forbidden("users.roleAboveYours", {
        code: "role_above_yours",
        params: { role: input.role },
      });
    }

    const desired =
      input.mode === "grant_all"
        ? [...ALL_PERMISSIONS]
        : input.mode === "revoke_all"
          ? []
          : input.mode === "defaults"
            ? [...DEFAULT_ROLE_PERMISSIONS[input.role]]
            : (input.permissions ?? []);

    const rows = overridesForPermissionSet(input.role, desired);

    /*
     * Replace rather than merge. The caller is stating what the role holds,
     * not adjusting it, so any override this workspace set previously and did
     * not restate is gone — otherwise "revoke all" would leave old grants
     * behind and mean something other than what it says.
     */
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { tenantId, role: input.role } }),
      ...(rows.length > 0
        ? [
            prisma.rolePermission.createMany({
              data: rows.map((row) => ({
                tenantId,
                role: input.role,
                permission: row.permission,
                granted: row.granted,
                updatedBy: req.user!.id,
              })),
            }),
          ]
        : []),
    ]);

    const effective = resolvePermissions(input.role, rows);

    await audit({
      tenantId,
      userId: req.user!.id,
      action: "permissions_bulk_set",
      description:
        input.mode === "grant_all"
          ? `Granted every permission to ${input.role}`
          : input.mode === "revoke_all"
            ? `Revoked every permission from ${input.role}`
            : input.mode === "defaults"
              ? `Reset ${input.role} to its default permissions`
              : `Set ${effective.length} permissions on ${input.role}`,
      metadata: {
        role: input.role,
        mode: input.mode ?? "set",
        granted: effective.length,
        overrides: rows.length,
      },
    });

    sendSuccess(res, {
      messageKey: "users.permissionsUpdated",
      data: toSnakeCase({
        role: input.role,
        effective,
        customised: rows,
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
     * Checked before the invitation is sent, not when it is accepted. An
     * invitation is a promise, and a workspace at its ceiling should find that
     * out before somebody is told they have access — not after they have
     * clicked the link.
     */
    await assertCapacity(tenantId, "users");

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

// ------------------------------------------------------------------ member permissions ---

usersRouter.get(
  "/members/:userId/permissions",
  requirePermission("users.view"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const { userId } = req.params;

    const membership = await prisma.tenantMember.findFirst({
      where: { tenantId, userId },
    });

    if (!membership) throw HttpError.notFound("users.memberNotFound");

    const [roleOverrides, memberOverrides] = await Promise.all([
      prisma.rolePermission.findMany({ where: { tenantId, role: membership.role } }),
      prisma.memberPermission.findMany({ where: { tenantId, userId } })
    ]);

    const effective = resolvePermissions(membership.role, roleOverrides, memberOverrides);

    sendSuccess(res, {
      messageKey: "users.permissionsListed",
      data: toSnakeCase({
        role: membership.role,
        effective,
        customised: memberOverrides.map(o => ({ permission: o.permission, granted: o.granted }))
      })
    });
  })
);

usersRouter.put(
  "/members/:userId/permissions/bulk",
  requirePermission("users.managePermissions"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const { userId } = req.params;
    const body = (req.body ?? {}) as { mode: string; permissions?: string[] };

    const membership = await prisma.tenantMember.findFirst({
      where: { tenantId, userId },
    });
    if (!membership) throw HttpError.notFound("users.memberNotFound");

    const actor = await actorRole(req);
    if (!actor) throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });
    
    if (!outranks(actor, membership.role) && membership.role !== actor && req.user!.id !== userId) {
      if (actor !== "owner" && !outranks(actor, membership.role)) {
         throw HttpError.forbidden("users.roleAboveYours", { code: "role_above_yours" });
      }
    }

    const roleOverrides = await prisma.rolePermission.findMany({
      where: { tenantId, role: membership.role }
    });

    let desired: string[] = [];
    if (body.mode === "grant_all") {
      desired = [...ALL_PERMISSIONS];
    } else if (body.mode === "revoke_all") {
      desired = [];
    } else if (body.mode === "defaults") {
      desired = resolvePermissions(membership.role, roleOverrides); // Reset to role defaults
    } else {
      desired = body.permissions ?? [];
    }

    const rows = overridesForMemberPermissionSet(membership.role, desired, roleOverrides);

    await prisma.$transaction([
      prisma.memberPermission.deleteMany({ where: { tenantId, userId } }),
      ...(rows.length > 0
        ? [
            prisma.memberPermission.createMany({
              data: rows.map((row) => ({
                tenantId,
                userId,
                permission: row.permission,
                granted: row.granted,
                updatedBy: req.user!.id,
              })),
            }),
          ]
        : []),
    ]);

    const effective = resolvePermissions(membership.role, roleOverrides, rows);

    sendSuccess(res, {
      messageKey: "users.permissionsUpdated",
      data: toSnakeCase({
        role: membership.role,
        effective,
        customised: rows,
      }),
    });
  })
);
