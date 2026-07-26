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

export type TimelineStepStatus = 'complete' | 'current' | 'pending';

export interface TimelineStep {
  id: string;
  label: string;
  status: TimelineStepStatus;
}

/**
 * Partner-facing lead status timeline (Doc 25 §5). Derived from the lead
 * and its downstream records — never a separately stored status, so it can
 * never drift from the pipeline it describes. Payment/reward status are
 * optional because those records don't exist until an admission and a
 * payment actually happen (slice 4 wires the real values in); a step with
 * no data yet is truthfully `pending`, not a placeholder.
 */
export function computeLeadTimeline(input: {
  stage: LeadStage;
  assignedToUid: string | null;
  participantId: string | null;
  paymentStatus?: 'none' | 'pending' | 'successful';
  rewardStatus?: 'none' | 'accrued' | 'paid';
}): TimelineStep[] {
  const { stage, assignedToUid, participantId } = input;
  const paymentStatus = input.paymentStatus ?? 'none';
  const rewardStatus = input.rewardStatus ?? 'none';

  const counsellingReached: LeadStage[] = [
    'counselling_booked',
    'counselling_attended',
    'hot',
    'admitted',
  ];
  const applicationReached: LeadStage[] = ['hot', 'admitted'];

  const flags = [
    true, // submitted
    assignedToUid !== null,
    counsellingReached.includes(stage),
    applicationReached.includes(stage),
    participantId !== null,
    paymentStatus === 'pending' || paymentStatus === 'successful',
    paymentStatus === 'successful',
    rewardStatus === 'accrued' || rewardStatus === 'paid',
    rewardStatus === 'paid',
  ];

  const labels = [
    'Lead submitted',
    'Assigned',
    'Counselling',
    'Application',
    'Admission',
    'Payment pending',
    'Payment successful',
    'Reward generated',
    'Reward paid',
  ];
  const ids = [
    'submitted',
    'assigned',
    'counselling',
    'application',
    'admission',
    'payment_pending',
    'payment_successful',
    'reward_generated',
    'reward_paid',
  ];

  const firstIncomplete = flags.findIndex((complete) => !complete);

  return labels.map((label, i) => ({
    id: ids[i]!,
    label,
    status: flags[i] ? 'complete' : i === firstIncomplete ? 'current' : 'pending',
  }));
}
