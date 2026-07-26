import type { StatusKind } from '@/components/ui/badge';

import type { LeadershipLevel, PartnerStatus } from './schema';

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

export const LEADERSHIP_LEVEL_LABELS: Record<LeadershipLevel, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};
