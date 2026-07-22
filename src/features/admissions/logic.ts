import { br02Checklist, type CounsellingSession } from '@/features/counselling';

import type { AdmissionCandidate, DuplicateMatch } from './schema';

/** Pure admissions rules (no I/O). Re-checked server-side in every case. */

/** Stages that put a lead in the admissions queue (Doc 16 S13). */
export const ADMISSION_STAGES = ['hot', 'counselling_attended'] as const;

export function isAdmissionCandidate(stage: string): boolean {
  return (ADMISSION_STAGES as readonly string[]).includes(stage);
}

/**
 * BR-02 gate. Delegates to the counselling module rather than restating the
 * rule — one definition of "may this lead be converted", used by the queue,
 * the stepper, and the server action alike.
 */
export function canConvert(sessions: readonly CounsellingSession[]): boolean {
  return br02Checklist(sessions).satisfied;
}

/**
 * BR-01: a phone match means this person may already have a lifetime record.
 * This never blocks on its own — it surfaces the match so the operator either
 * links to the existing participant or consciously confirms a new one.
 */
export function hasBlockingDuplicate(
  duplicates: readonly DuplicateMatch[],
  acknowledged: boolean,
): boolean {
  return duplicates.length > 0 && !acknowledged;
}

/** Queue ordering: BR-02-ready first, then most recently touched. */
export function sortCandidates(candidates: readonly AdmissionCandidate[]): AdmissionCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.checklist.satisfied !== b.checklist.satisfied) return a.checklist.satisfied ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function readyCount(candidates: readonly AdmissionCandidate[]): number {
  return candidates.filter((candidate) => candidate.checklist.satisfied).length;
}
