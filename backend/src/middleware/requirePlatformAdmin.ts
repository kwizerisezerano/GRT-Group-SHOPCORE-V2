import { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { HttpError } from "../lib/httpError";

/**
 * Gate for the platform console (backend/src/modules/platform). Must run
 * after requireAuth.
 *
 * Deliberately not `requireTenant` plus a role check: a platform admin is
 * not scoped to any one tenant, and may hold no tenant membership at all.
 * `User.isPlatformAdmin` is looked up fresh from the database on every
 * request — the same field /auth/me reads (auth.service.ts me()) — rather
 * than trusted from the JWT, so revoking platform access takes effect on the
 * very next request instead of waiting for the token to expire. Same
 * reasoning as requirePermission's tenant-role lookup.
 */
export async function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw HttpError.forbidden("error.forbidden");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });

    if (!user?.isPlatformAdmin) {
      throw HttpError.forbidden("platform.notAuthorized", { code: "not_platform_admin" });
    }

    next();
  } catch (error) {
    next(error);
  }
}
