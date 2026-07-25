import { describe, expect, it } from 'vitest';

import {
  createResetRequestThrottle,
  InMemoryResetRequestThrottleStore,
  isWithinCooldown,
} from '@/lib/auth/reset-request-throttle';
import { fixedClock } from '@/lib/utils/clock';

const T0 = 1_800_000_000_000;

describe('isWithinCooldown', () => {
  it('is false when there is no prior request', () => {
    expect(isWithinCooldown(null, T0)).toBe(false);
  });

  it('is true immediately after a request', () => {
    expect(isWithinCooldown(T0, T0)).toBe(true);
  });

  it('is true just under the 60s window', () => {
    expect(isWithinCooldown(T0, T0 + 59_999)).toBe(true);
  });

  it('is false once the 60s window has elapsed', () => {
    expect(isWithinCooldown(T0, T0 + 60_000)).toBe(false);
  });
});

describe('createResetRequestThrottle', () => {
  function harness(startMs = T0) {
    const store = new InMemoryResetRequestThrottleStore();
    const clock = fixedClock(startMs);
    const throttle = createResetRequestThrottle({
      store,
      clock,
      hashEmail: (email) => `hash:${email.toLowerCase()}`,
    });
    return { store, clock, throttle };
  }

  it('allows the first request for an address and records it', async () => {
    const { throttle, store } = harness();
    expect(await throttle.shouldSend('founder@terranext.in')).toBe(true);
    expect(store.requests.get('hash:founder@terranext.in')).toBe(T0);
  });

  it('blocks a repeat request within the cooldown window', async () => {
    const { throttle, clock } = harness();
    await throttle.shouldSend('founder@terranext.in');
    clock.advance(30_000);
    expect(await throttle.shouldSend('founder@terranext.in')).toBe(false);
  });

  it('allows a new request once the cooldown has elapsed', async () => {
    const { throttle, clock } = harness();
    await throttle.shouldSend('founder@terranext.in');
    clock.advance(60_000);
    expect(await throttle.shouldSend('founder@terranext.in')).toBe(true);
  });

  it('tracks different addresses independently', async () => {
    const { throttle } = harness();
    expect(await throttle.shouldSend('a@terranext.in')).toBe(true);
    expect(await throttle.shouldSend('b@terranext.in')).toBe(true);
  });
});
