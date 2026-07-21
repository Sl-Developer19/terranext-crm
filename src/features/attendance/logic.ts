import type { StaffRole } from '@/types/common';

import type { AttendanceStatus } from './schema';

/**
 * Pure attendance rules (no I/O).
 *
 * The percentage defined here is the number BR-03 certificate eligibility is
 * later checked against, so it has exactly one definition — and it is
 * recomputed from raw attendance documents rather than incremented, which is
 * what makes the roll-up self-healing (Doc 19 §3, condition C-2).
 */

/** Statuses that count as the participant having attended. */
const ATTENDED: ReadonlySet<AttendanceStatus> = new Set(['present', 'late']);

/**
 * Statuses that count toward the denominator. `excused` is deliberately
 * excluded from BOTH numerator and denominator: an excused absence should
 * neither reward nor penalise a participant's percentage.
 */
const COUNTED: ReadonlySet<AttendanceStatus> = new Set(['present', 'late', 'absent']);

export function countsAsAttended(status: AttendanceStatus): boolean {
  return ATTENDED.has(status);
}

export function countsTowardTotal(status: AttendanceStatus): boolean {
  return COUNTED.has(status);
}

/**
 * Attendance percentage from a full set of marks — a whole number 0–100.
 *
 * Full recompute, never incremental: a replayed or re-fired write produces
 * the same answer, and a corrected mark heals the percentage automatically.
 * Returns 0 when nothing countable has been marked yet, so an unmarked
 * enrolment never appears to have met a threshold it has not been measured
 * against.
 */
export function calculateAttendancePct(statuses: readonly AttendanceStatus[]): number {
  const counted = statuses.filter(countsTowardTotal);
  if (counted.length === 0) return 0;
  const attended = counted.filter(countsAsAttended).length;
  return Math.round((attended / counted.length) * 100);
}

/**
 * Trainer↔batch row-level scope (Doc 10 §2, Doc 18).
 *
 * A trainer may only mark attendance for batches they are assigned to.
 * Coordinators and ops manage attendance across all batches; every other
 * role has no attendance write grant at all, so this only ever narrows
 * an existing permission — it never widens one.
 */
export function isAttendanceWriteScoped(
  role: StaffRole,
  batchTrainerUid: string | null,
  sessionUid: string,
): boolean {
  return role === 'trainer' && batchTrainerUid !== sessionUid;
}

/** Marks below this are treated as an incomplete session in the summary. */
export function isSessionFullyMarked(marked: number, rosterSize: number): boolean {
  return rosterSize > 0 && marked >= rosterSize;
}
