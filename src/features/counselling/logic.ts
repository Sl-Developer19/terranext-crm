import type { StatusKind } from '@/components/ui/badge';

import type { CounsellingSession, SessionOutcome } from './schema';

/** Pure counselling rules (no I/O). BR-02 lives here and is re-checked server-side. */

export function outcomeTone(outcome: SessionOutcome): StatusKind {
  return outcome === 'recommended' ? 'success' : outcome === 'follow_up' ? 'progress' : 'neutral';
}

/**
 * BR-02: the evidence an admission rests on. A lead is convertible only when
 * some session recommended them *and* named the programme — a bare
 * "recommended" with no programme is not a recommendation anyone can act on.
 */
export function recommendingSession(
  sessions: readonly CounsellingSession[],
): CounsellingSession | null {
  // Most recent first, so a later "not suitable" does not get overridden by
  // an older approval sitting further down the list.
  const ordered = [...sessions].sort((a, b) => b.heldAt.localeCompare(a.heldAt));
  const latest = ordered[0];
  if (!latest) return null;
  if (latest.outcome !== 'recommended' || !latest.recommendation) return null;
  return latest;
}

export function canConvertLead(sessions: readonly CounsellingSession[]): boolean {
  return recommendingSession(sessions) !== null;
}

/** The per-lead BR-02 checklist the admissions queue renders (Doc 15). */
export interface Br02Checklist {
  hasSession: boolean;
  latestOutcomeRecommended: boolean;
  hasProgrammeRecommendation: boolean;
  satisfied: boolean;
  /** Why conversion is blocked, in the words the consultant needs to act on. */
  blocker: string | null;
}

export function br02Checklist(sessions: readonly CounsellingSession[]): Br02Checklist {
  const ordered = [...sessions].sort((a, b) => b.heldAt.localeCompare(a.heldAt));
  const latest = ordered[0];

  const hasSession = latest !== undefined;
  const latestOutcomeRecommended = latest?.outcome === 'recommended';
  const hasProgrammeRecommendation = Boolean(latest?.recommendation);
  const satisfied = hasSession && latestOutcomeRecommended && hasProgrammeRecommendation;

  let blocker: string | null = null;
  if (!hasSession) {
    blocker = 'No counselling session recorded yet (BR-02).';
  } else if (!latestOutcomeRecommended) {
    blocker = `The most recent session outcome is "${latest?.outcome ?? 'unknown'}", not "recommended" (BR-02).`;
  } else if (!hasProgrammeRecommendation) {
    blocker = 'The recommending session does not name a programme (BR-02).';
  }

  return {
    hasSession,
    latestOutcomeRecommended,
    hasProgrammeRecommendation,
    satisfied,
    blocker,
  };
}

/** Sessions split for the S12 upcoming/held tabs. */
export function partitionByHeld(
  sessions: readonly CounsellingSession[],
  now: Date = new Date(),
): { upcoming: CounsellingSession[]; held: CounsellingSession[] } {
  const nowIso = now.toISOString();
  const upcoming = sessions
    .filter((s) => s.heldAt > nowIso)
    .sort((a, b) => a.heldAt.localeCompare(b.heldAt));
  const held = sessions
    .filter((s) => s.heldAt <= nowIso)
    .sort((a, b) => b.heldAt.localeCompare(a.heldAt));
  return { upcoming, held };
}
