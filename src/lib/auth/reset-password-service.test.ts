import { describe, expect, it } from 'vitest';

import { AUTH_MESSAGES } from '@/lib/auth/messages';
import {
  performResetPassword,
  type ResetConfirmVerdict,
  type ResetPasswordDeps,
  type ResetPasswordInput,
} from '@/lib/auth/reset-password-service';
import type { SecurityEvent } from '@/types/auth-security';

const INPUT: ResetPasswordInput = {
  oobCode: 'code-1',
  newPassword: 'correct-horse-9',
  ip: '203.0.113.7',
  userAgent: 'vitest',
};

function harness(options?: {
  verdict?: ResetConfirmVerdict;
  profile?: { uid: string; role: 'founder' | null } | null;
}) {
  const verdict = options?.verdict ?? { status: 'ok' as const, email: 'founder@terranext.in' };
  const revoked: string[] = [];
  const audited: Array<{ uid: string; role: string | null; email: string }> = [];
  const securityEvents: Array<Omit<SecurityEvent, 'at'>> = [];

  const deps: ResetPasswordDeps = {
    confirmer: { confirm: () => Promise.resolve(verdict) },
    staff: {
      findByEmail: () =>
        Promise.resolve(
          options?.profile === undefined ? { uid: 'uid-1', role: 'founder' } : options.profile,
        ),
    },
    sessions: {
      revokeAll: (uid) => {
        revoked.push(uid);
        return Promise.resolve();
      },
    },
    audit: {
      passwordResetCompleted: (entry) => {
        audited.push(entry);
        return Promise.resolve();
      },
    },
    createSecurityEvent: (event) => {
      securityEvents.push(event);
      return Promise.resolve();
    },
    hashEmail: (email) => `hash:${email}`,
  };

  return { deps, revoked, audited, securityEvents };
}

describe('performResetPassword (Doc 10 §1 extension)', () => {
  it('revokes sessions, audits, and records a security event on success', async () => {
    const { deps, revoked, audited, securityEvents } = harness();
    const result = await performResetPassword(deps, INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.message).toBe(AUTH_MESSAGES.resetPasswordSuccess);
    expect(revoked).toEqual(['uid-1']);
    expect(audited).toEqual([{ uid: 'uid-1', role: 'founder', email: 'founder@terranext.in' }]);
    expect(securityEvents).toEqual([
      {
        type: 'PASSWORD_RESET',
        severity: 'medium',
        emailHash: 'hash:founder@terranext.in',
        ip: INPUT.ip,
        userAgent: INPUT.userAgent,
        details: { uid: 'uid-1' },
      },
    ]);
  });

  it('succeeds with the generic message but skips revoke/audit for a non-staff Identity Toolkit account', async () => {
    const { deps, revoked, audited, securityEvents } = harness({ profile: null });
    const result = await performResetPassword(deps, INPUT);

    expect(result.ok).toBe(true);
    expect(revoked).toEqual([]);
    expect(audited).toEqual([]);
    expect(securityEvents).toEqual([]);
  });

  it('rejects an invalid or expired oobCode', async () => {
    const { deps } = harness({ verdict: { status: 'invalid_or_expired' } });
    const result = await performResetPassword(deps, INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unauthenticated');
      expect(result.error.message).toBe(AUTH_MESSAGES.resetLinkInvalid);
    }
  });

  it('rejects a weak password with a field-level error', async () => {
    const { deps } = harness({ verdict: { status: 'weak_password' } });
    const result = await performResetPassword(deps, INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      expect(result.error.fields).toEqual({ newPassword: AUTH_MESSAGES.resetPasswordWeak });
    }
  });

  it('reports service unavailability on a provider error', async () => {
    const { deps } = harness({ verdict: { status: 'provider_error' } });
    const result = await performResetPassword(deps, INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unavailable');
  });
});
