/**
 * Single error taxonomy for the whole platform (Doc 08 §6, Doc 20 §1).
 * No service throws across the action/function boundary — everything
 * returns a Result and the UI maps codes to standard presentations.
 */

export type AppErrorCode =
  | 'validation'
  | 'unauthenticated'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'precondition'
  | 'rate_limited'
  | 'unavailable'
  | 'internal';

export type BusinessRuleId =
  'BR-01' | 'BR-02' | 'BR-03' | 'BR-04' | 'BR-05' | 'BR-06' | 'BR-07' | 'BR-08' | 'BR-09';

export interface AppError {
  code: AppErrorCode;
  /** Safe for direct display — never contains paths, uids, or stack traces. */
  message: string;
  /** Present when code === 'validation': field name → problem. */
  fields?: Record<string, string>;
  /** Present when code === 'precondition': the blocking business rule. */
  rule?: BusinessRuleId;
  retryable: boolean;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(error: AppError): Result<T> {
  return { ok: false, error };
}

export function validationError<T = never>(
  fields: Record<string, string>,
  message = 'Some fields need attention.',
): Result<T> {
  return err({ code: 'validation', message, fields, retryable: false });
}

export function unauthenticatedError<T = never>(message = 'Invalid email or password.'): Result<T> {
  return err({ code: 'unauthenticated', message, retryable: false });
}

export function rateLimitedError<T = never>(message: string): Result<T> {
  return err({ code: 'rate_limited', message, retryable: true });
}

export function permissionError<T = never>(
  message = 'You do not have permission to perform this action.',
): Result<T> {
  return err({ code: 'permission', message, retryable: false });
}

export function notFoundError<T = never>(
  message = 'The requested record was not found.',
): Result<T> {
  return err({ code: 'not_found', message, retryable: false });
}

export function conflictError<T = never>(message: string): Result<T> {
  return err({ code: 'conflict', message, retryable: false });
}

export function preconditionError<T = never>(rule: BusinessRuleId, message: string): Result<T> {
  return err({ code: 'precondition', message, rule, retryable: false });
}

export function unavailableError<T = never>(
  message = 'The service is temporarily unavailable. Please try again.',
): Result<T> {
  return err({ code: 'unavailable', message, retryable: true });
}

export function internalError<T = never>(
  message = 'Something went wrong on our side. The issue has been recorded.',
): Result<T> {
  return err({ code: 'internal', message, retryable: false });
}

export function unwrapOr<T>(result: Result<T>, fallback: T): T {
  return result.ok ? result.data : fallback;
}

/** Maps the taxonomy to HTTP statuses for future REST exposure (Doc 20 §4). */
export const ERROR_HTTP_STATUS: Record<AppErrorCode, number> = {
  validation: 422,
  unauthenticated: 401,
  permission: 403,
  rate_limited: 429,
  not_found: 404,
  conflict: 409,
  precondition: 412,
  unavailable: 503,
  internal: 500,
};
