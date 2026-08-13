import { NextFunction, Request, Response } from "express";
import { Language, resolveLanguage } from "../i18n";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      language: Language;
    }
  }
}

/**
 * Resolves the response language once per request and parks it on
 * res.locals, where lib/apiResponse.ts and the error handler read it.
 *
 * Mounted before every route — including the error handler's path — so a
 * failure that happens before any route matches is still answered in the
 * caller's language.
 */
export function resolveRequestLanguage(req: Request, res: Response, next: NextFunction): void {
  res.locals.language = resolveLanguage({
    query: req.query.lang,
    headerLanguage: req.header("x-language") ?? undefined,
    acceptLanguage: req.header("accept-language") ?? undefined,
  });

  // Lets caches and clients see which language was actually negotiated.
  res.setHeader("Content-Language", res.locals.language);
  next();
}
