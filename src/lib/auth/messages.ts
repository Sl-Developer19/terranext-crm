/**
 * The only user-facing authentication strings (Doc 10 §1 / ADR-013).
 * One generic failure message by design: responses must never distinguish
 * "email not found" from "wrong password" (enumeration resistance).
 */
export const AUTH_MESSAGES = {
  invalidCredentials: 'Invalid email or password.',
  locked: (seconds: number) => `Too many failed login attempts. Try again in ${seconds} seconds.`,
  mfaRequired: 'Additional verification is required to complete sign-in.',
  serviceUnavailable: 'Sign-in is temporarily unavailable. Please try again.',
} as const;
