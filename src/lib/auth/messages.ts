/**
 * The only user-facing authentication strings (Doc 10 §1 / ADR-013).
 * One generic failure message by design: responses must never distinguish
 * "email not found" from "wrong password" (enumeration resistance).
 */
export const AUTH_MESSAGES = {
  invalidCredentials: 'Invalid email or password.',
  locked: (seconds: number) => `Too many failed login attempts. Try again in ${seconds} seconds.`,
  serviceUnavailable: 'Sign-in is temporarily unavailable. Please try again.',
  // Password reset (Doc 10 §1 extension) — the request-stage response is
  // identical whether or not the address has an account (enumeration
  // resistance), so it never varies by outcome.
  resetRequested: 'If an account exists for that email, a reset link has been sent.',
  resetLinkInvalid: 'This reset link is invalid or has expired. Request a new one.',
  resetPasswordWeak: 'Password must be at least 10 characters and include a letter and a number.',
  resetPasswordSuccess: 'Your password has been reset. Sign in with your new password.',
} as const;
