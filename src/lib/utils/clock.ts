/**
 * Injected time source (approved amendment 5): business and policy code never
 * calls `Date.now()` directly, so every time-dependent test is deterministic.
 */
export interface Clock {
  /** Current time as epoch milliseconds. */
  now(): number;
}

/** The one sanctioned `Date.now()` call site. */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/** Test/replay clock — advance manually. */
export function fixedClock(startMs: number): Clock & { advance(ms: number): void } {
  let current = startMs;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}
