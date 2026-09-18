/**
 * Consistent error envelope: every 4xx / 5xx response ships as
 *   { error: { code, message, details? } }
 * so the frontend has one shape to handle.
 */
export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "rate_limited"
  | "internal_error";

export class AppError extends Error {
  status: number;
  code: ErrorCode;
  details?: unknown;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = "Resource not found") =>
  new AppError(404, "not_found", message);

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "bad_request", message, details);

export const conflict = (message: string, code: ErrorCode = "conflict") =>
  new AppError(409, code, message);
