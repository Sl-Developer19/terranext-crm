import { AUTH_MESSAGES } from '@/lib/auth/messages';
import type { LoginProtection } from '@/lib/auth/login-protection';
import {
  err,
  rateLimitedError,
  unauthenticatedError,
  unavailableError,
  type Result,
} from '@/lib/utils/result';
import type { StaffRole } from '@/types/common';

/**
 * Login orchestration (Doc 10 §1 as amended by ADR-013). The route handler is
 * a thin shell over `performLogin`; every collaborator is an injected
 * interface so the flow is unit-testable and extensible without refactoring:
 * - guards[]        → CAPTCHA, App Check, per-IP rate limiting slot in here
 * - CredentialVerifier → password today; SSO verifiers implement the same contract
 * - 'mfa_required' outcome → the MFA challenge flow attaches when MFA lands
 */

export interface LoginInput {
  email: string;
  password: string;
  ip: string;
  userAgent: string;
}

/** Pre-credential gate. Return an error Result to reject before any credential work. */
export type LoginGuard = (input: LoginInput) => Promise<Result<void>>;

export type CredentialVerdict =
  | { status: 'ok'; uid: string; idToken: string }
  | { status: 'invalid_credentials' }
  | { status: 'disabled' }
  | {
      status: 'mfa_required';
      /** Opaque credential to pass to the MFA finalize endpoint. */
      mfaPendingCredential: string;
      /** Enrollment ID of the enrolled TOTP factor. */
      mfaEnrollmentId: string;
    }
  | { status: 'provider_error' };

export interface CredentialVerifier {
  verifyPassword(email: string, password: string): Promise<CredentialVerdict>;
}

export interface SessionMinter {
  /** Exchanges a verified ID token for a session cookie value. */
  mint(idToken: string): Promise<{ value: string; maxAgeMs: number }>;
}

export interface StaffProfile {
  role: StaffRole | null;
  status: 'active' | 'disabled';
}

export interface StaffDirectory {
  getProfile(uid: string): Promise<StaffProfile | null>;
  /** Refreshes `users/{uid}.lastLoginAt` (Doc 14). */
  recordSuccessfulLogin(uid: string, atMs: number): Promise<void>;
}

export interface LoginAuditWriter {
  /** Writes the Doc 03 §5 `action: 'login'` audit entry for a completed login. */
  loginSucceeded(entry: {
    uid: string;
    role: StaffRole | null;
    email: string;
    ip: string;
    userAgent: string;
    atMs: number;
  }): Promise<void>;
}

export interface LoginServiceDeps {
  protection: LoginProtection;
  verifier: CredentialVerifier;
  sessions: SessionMinter;
  staff: StaffDirectory;
  audit: LoginAuditWriter;
  guards: readonly LoginGuard[];
}

export type LoginOutcome =
  | {
      kind: 'authenticated';
      uid: string;
      sessionCookie: { value: string; maxAgeMs: number };
    }
  | {
      kind: 'mfa_required';
      /** Pass to /api/auth/mfa/challenge along with the TOTP code. */
      mfaPendingCredential: string;
      /** Which TOTP enrollment to verify against. */
      mfaEnrollmentId: string;
    }
  | { kind: 'rejected'; result: Result<never>; retryAfterSeconds?: number };

export async function performLogin(
  deps: LoginServiceDeps,
  input: LoginInput,
): Promise<LoginOutcome> {
  const { protection } = deps;
  const attemptCtx = { email: input.email, ip: input.ip, userAgent: input.userAgent };

  for (const guard of deps.guards) {
    const verdict = await guard(input);
    if (!verdict.ok) return { kind: 'rejected', result: err(verdict.error) };
  }

  // Lock check precedes any credential verification (server-enforced).
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

  // Unknown email, wrong password, and disabled accounts share one path and
  // one response shape — enumeration resistance (approved A3).
  if (verdict.status === 'invalid_credentials' || verdict.status === 'disabled') {
    await protection.incrementFailedLogin(attemptCtx);
    await protection.recordLoginAttempt(attemptCtx, {
      success: false,
      reason: verdict.status === 'disabled' ? 'disabled' : 'invalid_credentials',
    });
    return { kind: 'rejected', result: unauthenticatedError(AUTH_MESSAGES.invalidCredentials) };
  }

  if (verdict.status === 'mfa_required') {
    // Password stage passed but login is not complete: counters neither
    // reset nor increment. The MFA challenge flow attaches here.
    await protection.recordLoginAttempt(attemptCtx, { success: false, reason: 'mfa_required' });
    return {
      kind: 'mfa_required',
      mfaPendingCredential: verdict.mfaPendingCredential,
      mfaEnrollmentId: verdict.mfaEnrollmentId,
    };
  }

  if (verdict.status === 'provider_error') {
    await protection.recordLoginAttempt(attemptCtx, {
      success: false,
      reason: 'provider_error',
    });
    return { kind: 'rejected', result: unavailableError(AUTH_MESSAGES.serviceUnavailable) };
  }

  const profile = await deps.staff.getProfile(verdict.uid);
  if (profile === null || profile.status === 'disabled') {
    // Auth credentials valid but the CRM account is not usable — same generic
    // response, distinct register reason for the access log.
    await protection.incrementFailedLogin(attemptCtx);
    await protection.recordLoginAttempt(attemptCtx, {
      success: false,
      reason: profile === null ? 'not_provisioned' : 'disabled',
    });
    return { kind: 'rejected', result: unauthenticatedError(AUTH_MESSAGES.invalidCredentials) };
  }

  const state = await protection.resetFailedLogin(attemptCtx);
  await protection.recordLoginAttempt(attemptCtx, { success: true, reason: 'ok' });
  const atMs = state.lastSuccessfulLogin ?? 0;
  await deps.staff.recordSuccessfulLogin(verdict.uid, atMs);
  await deps.audit.loginSucceeded({
    uid: verdict.uid,
    role: profile.role,
    email: input.email,
    ip: input.ip,
    userAgent: input.userAgent,
    atMs,
  });
  const sessionCookie = await deps.sessions.mint(verdict.idToken);
  return { kind: 'authenticated', uid: verdict.uid, sessionCookie };
}
