import type { SendOutcome } from '@/lib/messaging/types';

import type { CommStatus } from './schema';

/**
 * Pure dispatch decisions (no I/O). The worker's judgement calls live here so
 * they can be tested without a provider or Firestore.
 */

/** Give up after this many deferrals so a permanently broken address stops churning. */
export const MAX_ATTEMPTS = 5;

export interface DispatchDecision {
  status: CommStatus;
  /** Recorded on the doc so an operator can see why something is stuck. */
  failureReason: string | null;
  /** When the worker may pick it up again; null when it is finished either way. */
  nextAttemptAt: Date | null;
}

/**
 * Exponential backoff with a ceiling: 1, 2, 4, 8, 16 minutes. Retrying a
 * provider outage every minute turns our problem into their problem too.
 */
export function backoffMs(attempts: number): number {
  const minutes = Math.min(2 ** Math.max(attempts - 1, 0), 16);
  return minutes * 60_000;
}

export function decideNext(
  outcome: SendOutcome,
  attemptsSoFar: number,
  now: Date = new Date(),
): DispatchDecision {
  if (outcome.status === 'sent') {
    return { status: 'sent', failureReason: null, nextAttemptAt: null };
  }

  if (outcome.status === 'failed') {
    // A rejected address does not improve by being retried.
    return { status: 'failed', failureReason: outcome.reason, nextAttemptAt: null };
  }

  const attempts = attemptsSoFar + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return {
      status: 'failed',
      failureReason: `Giving up after ${attempts} attempts: ${outcome.reason}`,
      nextAttemptAt: null,
    };
  }

  return {
    status: 'queued',
    failureReason: outcome.reason,
    nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
  };
}

/** A message is due when it has never been tried or its backoff has elapsed. */
export function isDue(nextAttemptAt: Date | null, now: Date = new Date()): boolean {
  return nextAttemptAt === null || nextAttemptAt <= now;
}
