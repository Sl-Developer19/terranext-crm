import type { PartnerStatus } from './schema';

/**
 * Pure Community Partner onboarding rules (TCGN) — no I/O, mirrors the split
 * used by every other feature (e.g. `features/leads/logic.ts`). Identical
 * decision rules to `features/growth-partners/logic.ts` by design: approval
 * and suspend/reactivate semantics don't differ by partner kind, only the
 * identity data around them does.
 */

/** Only a pending-approval partner can be approved or rejected. */
export function canDecide(status: PartnerStatus): boolean {
  return status === 'pending_approval';
}

/** Suspend/reactivate only applies once a partner has actually been approved. */
export function canToggleStatus(status: PartnerStatus): boolean {
  return status === 'active' || status === 'suspended';
}

/**
 * Human Partner ID from the `counters/communityPartnerId` sequence, pattern
 * `TCGN-000001` — mirrors `participants/logic.ts`'s `formatParticipantId`.
 * Format lives here, separate from the counter transaction, so the
 * transaction and any future backfill/audit tooling produce byte-identical
 * IDs from the same (prefix, sequence) pair.
 */
export function formatCommunityPartnerId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

/**
 * The URL a Community Partner's QR code encodes — always the CRM's own
 * redirect endpoint (`/r/{humanPartnerId}`), never the public website
 * directly and never a Firestore document ID. Keeping the QR pointed at a
 * CRM-hosted redirect (rather than baking the website's URL into the
 * printed code) means the website's own URL structure can change later
 * without a single already-printed QR code needing to be reissued.
 */
export function buildReferralUrl(crmOrigin: string, humanPartnerId: string): string {
  return `${crmOrigin.replace(/\/$/, '')}/r/${encodeURIComponent(humanPartnerId)}`;
}
