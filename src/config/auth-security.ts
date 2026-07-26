import type { AuthSecurityConfig } from '@/types/auth-security';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Runtime security configuration for authentication (Doc 10 §1 / ADR-013).
 * Single source for every lockout number — policy code reads only from here.
 */
export const AUTH_SECURITY = {
  failedAttemptDecayMs: 30 * MINUTE_MS,
  failedAttemptThresholds: [
    { attempts: 3, lockDurationMs: 30 * SECOND_MS },
    { attempts: 5, lockDurationMs: 5 * MINUTE_MS },
    {
      attempts: 10,
      lockDurationMs: 30 * MINUTE_MS,
      securityEvent: { type: 'LOGIN_LOCKOUT', severity: 'high' },
    },
  ],
  sessionCookie: {
    name: '__session',
    maxAgeMs: 5 * DAY_MS,
  },
  partnerSessionCookie: {
    name: '__partner_session',
    maxAgeMs: 5 * DAY_MS,
  },
} as const satisfies AuthSecurityConfig;
