export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string, code = "bad_request") {
    return new HttpError(400, code, message);
  }

  static unauthorized(message = "Unauthorized", code = "unauthorized") {
    return new HttpError(401, code, message);
  }

  static forbidden(message = "Forbidden", code = "forbidden") {
    return new HttpError(403, code, message);
  }

  static notFound(message = "Not found", code = "not_found") {
    return new HttpError(404, code, message);
  }

  static conflict(message: string, code = "conflict") {
    return new HttpError(409, code, message);
  }
}
