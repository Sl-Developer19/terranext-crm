/**
 * Login brute-force protection domain types (Doc 10 §1 as amended by ADR-013).
 * Framework-free by rule — timestamps are epoch milliseconds; the Firestore
 * store layer converts to/from `Timestamp` at the persistence boundary.
 */

/** Escalating lockout tier. `securityEvent` fires once when the tier is crossed exactly. */
export interface FailedAttemptThreshold {
  /** Consecutive failed attempts at which this tier activates. */
  attempts: number;
  /** Lock duration applied from the moment of the triggering failure. */
  lockDurationMs: number;
  /** Optional security event emitted when `failedAttempts` reaches exactly `attempts`. */
  securityEvent?: {
    type: SecurityEventType;
    severity: SecurityEventSeverity;
  };
}

export interface AuthSecurityConfig {
  /** A failure older than this no longer counts toward "consecutive" (approved A1). */
  failedAttemptDecayMs: number;
  /** Ascending by `attempts`; the highest tier ≤ count governs the lock duration. */
  failedAttemptThresholds: readonly FailedAttemptThreshold[];
  /** Session cookie policy — consumed by lib/auth/session (Doc 10 §1). */
  sessionCookie: {
    name: string;
    maxAgeMs: number;
  };
}

/**
 * `loginSecurity/{sha256(normalizedEmail)}` — server-only collection.
 * Keyed by email hash (never plain email) so unknown addresses are trackable
 * without an enumeration oracle and no PII sits in the security ledger.
 */
export interface LoginSecurityState {
  emailHash: string;
  failedAttempts: number;
  lastFailedAt: number | null;
  lockedUntil: number | null;
  /** Success metadata: set only by a completed login. */
  lastSuccessfulLogin: number | null;
  lastLoginIp: string | null;
  lastUserAgent: string | null;
}

export type LoginAttemptReason =
  'ok' | 'invalid_credentials' | 'locked' | 'disabled' | 'not_provisioned' | 'provider_error';

/** `loginAttempts/{autoId}` — the SOP 17.16 System Access Log register entry. */
export interface LoginAttempt {
  at: number;
  email: string;
  emailHash: string;
  success: boolean;
  ip: string;
  userAgent: string;
  reason: LoginAttemptReason;
}

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Extensible catalogue (approved amendment 7) — add members, never repurpose. */
export type SecurityEventType =
  'LOGIN_LOCKOUT' | 'ACCOUNT_DISABLED' | 'SESSION_REVOKED' | 'PASSWORD_RESET';

/** `securityEvents/{autoId}` — server-only, immutable. */
export interface SecurityEvent {
  at: number;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  emailHash: string;
  ip: string;
  userAgent: string;
  details: Record<string, string | number | boolean>;
}
