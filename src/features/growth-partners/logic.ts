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
