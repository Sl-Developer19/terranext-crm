import 'server-only';

import type { AuditEntityType } from '@/lib/audit/types';

import type { PartnerType } from './partner-session';

/**
 * Single source of truth for "which Firestore collection, audit entity type,
 * and feature name does a partner claim's `partnerType` map to" — consumed
 * by both `partner-login-runtime.ts` (login) and the `/api/partner-session`
 * route (logout). Before this file existed, both had their own independent
 * copy of this mapping; a future partner programme (Phase 3 — Corporate,
 * NGO, Campus Ambassador, …) is now one new row here, never a second edit
 * split across two unrelated files that could drift out of sync.
 */
export type PartnerCollection = 'growthPartners' | 'communityPartners';

export const PARTNER_COLLECTION_BY_TYPE: Record<PartnerType, PartnerCollection> = {
  individual: 'growthPartners',
  community_business: 'communityPartners',
};

/** Try-in-order list for an authUid lookup of unknown partner kind (login).
 * Individual Growth Partners resolve on the first entry, exactly as before
 * this file existed — zero added query cost for them. */
export const PARTNER_COLLECTIONS: readonly PartnerCollection[] = Object.values(
  PARTNER_COLLECTION_BY_TYPE,
);

export const PARTNER_AUDIT_ENTITY_TYPE: Record<PartnerCollection, AuditEntityType> = {
  growthPartners: 'growth_partner',
  communityPartners: 'community_partner',
};

export const PARTNER_FEATURE_NAME: Record<PartnerCollection, string> = {
  growthPartners: 'growth-partners',
  communityPartners: 'community-partners',
};
