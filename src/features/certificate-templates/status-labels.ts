import type { StatusKind } from '@/components/ui/badge';

import type { TemplateVersionStatus } from './schema';

export const VERSION_STATUS_LABELS: Record<TemplateVersionStatus, string> = {
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
  active: 'Active',
  archived: 'Archived',
};

export const VERSION_STATUS_KIND: Record<TemplateVersionStatus, StatusKind> = {
  draft: 'neutral',
  review: 'info',
  approved: 'progress',
  active: 'success',
  archived: 'danger',
};
