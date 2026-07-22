import 'server-only';

import { timingSafeEqual } from 'node:crypto';

/**
 * Shared-secret authorisation for scheduled jobs.
 *
 * Cloud Scheduler calls these endpoints over the public internet, so they
 * need an authenticator that is not a user session. A bearer secret in
 * `JOBS_SECRET` is the simplest thing that works with Scheduler's OIDC-free
 * HTTP target; comparison is constant-time so the endpoint cannot be used as
 * an oracle to recover the secret byte by byte.
 *
 * When the secret is unset the job endpoints refuse everything rather than
 * running open — an unauthenticated endpoint that mutates the queue is worse
 * than a scheduled job that does not run.
 */
export function isAuthorisedJobRequest(authorisationHeader: string | null): boolean {
  const expected = process.env.JOBS_SECRET;
  if (!expected) return false;

  const presented = authorisationHeader?.replace(/^Bearer\s+/i, '') ?? '';
  if (presented.length === 0) return false;

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
