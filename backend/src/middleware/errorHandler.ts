import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { sendError } from "../lib/apiResponse";
import { HttpError } from "../lib/httpError";

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, {
    status: 404,
    code: "route_not_found",
    messageKey: "error.routeNotFound",
    params: { method: req.method, path: req.path },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    sendError(res, {
      status: err.status,
      code: err.code,
      messageKey: err.messageKey,
      params: err.params,
      details: err.details,
    });
    return;
  }

  if (err instanceof ZodError) {
    // Field-level detail travels in `details` so the frontend can highlight
    // the offending inputs, while `message` stays a sentence a user can read.
    sendError(res, {
      status: 400,
      code: "validation_error",
      messageKey: "error.validation",
      details: err.flatten(),
    });
    return;
  }

  // Nothing about an unexpected failure is safe to hand a caller — the detail
  // goes to the log, the response gets a generic apology.
  console.error(err);
  sendError(res, { status: 500, code: "internal_error", messageKey: "error.internal" });
}
