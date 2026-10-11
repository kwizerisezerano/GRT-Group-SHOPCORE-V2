import { DEFAULT_LANGUAGE, MessageKey, translate } from "../i18n";

type ErrorOptions = {
  code?: string;
  params?: Record<string, string | number>;
  details?: unknown;
};

/**
 * An error carrying everything needed to produce a correct, translated API
 * response: an HTTP status, a stable machine-readable code, and a catalogue
 * key for the human-readable message.
 *
 * The message is a key rather than a literal so the text is rendered in the
 * caller's language at the edge (see middleware/errorHandler.ts).
 * `Error.message` still holds the English rendering, because that is what
 * reaches logs and stack traces, where a bare key would be useless.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageKey: MessageKey;
  readonly params?: Record<string, string | number>;
  readonly details?: unknown;

  constructor(status: number, code: string, messageKey: MessageKey, options: ErrorOptions = {}) {
    super(translate(messageKey, DEFAULT_LANGUAGE, options.params));
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.params = options.params;
    this.details = options.details;
  }

  static badRequest(messageKey: MessageKey, options: ErrorOptions = {}) {
    return new HttpError(400, options.code ?? "bad_request", messageKey, options);
  }

  static unauthorized(messageKey: MessageKey = "error.unauthorized", options: ErrorOptions = {}) {
    return new HttpError(401, options.code ?? "unauthorized", messageKey, options);
  }

  static forbidden(messageKey: MessageKey = "error.forbidden", options: ErrorOptions = {}) {
    return new HttpError(403, options.code ?? "forbidden", messageKey, options);
  }

  static notFound(messageKey: MessageKey = "error.notFound", options: ErrorOptions = {}) {
    return new HttpError(404, options.code ?? "not_found", messageKey, options);
  }

  static conflict(messageKey: MessageKey, options: ErrorOptions = {}) {
    return new HttpError(409, options.code ?? "conflict", messageKey, options);
  }
}
