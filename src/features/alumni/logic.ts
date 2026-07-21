import type { AlumniRecord } from './schema';

/** Pure alumni-registry rules (no I/O). */

/** A simple, display-only engagement total — not a business metric with its own name. */
export function totalEngagement(engagement: AlumniRecord['engagement']): number {
  return engagement.referrals + engagement.eventsAttended;
}

export function consentLabel(consent: boolean): string {
  return consent ? 'Consent given' : 'No consent';
}
