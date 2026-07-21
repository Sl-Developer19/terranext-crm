import type { EligibilityState } from './schema';

/**
 * Pure career-profile rules (no I/O).
 *
 * BR-09: placement eligibility is selective and never automatic — there is
 * no function here that derives `eligible` from `readinessScore` or resume
 * status. A human sets eligibility explicitly; this module only enforces
 * the shape of that decision (a note is mandatory) and reads it back.
 */

/** A profile can be placed only once a placement officer has marked it eligible. */
export function isPlacementEligible(eligibility: EligibilityState): boolean {
  return eligibility === 'eligible';
}

/** Eligibility can be (re-)evaluated at any time — there is no locked terminal state. */
export function canEvaluate(_current: EligibilityState): boolean {
  return true;
}

/** Whole-percentage career-interest → eligible conversion, for the Placement Pipeline Report. */
export function eligibilityRate(eligibleCount: number, evaluatedCount: number): number | null {
  if (evaluatedCount <= 0) return null;
  return Math.round((eligibleCount / evaluatedCount) * 100);
}
