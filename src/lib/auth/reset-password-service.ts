import { AUTH_MESSAGES } from '@/lib/auth/messages';
import {
  ok,
  unauthenticatedError,
  unavailableError,
  validationError,
  type Result,
} from '@/lib/utils/result';
import type { SecurityEvent } from '@/types/auth-security';
import type { StaffRole } from '@/types/common';

/**
 * Password-reset confirmation orchestration (Doc 10 §1 extension). Mirrors
 * `performLogin`'s DI shape: every collaborator is injected so the flow is
 * unit-testable without Firestore or the Identity Toolkit REST API.
 *
 * The oobCode itself is the bearer proof of authorization here — Identity
 * Toolkit already validated it (single-use, ~1h expiry) before this service
 * runs, so there is no separate lockout ladder to apply on this path.
 */

export interface ResetPasswordInput {
  oobCode: string;
  newPassword: string;
  ip: string;
  userAgent: string;
}

export type ResetConfirmVerdict =
  | { status: 'ok'; email: string }
  | { status: 'invalid_or_expired' }
  | { status: 'weak_password' }
  | { status: 'provider_error' };

export interface ResetConfirmer {
  confirm(oobCode: string, newPassword: string): Promise<ResetConfirmVerdict>;
}

export interface StaffLookup {
  /** Resolves the staff profile for an email Identity Toolkit has confirmed owns the reset. */
  findByEmail(email: string): Promise<{ uid: string; role: StaffRole | null } | null>;
}

export interface SessionRevoker {
  /** Invalidates every existing session for the account (Doc 10 §1 hardening). */
  revokeAll(uid: string): Promise<void>;
}

export interface ResetPasswordAuditWriter {
  passwordResetCompleted(entry: {
    uid: string;
    role: StaffRole | null;
    email: string;
  }): Promise<void>;
}

export interface ResetPasswordDeps {
  confirmer: ResetConfirmer;
  staff: StaffLookup;
  sessions: SessionRevoker;
  audit: ResetPasswordAuditWriter;
  createSecurityEvent(event: Omit<SecurityEvent, 'at'>): Promise<void>;
  hashEmail(email: string): string;
}

export async function performResetPassword(
  deps: ResetPasswordDeps,
  input: ResetPasswordInput,
): Promise<Result<{ message: string }>> {
  const verdict = await deps.confirmer.confirm(input.oobCode, input.newPassword);

  if (verdict.status === 'invalid_or_expired') {
    return unauthenticatedError(AUTH_MESSAGES.resetLinkInvalid);
  }
  if (verdict.status === 'weak_password') {
    return validationError(
      { newPassword: AUTH_MESSAGES.resetPasswordWeak },
      AUTH_MESSAGES.resetPasswordWeak,
    );
  }
  if (verdict.status === 'provider_error') {
    return unavailableError(AUTH_MESSAGES.serviceUnavailable);
  }

  // A password can be reset for any Identity Toolkit user, but only a
  // provisioned staff account (users/{uid} with a valid role) gets a session
  // revoke and audit trail — the CRM has no other account type reachable here.
  const profile = await deps.staff.findByEmail(verdict.email);
  if (profile) {
    await deps.sessions.revokeAll(profile.uid);
    await deps.audit.passwordResetCompleted({
      uid: profile.uid,
      role: profile.role,
      email: verdict.email,
    });
    await deps.createSecurityEvent({
      type: 'PASSWORD_RESET',
      severity: 'medium',
      emailHash: deps.hashEmail(verdict.email),
      ip: input.ip,
      userAgent: input.userAgent,
      details: { uid: profile.uid },
    });
  }

  return ok({ message: AUTH_MESSAGES.resetPasswordSuccess });
}
