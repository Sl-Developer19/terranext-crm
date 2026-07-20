import type { StatusKind } from '@/components/ui/badge';

import type { LeadStage } from './schema';

/** Human-readable stage names + status-badge kind (Doc 07 §1 semantic color). */
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  counselling_booked: 'Counselling booked',
  counselling_attended: 'Counselling attended',
  hot: 'Hot',
  admitted: 'Admitted',
  lost: 'Lost',
  follow_up: 'Follow-up',
};

export const LEAD_STAGE_BADGE: Record<LeadStage, StatusKind> = {
  new: 'info',
  contacted: 'progress',
  counselling_booked: 'progress',
  counselling_attended: 'progress',
  hot: 'success',
  admitted: 'success',
  lost: 'neutral',
  follow_up: 'progress',
};
