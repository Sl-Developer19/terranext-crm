import type { ParentConversionStatus, ParentSession, ParentSessionOutcome } from './schema';

/**
 * Pure parent/family rules (no I/O).
 *
 * Parent conversion deliberately mirrors BR-02's shape for participants: a
 * conversion requires a counselling session that actually recommended
 * something. Parents are counselled before being sold to, not instead of.
 */

/** Conversion states ranked so a household's overall state is the furthest any parent reached. */
const CONVERSION_RANK: Record<ParentConversionStatus, number> = {
  not_converted: 0,
  lead_created: 1,
  enrolled: 2,
};

export function highestConversionStatus(
  statuses: readonly ParentConversionStatus[],
): ParentConversionStatus {
  return statuses.reduce<ParentConversionStatus>(
    (best, status) => (CONVERSION_RANK[status] > CONVERSION_RANK[best] ? status : best),
    'not_converted',
  );
}

/**
 * A parent may be converted to a lead only after a counselling session
 * recorded a `recommended` outcome with an actual programme attached.
 *
 * Without this, "Parent Conversion" degrades into creating leads for every
 * parent who ever answered the phone — which is how a follow-up queue
 * becomes noise nobody works.
 */
export function canConvertParent(
  parentSessions: readonly Pick<ParentSession, 'outcome' | 'recommendedProgrammeId'>[],
): boolean {
  return parentSessions.some(
    (session) => session.outcome === 'recommended' && session.recommendedProgrammeId !== null,
  );
}

/** Human-readable reason a conversion is blocked, for the UI to show verbatim. */
export function conversionBlocker(
  parentSessions: readonly Pick<ParentSession, 'outcome' | 'recommendedProgrammeId'>[],
): string | null {
  if (canConvertParent(parentSessions)) return null;
  if (parentSessions.length === 0) {
    return 'No counselling session has been recorded for this parent yet.';
  }
  return 'No counselling session has recommended a programme for this parent yet.';
}

/**
 * The programme most recently recommended to a parent — seeds the lead's
 * programme interest so the consultant does not retype it.
 */
export function latestRecommendedProgramme(
  parentSessions: readonly Pick<ParentSession, 'outcome' | 'recommendedProgrammeId' | 'heldAt'>[],
): string | null {
  const recommended = parentSessions
    .filter((s) => s.outcome === 'recommended' && s.recommendedProgrammeId)
    .sort((a, b) => b.heldAt.localeCompare(a.heldAt));
  return recommended[0]?.recommendedProgrammeId ?? null;
}

/** Outcomes that keep a parent in the active follow-up pipeline. */
export function isActiveOutcome(outcome: ParentSessionOutcome): boolean {
  return outcome === 'recommended' || outcome === 'follow_up';
}

/**
 * Parent-conversion rate for the Parent Conversion Report (module 5).
 * Whole percentage; zero households is 0%, not a division by zero.
 */
export function conversionRate(converted: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((converted / total) * 100);
}

/** Search tokens for family lookup — same prefix strategy as participants. */
export function buildFamilySearchTokens(
  familyName: string,
  contactName: string,
  phone: string,
): string[] {
  const tokens = new Set<string>();
  for (const part of `${familyName} ${contactName}`.toLowerCase().split(/\s+/).filter(Boolean)) {
    const capped = part.slice(0, 20);
    for (let i = 2; i <= capped.length; i += 1) tokens.add(capped.slice(0, i));
  }
  const digits = phone.replace(/\D/g, '');
  // Phone suffixes, not prefixes — the country code is shared by everyone.
  for (let i = 4; i <= Math.min(digits.length, 10); i += 1) tokens.add(digits.slice(-i));
  return [...tokens];
}
