import type { Clock } from '@/lib/utils/clock';

/**
 * Silent per-address cooldown for password-reset requests (Doc 10 §1
 * extension). Deliberately not the `LoginProtection` lockout ladder: that
 * ledger counts *failed logins*, and piggybacking reset requests onto it
 * would let someone lock a real account out of signing in just by mashing
 * "forgot password". This is a flat cooldown on its own collection instead.
 *
 * A request inside the cooldown window still gets the same generic response
 * (enumeration resistance) — it just doesn't generate another email, so the
 * endpoint can't be used to mail-bomb an inbox.
 */

const RESET_REQUEST_COOLDOWN_MS = 60_000;

/** Pure — no I/O, no wall clock (Doc 10 §1 testing convention). */
export function isWithinCooldown(lastRequestedAtMs: number | null, nowMs: number): boolean {
  return lastRequestedAtMs !== null && nowMs - lastRequestedAtMs < RESET_REQUEST_COOLDOWN_MS;
}

export interface ResetRequestThrottle {
  /** True when a reset email should actually be generated/sent for this address. */
  shouldSend(email: string): Promise<boolean>;
}

export interface ResetRequestThrottleStore {
  read(emailHash: string): Promise<{ lastRequestedAt: number } | null>;
  recordRequest(emailHash: string, atMs: number): Promise<void>;
}

export function createResetRequestThrottle(deps: {
  store: ResetRequestThrottleStore;
  clock: Clock;
  hashEmail: (email: string) => string;
}): ResetRequestThrottle {
  return {
    async shouldSend(email) {
      const emailHash = deps.hashEmail(email);
      const state = await deps.store.read(emailHash);
      const nowMs = deps.clock.now();
      if (isWithinCooldown(state?.lastRequestedAt ?? null, nowMs)) return false;
      await deps.store.recordRequest(emailHash, nowMs);
      return true;
    },
  };
}

/** Deterministic store for unit tests. */
export class InMemoryResetRequestThrottleStore implements ResetRequestThrottleStore {
  readonly requests = new Map<string, number>();

  read(emailHash: string): Promise<{ lastRequestedAt: number } | null> {
    const at = this.requests.get(emailHash);
    return Promise.resolve(at === undefined ? null : { lastRequestedAt: at });
  }

  recordRequest(emailHash: string, atMs: number): Promise<void> {
    this.requests.set(emailHash, atMs);
    return Promise.resolve();
  }
}
