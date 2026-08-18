import type { StatusKind } from '@/components/ui/badge';

import type { PartnerStatus } from './schema';

/** Human-readable status names + status-badge kind (Doc 07 §1 semantic color). */
export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  pending_approval: 'Pending approval',
  active: 'Active',
  suspended: 'Suspended',
  rejected: 'Rejected',
};

export const PARTNER_STATUS_BADGE: Record<PartnerStatus, StatusKind> = {
  pending_approval: 'progress',
  active: 'success',
  suspended: 'danger',
  rejected: 'neutral',
};

// Leadership level labels are no longer a fixed map here — they're admin
// data in the `leadershipLevels` collection (Settings §3, see
// `features/leadership-levels`). Consumers resolve a partner's level via
// `findLeadershipLevelBySlug(partner.leadershipLevel)` instead of a lookup
// table, so a renamed/added tier never needs a code change.
