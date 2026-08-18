import type { StatusKind } from '@/components/ui/badge';

import type { BusinessCategory, PartnerStatus } from './schema';

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

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  gym: 'Gym',
  beauty_salon: 'Beauty Salon',
  yoga_centre: 'Yoga Centre',
  dance_academy: 'Dance Academy',
  tuition_centre: 'Tuition Centre',
  hospital: 'Hospital',
  clinic: 'Clinic',
  cafe: 'Café',
  apartment_association: 'Apartment Association',
  ngo: 'NGO',
  corporate: 'Corporate Organisation',
  other: 'Other',
};
