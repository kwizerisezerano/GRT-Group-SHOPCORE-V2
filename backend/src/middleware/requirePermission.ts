import { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { HttpError } from "../lib/httpError";
import { resolvePermissions, type Permission } from "../lib/permissions";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Effective permissions for this caller in this workspace. */
      permissions?: Permission[];
      /** The caller's role as the database has it right now. */
      effectiveRole?: string | null;
    }
  }
}

/**
 * Refuses a request the caller is not allowed to make.
 *
 * ## Why the role is not taken from the token
 *
 * `requireAuth` puts a role on the request because the JWT carries one, but
 * that role was true when the token was issued and may not be true now. A
 * token lives for its full lifetime whatever happens in between, so reading
 * authority from it means an owner who demotes a manager has not actually
 * demoted them — the old role keeps working until the token expires, which is
 * exactly the window in which someone being removed is most likely to use it.
 *
 * So the role is read from `tenant_members` on every request. That is one
 * indexed lookup by (userId, tenantId), and the correctness is worth far more
 * than the microseconds: a role change takes effect on the very next request,
 * which is what an owner pressing "make this person a cashier" reasonably
 * expects.
 *
 * ## Failing closed
 *
 * No membership row means no permissions — not "fall back to the token", not
 * "assume the default role". Someone removed from a workspace stops being able
 * to do anything in it immediately, and a caller whose membership cannot be
 * established is treated as having none.
 */
export function requirePermission(...required: Permission[]) {
  return async function permissionGuard(req: Request, _res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId ?? req.user?.tenantId ?? null;

      if (!userId || !tenantId) {
        throw HttpError.forbidden("auth.noWorkspace", { code: "no_workspace" });
      }

      const permissions = await loadPermissions(userId, tenantId);
      req.permissions = permissions.permissions;
      req.effectiveRole = permissions.role;

      const missing = required.filter((permission) => !permissions.set.has(permission));

      if (missing.length > 0) {
        /*
         * The refusal names what was needed. A cashier told only "forbidden"
         * raises a support ticket; one told they need `products.delete` can
         * ask the right person for the right thing — and the owner reading the
         * activity log can see what was attempted.
         *
         * This leaks nothing: the permission catalogue is not a secret, and
         * the caller already knows what they tried to do.
         */
        throw HttpError.forbidden("auth.missingPermission", {
          code: "missing_permission",
          params: { permission: missing[0] },
          details: { required, missing, role: permissions.role },
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Resolves a member's effective permissions: their current role, plus the
 * workspace's own grants and revocations on top of the shipped defaults.
 *
 * Exported because `/auth/me` needs exactly the same answer — the client is
 * told precisely what the server will enforce, so the UI can hide what would
 * be refused rather than guessing.
 */
export async function loadPermissions(userId: string, tenantId: string) {
  const membership = await prisma.tenantMember.findFirst({
    where: { userId, tenantId },
    select: { role: true },
  });

  if (!membership) {
    return { role: null as string | null, permissions: [] as Permission[], set: new Set<string>() };
  }

  const overrides = await prisma.rolePermission.findMany({
    where: { tenantId, role: membership.role },
    select: { permission: true, granted: true },
  });

  const permissions = resolvePermissions(membership.role, overrides);

  return { role: membership.role, permissions, set: new Set<string>(permissions) };
}
