import { describe, expect, it } from 'vitest';

import { AUTH_SECURITY } from '@/config/auth-security';
import type { LoginSecurityState } from '@/types/auth-security';

import {
  applyFailedAttempt,
  applySuccessfulLogin,
  freshState,
  isLockedAt,
  remainingLockSeconds,
} from './policy';

const HASH = 'a'.repeat(64);
const T0 = 1_800_000_000_000; // fixed epoch base for determinism

function failTimes(count: number, startMs = T0): LoginSecurityState {
  let state: LoginSecurityState | null = null;
  for (let i = 0; i < count; i += 1) {
    state = applyFailedAttempt(state, HASH, startMs + i * 1_000, AUTH_SECURITY).next;
  }
  if (state === null) throw new Error('count must be ≥ 1');
  return state;
}

describe('login lockout policy (Doc 10 §1 / ADR-013)', () => {
  it('applies no lock below 3 failures', () => {
    const state = failTimes(2);
    expect(state.failedAttempts).toBe(2);
    expect(state.lockedUntil).toBeNull();
    expect(isLockedAt(state, T0 + 2_000)).toBe(false);
  });

  it('locks for 30 seconds at 3 consecutive failures', () => {
    const state = failTimes(3);
    const failedAt = T0 + 2_000;
    expect(state.failedAttempts).toBe(3);
    expect(state.lockedUntil).toBe(failedAt + 30_000);
    expect(isLockedAt(state, failedAt + 29_999)).toBe(true);
    expect(isLockedAt(state, failedAt + 30_000)).toBe(false);
  });

  it('locks for 5 minutes at 5 consecutive failures', () => {
    const state = failTimes(5);
    expect(state.lockedUntil).toBe(T0 + 4_000 + 5 * 60_000);
  });

  it('locks for 30 minutes at 10 consecutive failures', () => {
    const state = failTimes(10);
    expect(state.lockedUntil).toBe(T0 + 9_000 + 30 * 60_000);
  });

  it('emits the HIGH security event exactly once, at the 10th failure', () => {
    let state: LoginSecurityState | null = null;
    const events: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const evaluation = applyFailedAttempt(state, HASH, T0 + i * 1_000, AUTH_SECURITY);
      state = evaluation.next;
      if (evaluation.securityEvent) {
        events.push(state.failedAttempts);
        expect(evaluation.securityEvent.severity).toBe('high');
        expect(evaluation.securityEvent.type).toBe('LOGIN_LOCKOUT');
      }
    }
    expect(events).toEqual([10]);
  });

  it('extends the 30-minute lock on failures beyond the 10th (approved A2)', () => {
    const at10 = failTimes(10);
    const laterMs = T0 + 60_000;
    const at11 = applyFailedAttempt(at10, HASH, laterMs, AUTH_SECURITY);
    expect(at11.next.failedAttempts).toBe(11);
    expect(at11.next.lockedUntil).toBe(laterMs + 30 * 60_000);
    expect(at11.securityEvent).toBeNull();
  });

  it('restarts the streak when the previous failure has decayed (approved A1)', () => {
    const stale = failTimes(4);
    const afterDecay = T0 + 3_000 + AUTH_SECURITY.failedAttemptDecayMs;
    const next = applyFailedAttempt(stale, HASH, afterDecay, AUTH_SECURITY);
    expect(next.next.failedAttempts).toBe(1);
    expect(next.next.lockedUntil).toBeNull();
  });

  it('still counts failures inside the decay window', () => {
    const two = failTimes(2);
    const justInside = T0 + 1_000 + AUTH_SECURITY.failedAttemptDecayMs - 1;
    const next = applyFailedAttempt(two, HASH, justInside, AUTH_SECURITY);
    expect(next.next.failedAttempts).toBe(3);
    expect(next.next.lockedUntil).toBe(justInside + 30_000);
  });

  it('successful login resets counters and clears the lock', () => {
    const locked = failTimes(10);
    expect(isLockedAt(locked, T0 + 10_000)).toBe(true);
    const reset = applySuccessfulLogin(HASH, T0 + 20_000, {
      ip: '203.0.113.7',
      userAgent: 'vitest',
    });
    expect(reset.failedAttempts).toBe(0);
    expect(reset.lastFailedAt).toBeNull();
    expect(reset.lockedUntil).toBeNull();
    expect(reset.lastSuccessfulLogin).toBe(T0 + 20_000);
    expect(reset.lastLoginIp).toBe('203.0.113.7');
    expect(reset.lastUserAgent).toBe('vitest');
    expect(isLockedAt(reset, T0 + 20_000)).toBe(false);
  });

  it('reports remaining lock seconds rounded up', () => {
    const state = failTimes(3); // locked until T0 + 2_000 + 30_000
    expect(remainingLockSeconds(state, T0 + 2_500)).toBe(30); // 29.5s → 30
    expect(remainingLockSeconds(state, T0 + 31_999)).toBe(1);
    expect(remainingLockSeconds(state, T0 + 32_000)).toBe(0);
    expect(remainingLockSeconds(freshState(HASH), T0)).toBe(0);
  });
});
