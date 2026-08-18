import { z } from 'zod';

import { BUSINESS_CATEGORIES } from './schema';

/**
 * Public website intake contract for Community Partner registration
 * (TerraNext Community Growth Network — TCGN), mirrors
 * `growth-partners/public-schema.ts` exactly.
 *
 * Registering here only ever creates a `pending_approval` candidate record —
 * it never mints a Firebase Auth account or login, so this does not reopen
 * the "no self-signup path" decision (that happens only at staff approval,
 * `decideCommunityPartner`). Both this path and staff entry write the same
 * `communityPartners` shape.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export const registerPublicCommunityPartnerSchema = z
  .object({
    orgName: z.string().trim().min(2, "Enter the business's name").max(160),
    businessCategory: z.enum(BUSINESS_CATEGORIES, {
      errorMap: () => ({ message: 'Select a business category' }),
    }),
    contactName: z.string().trim().min(2, "Enter the contact person's name").max(120),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    // Same role as `leads/public-schema.ts`'s `message`: everything the
    // contract has no dedicated column for (how they heard about TCGN,
    // outlet locations, …) travels here so the approver has it, rather
    // than the website silently discarding it at intake.
    applicationNotes: z.string().trim().max(1000).optional(),
    // Honeypot. Non-empty means the submission is silently dropped — answering
    // with a normal-looking success denies a bot any signal about what it tripped.
    hp_field: z.string().max(0).optional(),
  })
  .strict();

export type RegisterPublicCommunityPartnerInput = z.infer<
  typeof registerPublicCommunityPartnerSchema
>;

export interface RegisterPublicCommunityPartnerResult {
  id: string;
}

/** Rate limits, same order of magnitude as growth-partners' public intake. */
export const PARTNER_RATE_LIMITS = {
  perEmailPerDay: 3,
  perIpPerHour: 10,
} as const;
