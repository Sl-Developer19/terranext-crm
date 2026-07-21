import type { ParticipantStatus } from './schema';

/**
 * Pure participant rules (Doc 09 §5.3 style — no I/O, testable in isolation).
 * Everything here is shared by the repository, actions, and UI so the same
 * definition can't drift between the write path and the read path.
 */

/** Firestore `array-contains` caps a term at the token length we generate. */
export const MAX_SEARCH_TERM_LENGTH = 20;

/** Prefix tokens shorter than this are too noisy to be worth indexing. */
const MIN_TOKEN_LENGTH = 2;

/**
 * Lowercase prefix tokens for name + phone (Doc 03 §1.4 `searchTokens`,
 * Doc 14 §11 "server-maintained"). Prefix-token search is the acknowledged
 * phase-1 ceiling (RR-10: Algolia/Typesense is the budgeted upgrade) — it
 * answers "starts with", never "contains" or fuzzy.
 *
 * Every whitespace-separated name part is tokenized independently so
 * "Priya Sharma" is findable by both "pri" and "sha". Phone tokens use the
 * trailing digits, which is how staff actually search ("…the one ending 4821").
 */
export function buildSearchTokens(fullName: string, phone: string): string[] {
  const tokens = new Set<string>();

  for (const part of fullName.toLowerCase().split(/\s+/).filter(Boolean)) {
    const capped = part.slice(0, MAX_SEARCH_TERM_LENGTH);
    for (let i = MIN_TOKEN_LENGTH; i <= capped.length; i += 1) {
      tokens.add(capped.slice(0, i));
    }
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    // Suffixes, not prefixes: the leading digits are country/operator codes
    // shared by everyone, so they'd match the whole directory.
    for (let i = 4; i <= Math.min(digits.length, 10); i += 1) {
      tokens.add(digits.slice(-i));
    }
  }

  return [...tokens];
}

/** Normalizes a user's search box input into a token comparable to the index. */
export function normalizeSearchTerm(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const digits = trimmed.replace(/\D/g, '');
  // A mostly-numeric query is a phone search; match the suffix tokens.
  if (digits.length >= 4 && digits.length >= trimmed.length - 3) {
    return digits.slice(-Math.min(digits.length, 10));
  }
  return trimmed.slice(0, MAX_SEARCH_TERM_LENGTH);
}

/**
 * Participant ID from the `counters/participantId` sequence
 * (Doc 14 §3, pattern `TNX-YYYY-NNNNN`). Format lives here so the counter
 * transaction and any future backfill produce byte-identical IDs.
 */
export function formatParticipantId(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * `alumni` is set by the BR-05 certification trigger, never by a human
 * picking it from a dropdown — allowing it here would let staff fabricate
 * alumni status without a certificate behind it.
 */
export function isManuallyAssignableStatus(status: ParticipantStatus): boolean {
  return status !== 'alumni';
}

/**
 * Statuses that end the active lifecycle. Used to decide whether a status
 * change should also clear `currentEnrolmentId`.
 */
export function isTerminalStatus(status: ParticipantStatus): boolean {
  return status === 'completed' || status === 'dropped';
}

/** A status change to a terminal state must carry a reason (audit `context.reason`). */
export function requiresStatusReason(next: ParticipantStatus): boolean {
  return next === 'dropped';
}

/**
 * The participant status implied by adding an enrolment, or null to leave it
 * alone. Adding an enrolment activates a participant — including re-enrolment
 * after `completed`/`dropped` (BR-01/FR-03.3: re-enrolment is a new enrolment
 * on the same lifetime record). `alumni` is the exception: it is a permanent
 * BR-05 designation earned by certification, so re-enrolling never strips it.
 */
export function statusAfterEnrolment(current: ParticipantStatus): ParticipantStatus | null {
  if (current === 'alumni' || current === 'active') return null;
  return 'active';
}

/**
 * Storage path for a participant document (Doc 10 §4 bucket layout).
 * The metadata doc id is part of the path — that coupling is what lets the
 * upload confirmation verify object ↔ document without trusting the client.
 */
export function documentStoragePath(participantId: string, documentId: string): string {
  return `participants/${participantId}/${documentId}`;
}
