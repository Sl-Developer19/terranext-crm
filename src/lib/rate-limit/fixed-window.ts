import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

/**
 * Firestore fixed-window rate limiter for unauthenticated endpoints.
 *
 * A fixed window (rather than a sliding one) is deliberate: it costs a single
 * transactional read-modify-write per request, and the worst case it permits —
 * a burst spanning a window boundary — is well within what these limits exist
 * to stop (scripted enquiry spam, not a determined DDoS, which belongs at the
 * CDN/App Check layer).
 *
 * Counters are self-expiring by key: the window start is part of the document
 * ID, so stale windows simply stop being read. A TTL policy on `expiresAt`
 * (configured in the Firebase console) reclaims the storage.
 */

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the current window closes — surfaced as `Retry-After`. */
  retryAfterSeconds: number;
  remaining: number;
}

function windowStart(now: Date, windowMs: number): number {
  return Math.floor(now.getTime() / windowMs) * windowMs;
}

/** Keys are hashed so a phone number never becomes a document ID in plaintext. */
function safeKey(scope: string, identifier: string, start: number): string {
  let hash = 0;
  for (let index = 0; index < identifier.length; index += 1) {
    hash = (hash << 5) - hash + identifier.charCodeAt(index);
    hash |= 0;
  }
  return `${scope}_${Math.abs(hash).toString(36)}_${start}`;
}

export async function consumeRateLimit(options: {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<RateLimitVerdict> {
  const now = options.now ?? new Date();
  const start = windowStart(now, options.windowMs);
  const ref = adminDb()
    .collection('rateLimits')
    .doc(safeKey(options.scope, options.identifier, start));

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((start + options.windowMs - now.getTime()) / 1000),
  );

  try {
    return await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const used = snap.exists ? ((snap.get('count') as number) ?? 0) : 0;

      if (used >= options.limit) {
        return { allowed: false, retryAfterSeconds, remaining: 0 };
      }

      tx.set(
        ref,
        {
          scope: options.scope,
          count: FieldValue.increment(1),
          windowStart: Timestamp.fromMillis(start),
          expiresAt: Timestamp.fromMillis(start + options.windowMs * 2),
        },
        { merge: true },
      );

      return {
        allowed: true,
        retryAfterSeconds,
        remaining: Math.max(options.limit - used - 1, 0),
      };
    });
  } catch {
    // Fail open. A rate limiter that takes the public enquiry form down when
    // Firestore hiccups loses real leads (BR-07: no enquiry is ever lost),
    // which is a worse outcome than briefly allowing extra submissions.
    return { allowed: true, retryAfterSeconds, remaining: options.limit };
  }
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
