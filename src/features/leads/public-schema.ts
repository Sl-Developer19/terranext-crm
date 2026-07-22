import { z } from 'zod';

/**
 * Public website intake contract (Doc 20 §2, BR-07, FR-07).
 *
 * The website deploys independently (ADR-002), so this schema is a published
 * interface: breaking changes require a versioned path (`/v2/createLead`) and
 * a coordinated website release, never an edit in place.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export const FORM_TYPES = [
  'general',
  'genz',
  'family',
  'parent_session',
  'trade_career',
  'workshop',
  'campus_leader',
] as const;
export type FormType = (typeof FORM_TYPES)[number];

export const createPublicLeadSchema = z
  .object({
    formType: z.enum(FORM_TYPES),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(E164),
    email: z.string().trim().email().nullable().default(null),
    programmeInterestSlug: z.string().trim().max(120).nullable().default(null),
    message: z.string().trim().max(1000).optional(),
    utm: z
      .object({
        source: z.string().max(120),
        medium: z.string().max(120),
        campaign: z.string().max(120),
      })
      .partial()
      .optional(),
    // Consent is a hard requirement, not a preference: a lead with no
    // recorded consent cannot lawfully be contacted (Doc 10 §7).
    consent: z.object({ given: z.literal(true), textVersion: z.string().min(1).max(40) }),
    // Honeypot. Bots fill every field they find; humans never see this one.
    // Non-empty means the submission is silently dropped — answering with a
    // normal-looking success denies the bot any signal about what it tripped.
    hp_field: z.string().max(0).optional(),
  })
  .strict();

export type CreatePublicLeadInput = z.infer<typeof createPublicLeadSchema>;

export interface CreatePublicLeadResult {
  leadId: string;
  /** True when an existing lead on this phone was updated instead of a new one created. */
  dedup: boolean;
}

/** Rate limits from the contract (Doc 20 §2). */
export const RATE_LIMITS = {
  perPhonePerDay: 5,
  perIpPerHour: 20,
} as const;
