import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { HttpError } from "../lib/httpError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; tenantId: string | null; role: string | null };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw HttpError.unauthorized("Missing bearer token");
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.user = { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
    next();
  } catch {
    throw HttpError.unauthorized("Invalid or expired access token");
  }
}
