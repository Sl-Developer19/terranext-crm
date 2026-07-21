import { AUTH_MESSAGES } from '@/lib/auth/messages';
import type { LoginProtection } from '@/lib/auth/login-protection';
import type { CredentialVerifier } from '@/lib/auth/login-service';
import {
  rateLimitedError,
  unauthenticatedError,
  unavailableError,
  type Result,
} from '@/lib/utils/result';
import type { StaffRole } from '@/types/common';

/**
 * Idle-timeout re-auth orchestration (Doc 10 §1 addendum, M1-B).
 *
 * Deliberately not `performLogin`: this never mints a session cookie (the
 * existing `__session` cookie is untouched — the lock is a client-side UI
 * gate, not a re-authentication of the session itself) and it verifies the
 * password belongs to the *already-signed-in* uid, never trusting the
 * request to say who it is re-authenticating. Reuses the same
 * `LoginProtection` lockout tiers as `/api/auth/login` (Doc 10 §1) so the
 * lock screen cannot be brute-forced on a separate, uncapped counter.
 */

export interface ReauthInput {
  /** The signed-in session's uid — never the client-submitted email's uid. */
  sessionUid: string;
  sessionRole: StaffRole;
  email: string;
  password: string;
  ip: string;
  userAgent: string;
}

export interface ReauthAuditWriter {
  reauthSucceeded(entry: { uid: string; role: StaffRole; email: string }): Promise<void>;
}

export interface ReauthServiceDeps {
  protection: LoginProtection;
  verifier: CredentialVerifier;
  audit: ReauthAuditWriter;
}

export type ReauthOutcome =
  { kind: 'unlocked' } | { kind: 'rejected'; result: Result<never>; retryAfterSeconds?: number };

export async function performReauth(
  deps: ReauthServiceDeps,
  input: ReauthInput,
): Promise<ReauthOutcome> {
  const { protection } = deps;
  const attemptCtx = { email: input.email, ip: input.ip, userAgent: input.userAgent };

  const lock = await protection.isLoginLocked(input.email);
  if (lock.locked) {
    await protection.recordLoginAttempt(attemptCtx, { success: false, reason: 'locked' });
    return {
      kind: 'rejected',
      result: rateLimitedError(AUTH_MESSAGES.locked(lock.remainingSeconds)),
      retryAfterSeconds: lock.remainingSeconds,
    };
  }

  const verdict = await deps.verifier.verifyPassword(input.email, input.password);

  if (verdict.status === 'invalid_credentials' || verdict.status === 'disabled') {
    await protection.incrementFailedLogin(attemptCtx);
    await protection.recordLoginAttempt(attemptCtx, {
      success: false,
      reason: verdict.status === 'disabled' ? 'disabled' : 'invalid_credentials',
    });
    return { kind: 'rejected', result: unauthenticatedError(AUTH_MESSAGES.invalidCredentials) };
  }

  if (verdict.status === 'provider_error') {
    // A provider error is retried by the user the same way a login provider
    // error is.
    await protection.recordLoginAttempt(attemptCtx, {
      success: false,
      reason: 'provider_error',
    });
    return {
      kind: 'rejected',
      result: unavailableError(AUTH_MESSAGES.serviceUnavailable),
    };
  }

  // Password verified against Identity Toolkit, but it must be *this*
  // session's account — never accept re-auth as a different staff member.
  if (verdict.uid !== input.sessionUid) {
    await protection.incrementFailedLogin(attemptCtx);
    await protection.recordLoginAttempt(attemptCtx, {
      success: false,
      reason: 'invalid_credentials',
    });
    return { kind: 'rejected', result: unauthenticatedError(AUTH_MESSAGES.invalidCredentials) };
  }

  await protection.resetFailedLogin(attemptCtx);
  await protection.recordLoginAttempt(attemptCtx, { success: true, reason: 'ok' });
  await deps.audit.reauthSucceeded({
    uid: verdict.uid,
    role: input.sessionRole,
    email: input.email,
  });
  return { kind: 'unlocked' };
}
