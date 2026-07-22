import { describe, expect, it } from 'vitest';

import { backoffMs, decideNext, isDue, MAX_ATTEMPTS } from './dispatch-logic';

const now = new Date('2026-07-22T10:00:00.000Z');

describe('backoffMs', () => {
  it('doubles each attempt', () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
  });

  it('caps so a provider outage is not hammered', () => {
    expect(backoffMs(10)).toBe(16 * 60_000);
    expect(backoffMs(100)).toBe(16 * 60_000);
  });
});

describe('decideNext', () => {
  it('marks a successful send sent and stops', () => {
    const decision = decideNext({ status: 'sent', providerMessageId: 'm1' }, 0, now);
    expect(decision).toEqual({ status: 'sent', failureReason: null, nextAttemptAt: null });
  });

  it('marks a hard rejection failed without retrying', () => {
    const decision = decideNext({ status: 'failed', reason: 'invalid address' }, 0, now);
    expect(decision.status).toBe('failed');
    expect(decision.nextAttemptAt).toBeNull();
    expect(decision.failureReason).toBe('invalid address');
  });

  it('requeues a transient failure with backoff', () => {
    const decision = decideNext({ status: 'deferred', reason: '503' }, 0, now);
    expect(decision.status).toBe('queued');
    expect(decision.nextAttemptAt).toEqual(new Date(now.getTime() + 60_000));
  });

  it('gives up once the attempt ceiling is reached', () => {
    const decision = decideNext({ status: 'deferred', reason: 'timeout' }, MAX_ATTEMPTS - 1, now);
    expect(decision.status).toBe('failed');
    expect(decision.failureReason).toContain('Giving up');
    expect(decision.nextAttemptAt).toBeNull();
  });

  it('keeps retrying just below the ceiling', () => {
    const decision = decideNext({ status: 'deferred', reason: 'timeout' }, MAX_ATTEMPTS - 2, now);
    expect(decision.status).toBe('queued');
  });
});

describe('isDue', () => {
  it('treats a never-attempted message as due', () => {
    expect(isDue(null, now)).toBe(true);
  });

  it('waits until the backoff has elapsed', () => {
    expect(isDue(new Date(now.getTime() + 1000), now)).toBe(false);
    expect(isDue(new Date(now.getTime() - 1000), now)).toBe(true);
  });
});
