import { describe, expect, it } from 'vitest';

import { createLoginProtection } from '@/lib/auth/login-protection';
import { InMemoryLoginSecurityStore } from '@/lib/auth/login-protection/store';
import type { CredentialVerdict } from '@/lib/auth/login-service';
import { AUTH_MESSAGES } from '@/lib/auth/messages';
import { performReauth, type ReauthInput, type ReauthServiceDeps } from '@/lib/auth/reauth-service';
import { fixedClock } from '@/lib/utils/clock';

const T0 = 1_800_000_000_000;
const INPUT: ReauthInput = {
  sessionUid: 'uid-1',
  sessionRole: 'founder',
  email: 'founder@terranext.in',
  password: 'correct horse battery staple',
  ip: '203.0.113.7',
  userAgent: 'vitest',
};

function harness(options?: { verdict?: CredentialVerdict }) {
  const store = new InMemoryLoginSecurityStore();
  const clock = fixedClock(T0);
  const audited: Array<{ uid: string; role: string; email: string }> = [];
  const verdict = options?.verdict ?? { status: 'ok' as const, uid: 'uid-1', idToken: 'token-1' };

  const deps: ReauthServiceDeps = {
    protection: createLoginProtection({ store, clock }),
    verifier: { verifyPassword: () => Promise.resolve(verdict) },
    audit: {
      reauthSucceeded: (entry) => {
        audited.push(entry);
        return Promise.resolve();
      },
    },
  };
  return { deps, store, clock, audited };
}

describe('performReauth (Doc 10 §1 addendum, M1-B)', () => {
  it('unlocks, resets counters, and audits on a correct password for the session account', async () => {
    const { deps, store, audited } = harness();
    const outcome = await performReauth(deps, INPUT);

    expect(outcome.kind).toBe('unlocked');
    expect(audited).toEqual([{ uid: 'uid-1', role: 'founder', email: INPUT.email }]);
    expect(store.attempts.at(-1)).toMatchObject({ success: true, reason: 'ok' });
  });

  it('rejects with the generic message on a wrong password and increments the counter', async () => {
    const { deps, store } = harness({ verdict: { status: 'invalid_credentials' } });
    const outcome = await performReauth(deps, INPUT);

    expect(outcome.kind).toBe('rejected');
    if (outcome.kind === 'rejected' && !outcome.result.ok) {
      expect(outcome.result.error.code).toBe('unauthenticated');
      expect(outcome.result.error.message).toBe(AUTH_MESSAGES.invalidCredentials);
    }
    expect([...store.states.values()][0]?.failedAttempts).toBe(1);
  });

  it('rejects a password that verifies against a different account than the session', async () => {
    const { deps, store } = harness({
      verdict: { status: 'ok', uid: 'someone-else', idToken: 'token-x' },
    });
    const outcome = await performReauth(deps, INPUT);

    expect(outcome.kind).toBe('rejected');
    if (outcome.kind === 'rejected' && !outcome.result.ok) {
      expect(outcome.result.error.code).toBe('unauthenticated');
    }
    expect([...store.states.values()][0]?.failedAttempts).toBe(1);
  });

  it('locks after 3 failures using the same lockout tiers as login', async () => {
    const { deps } = harness({ verdict: { status: 'invalid_credentials' } });
    for (let i = 0; i < 3; i += 1) await performReauth(deps, INPUT);

    const locked = await performReauth(deps, { ...INPUT, password: 'the real password' });
    expect(locked.kind).toBe('rejected');
    if (locked.kind === 'rejected' && !locked.result.ok) {
      expect(locked.result.error.code).toBe('rate_limited');
      expect(locked.retryAfterSeconds).toBe(30);
    }
  });

  it('does not unlock on mfa_required or provider_error verdicts (password-only by design)', async () => {
    const mfa = await performReauth(
      harness({
        verdict: {
          status: 'mfa_required',
          mfaPendingCredential: 'cred',
          mfaEnrollmentId: 'enrollment',
        },
      }).deps,
      INPUT,
    );
    expect(mfa.kind).toBe('rejected');

    const providerError = await performReauth(
      harness({ verdict: { status: 'provider_error' } }).deps,
      INPUT,
    );
    expect(providerError.kind).toBe('rejected');
    if (providerError.kind === 'rejected' && !providerError.result.ok) {
      expect(providerError.result.error.code).toBe('unavailable');
    }
  });
});
