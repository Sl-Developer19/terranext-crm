import { z } from 'zod';

import { LEAD_TYPES } from './schema';

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
  // Added for the website's finalized six-academy content: Faculty
  // Development and NextStep previously had no matching segment and fell
  // back to `general`; AI Career Accelerator was misrouted into
  // `trade_career` via a keyword match meant for Career & Global Placement.
  // Purely additive (no existing value renamed/removed), so this ships as
  // an in-place schema update rather than a versioned `/v2/createLead` path
  // — see the file-level comment on why breaking changes require the
  // versioned route instead.
  'faculty_development',
  'ai_career',
  'nextstep',
  'contact',
] as const;
export type FormType = (typeof FORM_TYPES)[number];

export const createPublicLeadSchema = z
  .object({
    formType: z.enum(FORM_TYPES),
    // Who the enquiry is on behalf of — required on every website enquiry
    // (General Enquiry form requirement), independent of `formType`.
    leadType: z.enum(LEAD_TYPES, {
      errorMap: () => ({ message: 'Select who this enquiry is for' }),
    }),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(E164),
    email: z.string().trim().email().nullable().default(null),
    programmeInterestSlug: z.string().trim().max(120).nullable().default(null),
    message: z.string().trim().max(1000).optional(),
    // Which website page the visitor was on when they submitted (e.g.
    // "/academies/nextgen-transformation") — a path only, never a full URL
    // with query string, so it can't leak UTM/referral params twice over.
    sourcePage: z.string().trim().max(200).optional(),
    // TCGN QR Referral System (Feature 6) — the human-readable code
    // ("TCGN-000001") carried through from `/r/{code}` via the website's
    // `?ref=` param. Deliberately loose validation here: an unresolvable or
    // inactive code is a normal, expected case (BR-07 — never blocks the
    // enquiry), resolved at write time in `create-public-lead.ts`, not here.
    referralCode: z.string().trim().max(40).optional(),
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
