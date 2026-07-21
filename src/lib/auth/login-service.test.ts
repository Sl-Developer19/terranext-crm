import { describe, expect, it } from 'vitest';

import { createLoginProtection } from '@/lib/auth/login-protection';
import { InMemoryLoginSecurityStore } from '@/lib/auth/login-protection/store';
import {
  performLogin,
  type CredentialVerdict,
  type LoginInput,
  type LoginServiceDeps,
} from '@/lib/auth/login-service';
import { AUTH_MESSAGES } from '@/lib/auth/messages';
import { permissionError } from '@/lib/utils/result';
import { fixedClock } from '@/lib/utils/clock';

const T0 = 1_800_000_000_000;
const INPUT: LoginInput = {
  email: 'staff@terranext.in',
  password: 'correct horse battery staple',
  ip: '203.0.113.7',
  userAgent: 'vitest',
};

interface Harness {
  deps: LoginServiceDeps;
  store: InMemoryLoginSecurityStore;
  clock: ReturnType<typeof fixedClock>;
  calls: {
    verify: number;
    minted: string[];
    lastLoginRecorded: Array<{ uid: string; atMs: number }>;
    audited: Array<{ uid: string; role: string | null }>;
  };
}

function harness(options?: {
  verdict?: CredentialVerdict;
  profile?: { role: 'consultant'; status: 'active' | 'disabled' } | null;
  guards?: LoginServiceDeps['guards'];
}): Harness {
  const store = new InMemoryLoginSecurityStore();
  const clock = fixedClock(T0);
  const calls: Harness['calls'] = { verify: 0, minted: [], lastLoginRecorded: [], audited: [] };
  const verdict = options?.verdict ?? {
    status: 'ok' as const,
    uid: 'uid-1',
    idToken: 'id-token-1',
  };
  const profile =
    options?.profile === undefined
      ? { role: 'consultant' as const, status: 'active' as const }
      : options.profile;

  const deps: LoginServiceDeps = {
    protection: createLoginProtection({ store, clock }),
    verifier: {
      verifyPassword: () => {
        calls.verify += 1;
        return Promise.resolve(verdict);
      },
    },
    sessions: {
      mint: (idToken) => {
        calls.minted.push(idToken);
        return Promise.resolve({ value: `cookie(${idToken})`, maxAgeMs: 1_000 });
      },
    },
    staff: {
      getProfile: () => Promise.resolve(profile),
      recordSuccessfulLogin: (uid, atMs) => {
        calls.lastLoginRecorded.push({ uid, atMs });
        return Promise.resolve();
      },
    },
    audit: {
      loginSucceeded: (entry) => {
        calls.audited.push({ uid: entry.uid, role: entry.role });
        return Promise.resolve();
      },
    },
    guards: options?.guards ?? [],
  };
  return { deps, store, clock, calls };
}

describe('performLogin (Doc 10 §1 / ADR-013)', () => {
  it('authenticates, resets counters, audits, and mints the session cookie', async () => {
    const { deps, store, calls } = harness();
    await deps.protection.incrementFailedLogin(INPUT); // stale failure to clear
    const outcome = await performLogin(deps, INPUT);

    expect(outcome.kind).toBe('authenticated');
    if (outcome.kind === 'authenticated') {
      expect(outcome.uid).toBe('uid-1');
      expect(outcome.sessionCookie.value).toBe('cookie(id-token-1)');
    }
    expect([...store.states.values()][0]?.failedAttempts).toBe(0);
    expect(calls.lastLoginRecorded).toEqual([{ uid: 'uid-1', atMs: T0 }]);
    expect(calls.audited).toEqual([{ uid: 'uid-1', role: 'consultant' }]);
    expect(store.attempts.at(-1)).toMatchObject({ success: true, reason: 'ok' });
  });

  it('returns one generic message for wrong passwords and increments the counter', async () => {
    const { deps, store } = harness({ verdict: { status: 'invalid_credentials' } });
    const outcome = await performLogin(deps, INPUT);

    expect(outcome.kind).toBe('rejected');
    if (outcome.kind === 'rejected' && !outcome.result.ok) {
      expect(outcome.result.error.code).toBe('unauthenticated');
      expect(outcome.result.error.message).toBe(AUTH_MESSAGES.invalidCredentials);
    }
    expect([...store.states.values()][0]?.failedAttempts).toBe(1);
    expect(store.attempts.at(-1)).toMatchObject({
      success: false,
      reason: 'invalid_credentials',
    });
  });

  it('never reveals whether the email exists — unknown email and wrong password produce identical responses', async () => {
    const unknownEmail = await performLogin(
      harness({ verdict: { status: 'invalid_credentials' } }).deps,
      { ...INPUT, email: 'nobody@terranext.in' },
    );
    const wrongPassword = await performLogin(
      harness({ verdict: { status: 'invalid_credentials' } }).deps,
      INPUT,
    );
    const disabledAuthAccount = await performLogin(
      harness({ verdict: { status: 'disabled' } }).deps,
      INPUT,
    );
    expect(unknownEmail).toEqual(wrongPassword);
    expect(disabledAuthAccount).toEqual(wrongPassword);
  });

  it('locks after 3 failures and blocks authentication without touching credentials', async () => {
    const { deps, calls, store } = harness({ verdict: { status: 'invalid_credentials' } });
    for (let i = 0; i < 3; i += 1) await performLogin(deps, INPUT);
    expect(calls.verify).toBe(3);

    const locked = await performLogin(deps, { ...INPUT, password: 'the real password' });
    expect(calls.verify).toBe(3); // verifier NOT called while locked
    expect(locked.kind).toBe('rejected');
    if (locked.kind === 'rejected' && !locked.result.ok) {
      expect(locked.result.error.code).toBe('rate_limited');
      expect(locked.result.error.message).toBe(
        'Too many failed login attempts. Try again in 30 seconds.',
      );
      expect(locked.retryAfterSeconds).toBe(30);
    }
    expect(store.attempts.at(-1)).toMatchObject({ success: false, reason: 'locked' });
  });

  it('unlocks after the lock window and accepts a correct password', async () => {
    const bad = harness({ verdict: { status: 'invalid_credentials' } });
    for (let i = 0; i < 3; i += 1) await performLogin(bad.deps, INPUT);
    bad.clock.advance(30_001);

    // Same store/clock, now with valid credentials
    const good = harness();
    good.deps.protection = bad.deps.protection;
    const outcome = await performLogin(good.deps, INPUT);
    expect(outcome.kind).toBe('authenticated');
    expect([...bad.store.states.values()][0]?.failedAttempts).toBe(0);
  });

  it('records the HIGH security event at the 10th consecutive failure', async () => {
    const { deps, store, clock } = harness({ verdict: { status: 'invalid_credentials' } });
    for (let i = 0; i < 10; i += 1) {
      // advance past any active lock so each attempt reaches the verifier
      const lock = await deps.protection.isLoginLocked(INPUT.email);
      if (lock.locked) clock.advance(lock.remainingSeconds * 1_000 + 1);
      await performLogin(deps, INPUT);
    }
    expect(store.securityEvents).toHaveLength(1);
    expect(store.securityEvents[0]).toMatchObject({ type: 'LOGIN_LOCKOUT', severity: 'high' });
  });

  it('treats a valid credential without a provisioned staff profile as a generic failure', async () => {
    const { deps, store, calls } = harness({ profile: null });
    const outcome = await performLogin(deps, INPUT);
    expect(outcome.kind).toBe('rejected');
    if (outcome.kind === 'rejected' && !outcome.result.ok) {
      expect(outcome.result.error.message).toBe(AUTH_MESSAGES.invalidCredentials);
    }
    expect(calls.minted).toHaveLength(0);
    expect([...store.states.values()][0]?.failedAttempts).toBe(1);
    expect(store.attempts.at(-1)).toMatchObject({ success: false, reason: 'not_provisioned' });
  });

  it('treats a disabled CRM profile as a generic failure', async () => {
    const { deps, store, calls } = harness({ profile: { role: 'consultant', status: 'disabled' } });
    const outcome = await performLogin(deps, INPUT);
    expect(outcome.kind).toBe('rejected');
    expect(calls.minted).toHaveLength(0);
    expect(store.attempts.at(-1)).toMatchObject({ success: false, reason: 'disabled' });
  });

  it('maps provider errors to a retryable unavailable result without counting a failure', async () => {
    const { deps, store } = harness({ verdict: { status: 'provider_error' } });
    const outcome = await performLogin(deps, INPUT);
    expect(outcome.kind).toBe('rejected');
    if (outcome.kind === 'rejected' && !outcome.result.ok) {
      expect(outcome.result.error.code).toBe('unavailable');
      expect(outcome.result.error.retryable).toBe(true);
    }
    expect(store.states.size).toBe(0);
    expect(store.attempts.at(-1)).toMatchObject({ success: false, reason: 'provider_error' });
  });

  it('lets a guard (CAPTCHA / App Check / rate limit slot) reject before any credential work', async () => {
    const { deps, calls, store } = harness({
      guards: [() => Promise.resolve(permissionError('App Check verification failed.'))],
    });
    const outcome = await performLogin(deps, INPUT);
    expect(outcome.kind).toBe('rejected');
    expect(calls.verify).toBe(0);
    expect(store.attempts).toHaveLength(0);
  });
});
