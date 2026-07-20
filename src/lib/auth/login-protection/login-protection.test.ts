import { describe, expect, it } from 'vitest';

import { hashEmail } from '@/lib/auth/identity';
import { fixedClock } from '@/lib/utils/clock';

import { createLoginProtection } from './index';
import { InMemoryLoginSecurityStore } from './store';

const T0 = 1_800_000_000_000;
const CTX = { email: 'Staff@TerraNext.in', ip: '203.0.113.7', userAgent: 'vitest' };

function setup() {
  const store = new InMemoryLoginSecurityStore();
  const clock = fixedClock(T0);
  const protection = createLoginProtection({ store, clock });
  return { store, clock, protection };
}

describe('login protection utilities (ADR-013)', () => {
  it('keys the ledger by SHA-256 of the normalized email — never plain addresses', async () => {
    const { store, protection } = setup();
    await protection.incrementFailedLogin(CTX);
    const expectedHash = hashEmail('staff@terranext.in');
    expect(store.states.has(expectedHash)).toBe(true);
    const serialized = JSON.stringify([...store.states.entries()]);
    expect(serialized).not.toContain('terranext.in');
  });

  it('treats differently-cased spellings of one email as the same account', async () => {
    const { store, protection } = setup();
    await protection.incrementFailedLogin(CTX);
    await protection.incrementFailedLogin({ ...CTX, email: ' staff@terranext.in ' });
    expect(store.states.size).toBe(1);
    expect([...store.states.values()][0]?.failedAttempts).toBe(2);
  });

  it('escalates locks at 3, 5, and 10 failures and reports remaining seconds', async () => {
    const { clock, protection } = setup();
    for (let i = 0; i < 3; i += 1) await protection.incrementFailedLogin(CTX);
    let lock = await protection.isLoginLocked(CTX.email);
    expect(lock).toEqual({ locked: true, remainingSeconds: 30 });

    clock.advance(31_000);
    expect((await protection.isLoginLocked(CTX.email)).locked).toBe(false);

    for (let i = 0; i < 2; i += 1) await protection.incrementFailedLogin(CTX);
    lock = await protection.isLoginLocked(CTX.email);
    expect(lock).toEqual({ locked: true, remainingSeconds: 5 * 60 });

    clock.advance(5 * 60_000 + 1_000);
    for (let i = 0; i < 5; i += 1) await protection.incrementFailedLogin(CTX);
    lock = await protection.isLoginLocked(CTX.email);
    expect(lock).toEqual({ locked: true, remainingSeconds: 30 * 60 });
  });

  it('creates one HIGH security event when the 10th failure locks the account', async () => {
    const { store, protection } = setup();
    let eventFlags = 0;
    for (let i = 0; i < 12; i += 1) {
      const outcome = await protection.incrementFailedLogin(CTX);
      if (outcome.securityEventCreated) eventFlags += 1;
    }
    expect(eventFlags).toBe(1);
    expect(store.securityEvents).toHaveLength(1);
    const event = store.securityEvents[0];
    expect(event?.type).toBe('LOGIN_LOCKOUT');
    expect(event?.severity).toBe('high');
    expect(event?.emailHash).toBe(hashEmail(CTX.email));
    expect(event?.ip).toBe(CTX.ip);
    expect(event?.details.failedAttempts).toBe(10);
    expect(event?.details.lockDurationMs).toBe(30 * 60_000);
  });

  it('resetFailedLogin clears counters and records success metadata', async () => {
    const { store, clock, protection } = setup();
    for (let i = 0; i < 4; i += 1) await protection.incrementFailedLogin(CTX);
    clock.advance(10_000);
    const state = await protection.resetFailedLogin(CTX);
    expect(state.failedAttempts).toBe(0);
    expect(state.lockedUntil).toBeNull();
    expect(state.lastSuccessfulLogin).toBe(T0 + 10_000);
    expect(state.lastLoginIp).toBe(CTX.ip);
    expect(state.lastUserAgent).toBe(CTX.userAgent);
    expect((await protection.isLoginLocked(CTX.email)).locked).toBe(false);
    expect(store.states.size).toBe(1);
  });

  it('createSecurityEvent stamps the injected clock time', async () => {
    const { store, clock, protection } = setup();
    clock.advance(5_000);
    await protection.createSecurityEvent({
      type: 'SESSION_REVOKED',
      severity: 'medium',
      emailHash: hashEmail(CTX.email),
      ip: CTX.ip,
      userAgent: CTX.userAgent,
      details: {},
    });
    expect(store.securityEvents[0]?.at).toBe(T0 + 5_000);
  });

  it('recordLoginAttempt writes the full access-log entry', async () => {
    const { store, protection } = setup();
    await protection.recordLoginAttempt(CTX, { success: false, reason: 'invalid_credentials' });
    await protection.recordLoginAttempt(CTX, { success: true, reason: 'ok' });
    expect(store.attempts).toHaveLength(2);
    expect(store.attempts[0]).toEqual({
      at: T0,
      email: 'staff@terranext.in',
      emailHash: hashEmail(CTX.email),
      success: false,
      ip: CTX.ip,
      userAgent: CTX.userAgent,
      reason: 'invalid_credentials',
    });
    expect(store.attempts[1]?.success).toBe(true);
    expect(store.attempts[1]?.reason).toBe('ok');
  });
});
