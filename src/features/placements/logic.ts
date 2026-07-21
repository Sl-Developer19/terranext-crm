import type { EligibilityState } from '@/features/career/schema';

import { PLACEMENT_STAGE_ORDER, type PlacementStatus } from './schema';

/**
 * Pure placements-pipeline rules (no I/O).
 *
 * BR-09: a placement can only be opened for a career profile the placement
 * officer has explicitly marked eligible — never inferred from readiness
 * score or resume status.
 */
export function canCreatePlacement(eligibility: EligibilityState): boolean {
  return eligibility === 'eligible';
}

export function isTerminalStatus(status: PlacementStatus): boolean {
  return status === 'placed' || status === 'dropped';
}

/**
 * `dropped` is reachable from any non-terminal stage (an exit, not a rung on
 * the ladder); everything else must move strictly forward through
 * `PLACEMENT_STAGE_ORDER` — no skipping backward, and no re-opening a
 * terminal placement.
 */
export function isValidTransition(from: PlacementStatus, to: PlacementStatus): boolean {
  if (isTerminalStatus(from)) return false;
  if (to === from) return false;
  if (to === 'dropped') return true;

  const fromIndex = PLACEMENT_STAGE_ORDER.indexOf(from as (typeof PLACEMENT_STAGE_ORDER)[number]);
  const toIndex = PLACEMENT_STAGE_ORDER.indexOf(to as (typeof PLACEMENT_STAGE_ORDER)[number]);
  return fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex;
}

/** BR-08: TerraNext charges no placement fee to the student — literally zero, always. */
export function feeDisclosure(thirdPartyNotes: string | null): {
  terranextFeePaise: 0;
  thirdPartyNotes: string | null;
} {
  return { terranextFeePaise: 0, thirdPartyNotes };
}

/** Per-status counts for the pipeline funnel summary. */
export function pipelineCounts(statuses: PlacementStatus[]): Record<PlacementStatus, number> {
  const counts = Object.fromEntries(
    [...PLACEMENT_STAGE_ORDER, 'dropped'].map((s) => [s, 0]),
  ) as Record<PlacementStatus, number>;
  for (const status of statuses) counts[status] += 1;
  return counts;
}
