import type { StatusKind } from '@/components/ui/badge';

import type { DocumentKind, EnrolmentStatus, ParticipantStatus } from './schema';

/** Display labels + semantic badge kinds (Doc 07 §1: color is never the sole signal). */
export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  enrolled: 'Enrolled',
  active: 'Active',
  completed: 'Completed',
  dropped: 'Dropped',
  alumni: 'Alumni',
};

export const PARTICIPANT_STATUS_BADGE: Record<ParticipantStatus, StatusKind> = {
  enrolled: 'info',
  active: 'progress',
  completed: 'success',
  dropped: 'neutral',
  alumni: 'success',
};

export const ENROLMENT_STATUS_LABELS: Record<EnrolmentStatus, string> = {
  orientation: 'Orientation',
  in_progress: 'In progress',
  completed: 'Completed',
  dropped: 'Dropped',
};

export const ENROLMENT_STATUS_BADGE: Record<EnrolmentStatus, StatusKind> = {
  orientation: 'info',
  in_progress: 'progress',
  completed: 'success',
  dropped: 'neutral',
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  photo: 'Photo',
  id_proof: 'ID proof',
  resume: 'Resume',
  passport: 'Passport',
  other: 'Other',
};
