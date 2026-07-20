import type { StaffRole } from '@/types/common';

import type { LeadStage } from './schema';

/**
 * Pure lead-management rules (Doc 10 §2 row-level scope), no I/O — testable
 * in isolation and shared across queries.ts and every mutating action so
 * the scope check can't drift between read and write paths.
 */

/** True when the given role/assignment combination is denied by the
 * consultant↔assigned-lead row scope (ops_manager/founder are never scoped). */
export function isLeadRowScoped(
  role: StaffRole,
  assignedToUid: string | null,
  sessionUid: string,
): boolean {
  return role === 'consultant' && assignedToUid !== sessionUid;
}

/** A stage update only counts as a transition (and gets an activity entry)
 * when a new stage was actually requested and it differs from the current one. */
export function isStageTransition(
  previousStage: LeadStage,
  requestedStage: LeadStage | undefined,
): requestedStage is LeadStage {
  return requestedStage !== undefined && requestedStage !== previousStage;
}
