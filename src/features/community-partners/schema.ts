import { z } from 'zod';

/**
 * Domain schemas for Community Partner identity (TerraNext Community Growth
 * Network — TCGN). A Community Partner is a business/organisation referral
 * partner — a distinct bounded context from `features/growth-partners`
 * (individual ambassadors), per the approved architecture: separate identity
 * collection per partner programme, sharing the same referral/reward/wallet/
 * notification engine underneath (Doc 25's `leads.partnerId` mechanism,
 * unmodified). Structurally mirrors `growth-partners/schema.ts` deliberately —
 * hand-copied, not derived from a shared base (Rule of Three: not worth a
 * shared abstraction for two partner kinds).
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export const PARTNER_STATUSES = ['pending_approval', 'active', 'suspended', 'rejected'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

/** Business categories from the TCGN brief. */
export const BUSINESS_CATEGORIES = [
  'gym',
  'beauty_salon',
  'yoga_centre',
  'dance_academy',
  'tuition_centre',
  'hospital',
  'clinic',
  'cafe',
  'apartment_association',
  'ngo',
  'corporate',
  'other',
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

/** Staff-entered registration (ops/system admin registering a business directly). */
export const registerCommunityPartnerSchema = z
  .object({
    orgName: z.string().trim().min(2, "Enter the business's name").max(160),
    businessCategory: z.enum(BUSINESS_CATEGORIES, {
      errorMap: () => ({ message: 'Select a business category' }),
    }),
    contactName: z.string().trim().min(2, "Enter the contact person's name").max(120),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
  })
  .strict();

export type RegisterCommunityPartnerInput = z.infer<typeof registerCommunityPartnerSchema>;

export const decideCommunityPartnerSchema = z
  .object({
    partnerId: z.string().min(1),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .strict();

export type DecideCommunityPartnerInput = z.infer<typeof decideCommunityPartnerSchema>;

export const updateOwnCommunityProfileSchema = z
  .object({
    orgName: z.string().trim().min(2, "Enter the business's name").max(160),
    contactName: z.string().trim().min(2, "Enter the contact person's name").max(120),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
  })
  .strict();

export type UpdateOwnCommunityProfileInput = z.infer<typeof updateOwnCommunityProfileSchema>;

export const setCommunityPartnerStatusSchema = z
  .object({
    partnerId: z.string().min(1),
    status: z.enum(['active', 'suspended']),
  })
  .strict();

export type SetCommunityPartnerStatusInput = z.infer<typeof setCommunityPartnerStatusSchema>;

export interface CommunityPartner {
  id: string;
  /** Print/QR-facing identifier, e.g. "TCGN-000001" — minted at approval
   * (Human Partner ID Generation feature). Null until then. */
  humanPartnerId: string | null;
  orgName: string;
  businessCategory: BusinessCategory;
  contactName: string;
  email: string;
  phone: string;
  /** Free-text background supplied at public registration — same role as
   * `growth-partners`' `applicationNotes`, the approver's only view into
   * anything the strict intake contract has no column for. Null for
   * staff-entered partners. */
  applicationNotes: string | null;
  status: PartnerStatus;
  /** Firebase Auth uid, set once approved (Community Partner Login feature). */
  authUid: string | null;
  /** QR redirect hits (`/r/{humanPartnerId}`) — top-of-funnel visibility,
   * incremented best-effort on every scan regardless of whether it later
   * becomes an enquiry. Never gates or blocks anything. */
  scanCount: number;
  /** Distinct leads attributed to this partner — incremented transactionally,
   * in the same write as the lead that earned it, only when the referral
   * resolves to an *active* partner (never on a dedup/repeat submission). */
  referralCount: number;
  approvedAt: string | null;
  approvedBy: string | null;
  /** Welcome-email delivery metadata from the approval step. Approval never
   * rolls back on a failed send, so these exist to make a failure visible
   * and diagnosable after the fact rather than only in server logs. */
  emailSent: boolean;
  emailSentAt: string | null;
  emailStatus: 'sent' | 'failed' | 'skipped' | null;
  emailError: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
