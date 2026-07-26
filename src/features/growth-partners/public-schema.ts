import { z } from 'zod';

/**
 * Public website intake contract for Growth Partner registration (Doc 25 §4
 * step 1, mirrors `leads/public-schema.ts`).
 *
 * Registering here only ever creates a `pending_approval` candidate record —
 * it never mints a Firebase Auth account or login, so this does not reopen
 * the "no self-signup path" decision in `registerGrowthPartner` (that action
 * stays the staff-entry path; this one is the public application path). Both
 * write the same shape into `growthPartners`.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export const registerPublicGrowthPartnerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Enter the partner's name").max(120),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    organizationName: z.string().trim().max(160).optional().or(z.literal('')),
    // Honeypot. Non-empty means the submission is silently dropped — answering
    // with a normal-looking success denies a bot any signal about what it tripped.
    hp_field: z.string().max(0).optional(),
  })
  .strict();

export type RegisterPublicGrowthPartnerInput = z.infer<typeof registerPublicGrowthPartnerSchema>;

export interface RegisterPublicGrowthPartnerResult {
  id: string;
}

/** Rate limits, same order of magnitude as the lead intake limits. */
export const PARTNER_RATE_LIMITS = {
  perEmailPerDay: 3,
  perIpPerHour: 10,
} as const;
