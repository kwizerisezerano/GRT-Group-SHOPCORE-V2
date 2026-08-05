import { Response } from "express";
import { DEFAULT_LANGUAGE, Language, MessageKey, translate } from "../i18n";

/**
 * The single response shape for this API.
 *
 * Requirement 8 asks that every response carry both a correct status code
 * and a clear message explaining what happened. Before this, success bodies
 * were inconsistent — some `{ data }`, some `{ plans }`, some a bare object —
 * and none carried a message, so the frontend had to invent its own copy for
 * every outcome.
 *
 *   success  { "success": true,  "message": "...", "data": ... }
 *   failure  { "success": false, "message": "...", "error": { "code", "details"? } }
 *
 * `success` lets a client branch without inspecting the status code, and the
 * message is already translated into the caller's language, so the frontend
 * displays it verbatim rather than maintaining a parallel catalogue.
 */

export type SuccessBody<T> = {
  success: true;
  message: string;
  data: T;
};

export type ErrorBody = {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
};

/** Language chosen for this request; set by middleware/language.ts. */
function languageOf(res: Response): Language {
  return (res.locals.language as Language) ?? DEFAULT_LANGUAGE;
}

/**
 * Sends a success response. The message is a catalogue key rather than a
 * literal so it is translated for the caller and cannot silently drift
 * between endpoints that mean the same thing.
 */
export function sendSuccess<T>(
  res: Response,
  options: {
    messageKey: MessageKey;
    data?: T;
    status?: number;
    params?: Record<string, string | number>;
  }
): void {
  const { messageKey, data, status = 200, params } = options;

  const body: SuccessBody<T | null> = {
    success: true,
    message: translate(messageKey, languageOf(res), params),
    data: data === undefined ? null : data,
  };

  res.status(status).json(body);
}

/** Sends a failure response in the same shape. */
export function sendError(
  res: Response,
  options: {
    status: number;
    code: string;
    messageKey: MessageKey;
    details?: unknown;
    params?: Record<string, string | number>;
  }
): void {
  const { status, code, messageKey, details, params } = options;

  const body: ErrorBody = {
    success: false,
    message: translate(messageKey, languageOf(res), params),
    error: details === undefined ? { code } : { code, details },
  };

  res.status(status).json(body);
}
