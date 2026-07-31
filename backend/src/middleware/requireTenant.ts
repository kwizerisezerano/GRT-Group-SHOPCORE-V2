import { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/httpError";
import { scopedPrisma, ScopedPrismaClient } from "../lib/tenantScope";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantPrisma?: ScopedPrismaClient;
    }
  }
}

/**
 * Must run after requireAuth. Rejects requests from users who aren't
 * attached to a tenant/workspace yet (e.g. mid-onboarding), and attaches a
 * tenant-scoped Prisma client (see lib/tenantScope.ts) for the rest of the
 * request so route/service code never has to filter by tenantId by hand.
 */
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.tenantId) {
    throw HttpError.forbidden("This action requires an active tenant/workspace");
  }

  req.tenantId = req.user.tenantId;
  req.tenantPrisma = scopedPrisma(req.user.tenantId);
  next();
}
