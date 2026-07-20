import type {
  AuthSecurityConfig,
  FailedAttemptThreshold,
  LoginSecurityState,
} from '@/types/auth-security';

/**
 * Pure lockout policy (ADR-013). No I/O, no Firebase, no wall clock — every
 * function takes `nowMs` from an injected Clock so tests are deterministic.
 * Persistence and orchestration live in ./store.ts and ./index.ts.
 */

export function freshState(emailHash: string): LoginSecurityState {
  return {
    emailHash,
    failedAttempts: 0,
    lastFailedAt: null,
    lockedUntil: null,
    lastSuccessfulLogin: null,
    lastLoginIp: null,
    lastUserAgent: null,
  };
}

export interface FailureEvaluation {
  next: LoginSecurityState;
  /** The tier governing the applied lock, if any (highest tier ≤ count). */
  activeThreshold: FailedAttemptThreshold | null;
  /**
   * Security event to emit, present only when the count lands exactly on a
   * tier that declares one (approved A2: once at crossing, not on extensions).
   */
  securityEvent: FailedAttemptThreshold['securityEvent'] | null;
}

/**
 * Applies one failed attempt. "Consecutive" means: a previous failure older
 * than `failedAttemptDecayMs` no longer counts, so the streak restarts at 1
 * (approved A1). Failures past the top tier keep extending its lock duration
 * from the newest failure (approved A2).
 */
export function applyFailedAttempt(
  prev: LoginSecurityState | null,
  emailHash: string,
  nowMs: number,
  config: AuthSecurityConfig,
): FailureEvaluation {
  const base =
    prev !== null &&
    prev.lastFailedAt !== null &&
    nowMs - prev.lastFailedAt < config.failedAttemptDecayMs
      ? prev.failedAttempts
      : 0;
  const failedAttempts = base + 1;

  let activeThreshold: FailedAttemptThreshold | null = null;
  for (const tier of config.failedAttemptThresholds) {
    if (tier.attempts <= failedAttempts) activeThreshold = tier;
  }
  const crossedExactly = config.failedAttemptThresholds.find(
    (tier) => tier.attempts === failedAttempts,
  );

  return {
    next: {
      ...(prev ?? freshState(emailHash)),
      emailHash,
      failedAttempts,
      lastFailedAt: nowMs,
      lockedUntil: activeThreshold ? nowMs + activeThreshold.lockDurationMs : null,
    },
    activeThreshold,
    securityEvent: crossedExactly?.securityEvent ?? null,
  };
}

/** Successful login: counters reset, lock cleared, success metadata recorded. */
export function applySuccessfulLogin(
  emailHash: string,
  nowMs: number,
  meta: { ip: string; userAgent: string },
): LoginSecurityState {
  return {
    emailHash,
    failedAttempts: 0,
    lastFailedAt: null,
    lockedUntil: null,
    lastSuccessfulLogin: nowMs,
    lastLoginIp: meta.ip,
    lastUserAgent: meta.userAgent,
  };
}

export function isLockedAt(state: LoginSecurityState | null, nowMs: number): boolean {
  return state !== null && state.lockedUntil !== null && state.lockedUntil > nowMs;
}

/** Whole seconds remaining, rounded up — feeds the "Try again in X seconds." message. */
export function remainingLockSeconds(state: LoginSecurityState | null, nowMs: number): number {
  if (state === null || state.lockedUntil === null) return 0;
  return Math.max(0, Math.ceil((state.lockedUntil - nowMs) / 1_000));
}
