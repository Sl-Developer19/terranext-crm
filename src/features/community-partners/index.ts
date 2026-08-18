/** Public API of the community-partners feature (Doc 02 §3, TCGN). */
export { CommunityPartnersTable } from './components/community-partners-table';
export { CommunityPartnerDetailView } from './components/community-partner-detail-view';
export { RegisterCommunityPartnerDialog } from './components/register-community-partner-dialog';
export { EditOwnProfileForm } from './components/edit-own-profile-form';
export { updateOwnCommunityProfile } from './actions/update-own-profile';
export {
  listCommunityPartners,
  getCommunityPartner,
  findCommunityPartnerByHumanId,
  findCommunityPartnerByAuthUid,
  listCommunityPartnerStatusHistory,
} from './queries';
export { canDecide, canToggleStatus, buildReferralUrl } from './logic';
export { recordCommunityPartnerScan } from './repository';
export {
  PARTNER_STATUS_LABELS,
  PARTNER_STATUS_BADGE,
  BUSINESS_CATEGORY_LABELS,
} from './status-labels';
export {
  PARTNER_STATUSES,
  BUSINESS_CATEGORIES,
  registerCommunityPartnerSchema,
  decideCommunityPartnerSchema,
  setCommunityPartnerStatusSchema,
  updateOwnCommunityProfileSchema,
  type CommunityPartner,
  type PartnerStatus,
  type BusinessCategory,
  type RegisterCommunityPartnerInput,
  type DecideCommunityPartnerInput,
  type SetCommunityPartnerStatusInput,
  type UpdateOwnCommunityProfileInput,
} from './schema';
