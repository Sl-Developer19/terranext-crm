import { z } from 'zod';

/** Domain schemas for Growth Partner identity and onboarding (Doc 25, ADR-014). */

const E164 = /^\+[1-9]\d{7,14}$/;

export const PARTNER_STATUSES = ['pending_approval', 'active', 'suspended', 'rejected'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

/** Configurable recognition tiers shown on the partner dashboard (Doc 25). */
export const LEADERSHIP_LEVELS = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type LeadershipLevel = (typeof LEADERSHIP_LEVELS)[number];

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
  displayName: string;
  email: string;
  phone: string;
  organizationName: string | null;
  status: PartnerStatus;
  leadershipLevel: LeadershipLevel;
  authUid: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
