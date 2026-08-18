import type { PartnerStatus } from './schema';

/**
 * Pure Growth Partner onboarding rules (Doc 25), no I/O — mirrors the split
 * used by every other feature (e.g. `features/leads/logic.ts`).
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
 * Human Partner ID from the `counters/growthPartnerId` sequence, pattern
 * `TGP-000001` — hand-copied from `community-partners/logic.ts`'s
 * `formatCommunityPartnerId`, same Rule-of-Three reasoning as the schema
 * (see that file's header comment): two partner kinds don't earn a shared
 * abstraction yet.
 */
export function formatGrowthPartnerId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

/**
 * The URL a Growth Partner's QR code encodes — always the CRM's own
 * `/r/{humanPartnerId}` redirect, same reasoning as
 * `community-partners/logic.ts`'s `buildReferralUrl`: the printed code
 * never needs reissuing if the website's own URL structure changes later.
 */
export function buildGrowthPartnerReferralUrl(crmOrigin: string, humanPartnerId: string): string {
  return `${crmOrigin.replace(/\/$/, '')}/r/${encodeURIComponent(humanPartnerId)}`;
}
