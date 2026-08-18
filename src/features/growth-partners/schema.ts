import { z } from 'zod';

/** Domain schemas for Growth Partner identity and onboarding (Doc 25, ADR-014). */

const E164 = /^\+[1-9]\d{7,14}$/;

export const PARTNER_STATUSES = ['pending_approval', 'active', 'suspended', 'rejected'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const setGrowthPartnerLeadershipLevelSchema = z
  .object({
    partnerId: z.string().min(1),
    levelSlug: z.string().min(1),
  })
  .strict();

export type SetGrowthPartnerLeadershipLevelInput = z.infer<
  typeof setGrowthPartnerLeadershipLevelSchema
>;

export const registerGrowthPartnerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Enter the partner's name").max(120),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    organizationName: z.string().trim().max(160).optional().or(z.literal('')),
  })
  .strict();

export type RegisterGrowthPartnerInput = z.infer<typeof registerGrowthPartnerSchema>;

export const decideGrowthPartnerSchema = z
  .object({
    partnerId: z.string().min(1),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .strict();

export type DecideGrowthPartnerInput = z.infer<typeof decideGrowthPartnerSchema>;

export const updateOwnProfileSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Enter your name').max(120),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    organizationName: z.string().trim().max(160).optional().or(z.literal('')),
  })
  .strict();

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

export const setGrowthPartnerStatusSchema = z
  .object({
    partnerId: z.string().min(1),
    status: z.enum(['active', 'suspended']),
  })
  .strict();

export type SetGrowthPartnerStatusInput = z.infer<typeof setGrowthPartnerStatusSchema>;

export interface GrowthPartner {
  id: string;
  /** Print/QR-facing identifier, e.g. "TGP-000001" — minted at approval,
   * mirroring `CommunityPartner.humanPartnerId` exactly. Null until then. */
  humanPartnerId: string | null;
  displayName: string;
  email: string;
  phone: string;
  organizationName: string | null;
  /** Free-text background supplied at public registration (referral code,
   * experience, areas of interest, …) — context for the approval decision,
   * never structured data the app reads back. Null for staff-entered partners. */
  applicationNotes: string | null;
  status: PartnerStatus;
  /** A slug referencing a `leadershipLevels/{id}.slug` document (Settings §3)
   * — free text, not a fixed union, so an admin-defined level never requires
   * a code change. Not guaranteed to resolve (a level may have been renamed
   * since); consumers must handle an unresolvable slug gracefully. */
  leadershipLevel: string;
  /** QR redirect hits (`/r/{humanPartnerId}`) — same best-effort, top-of-
   * funnel metric as `CommunityPartner.scanCount`. Never gates anything. */
  scanCount: number;
  /** Distinct leads attributed to this partner via referral — same
   * transactional-increment semantics as `CommunityPartner.referralCount`. */
  referralCount: number;
  authUid: string | null;
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
