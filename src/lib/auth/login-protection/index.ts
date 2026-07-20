import { AUTH_SECURITY } from '@/config/auth-security';
import { hashEmail, normalizeEmail } from '@/lib/auth/identity';
import type { Clock } from '@/lib/utils/clock';
import type {
  AuthSecurityConfig,
  LoginAttempt,
  LoginAttemptReason,
  LoginSecurityState,
  SecurityEvent,
} from '@/types/auth-security';

import {
  applyFailedAttempt,
  applySuccessfulLogin,
  isLockedAt,
  remainingLockSeconds,
} from './policy';
import type { LoginSecurityStore } from './store';

/**
 * Login brute-force protection utilities (Doc 10 §1 / ADR-013).
 * Server-enforced; any client-side countdown is cosmetic only.
 */

export interface LoginProtectionDeps {
  store: LoginSecurityStore;
  clock: Clock;
  config?: AuthSecurityConfig;
}

export interface AttemptContext {
  email: string;
  ip: string;
  userAgent: string;
}

export interface LockStatus {
  locked: boolean;
  /** 0 when not locked. */
  remainingSeconds: number;
}

export interface FailedLoginOutcome {
  state: LoginSecurityState;
  /** Lock applied by this failure, if any. */
  lockDurationMs: number | null;
  /** True only on the failure that crossed a security-event tier. */
  securityEventCreated: boolean;
}

export interface LoginProtection {
  isLoginLocked(email: string): Promise<LockStatus>;
  incrementFailedLogin(ctx: AttemptContext): Promise<FailedLoginOutcome>;
  resetFailedLogin(ctx: AttemptContext): Promise<LoginSecurityState>;
  createSecurityEvent(event: Omit<SecurityEvent, 'at'>): Promise<void>;
  recordLoginAttempt(
    ctx: AttemptContext,
    outcome: { success: boolean; reason: LoginAttemptReason },
  ): Promise<void>;
}

export function createLoginProtection(deps: LoginProtectionDeps): LoginProtection {
  const { store, clock } = deps;
  const config = deps.config ?? AUTH_SECURITY;

  async function createSecurityEvent(event: Omit<SecurityEvent, 'at'>): Promise<void> {
    await store.appendSecurityEvent({ ...event, at: clock.now() });
  }

  return {
    async isLoginLocked(email) {
      const state = await store.read(hashEmail(email));
      const now = clock.now();
      return {
        locked: isLockedAt(state, now),
        remainingSeconds: isLockedAt(state, now) ? remainingLockSeconds(state, now) : 0,
      };
    },

    async incrementFailedLogin(ctx) {
      const emailHash = hashEmail(ctx.email);
      const evaluation = await store.transact(emailHash, (current) => {
        const applied = applyFailedAttempt(current, emailHash, clock.now(), config);
        return { next: applied.next, result: applied };
      });
      if (evaluation.securityEvent) {
        await createSecurityEvent({
          type: evaluation.securityEvent.type,
          severity: evaluation.securityEvent.severity,
          emailHash,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          details: {
            failedAttempts: evaluation.next.failedAttempts,
            lockDurationMs: evaluation.activeThreshold?.lockDurationMs ?? 0,
          },
        });
      }
      return {
        state: evaluation.next,
        lockDurationMs: evaluation.activeThreshold?.lockDurationMs ?? null,
        securityEventCreated: evaluation.securityEvent !== null,
      };
    },

    async resetFailedLogin(ctx) {
      const emailHash = hashEmail(ctx.email);
      return store.transact(emailHash, () => {
        const next = applySuccessfulLogin(emailHash, clock.now(), {
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
        return { next, result: next };
      });
    },

    createSecurityEvent,

    async recordLoginAttempt(ctx, outcome) {
      const attempt: LoginAttempt = {
        at: clock.now(),
        email: normalizeEmail(ctx.email),
        emailHash: hashEmail(ctx.email),
        success: outcome.success,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        reason: outcome.reason,
      };
      await store.appendAttempt(attempt);
    },
  };
}
