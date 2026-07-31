import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/httpError";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "not_found", message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "validation_error", message: "Invalid request", details: err.flatten() },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}
