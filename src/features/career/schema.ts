import { z } from 'zod';

/**
 * Career profiles (Doc 03 §1.6, BR-09). Doc ID = participant ID (1:1) —
 * a participant has at most one career interest record, not a history of
 * them, so re-capturing interest updates the same document.
 */

export const PASSPORT_STATUSES = ['none', 'applied', 'held'] as const;
export type PassportStatus = (typeof PASSPORT_STATUSES)[number];

export const RESUME_STATUSES = ['none', 'draft', 'reviewed', 'final'] as const;
export type ResumeStatus = (typeof RESUME_STATUSES)[number];

/**
 * BR-09: placement eligibility is selective and never automatic. There is
 * deliberately no formula that derives `eligible` from `readinessScore` —
 * a placement officer sets it explicitly, with a note, via `evaluateEligibility`.
 */
export const ELIGIBILITY_STATES = ['not_evaluated', 'not_eligible', 'eligible'] as const;
export type EligibilityState = (typeof ELIGIBILITY_STATES)[number];

const csvList = (max: number) =>
  z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(''))
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max),
    );

export const captureCareerInterestSchema = z
  .object({
    participantId: z.string().min(1),
    jobCategories: csvList(20),
    preferredCountries: csvList(20),
    passportStatus: z.enum(PASSPORT_STATUSES),
    willingToRelocate: z.boolean(),
    resumeStatus: z.enum(RESUME_STATUSES),
  })
  .strict();

/** Raw client input (job categories/countries as comma-separated text). */
export type CaptureCareerInterestInput = z.input<typeof captureCareerInterestSchema>;
/** Parsed shape the repository writes (comma-separated text split to arrays). */
export type CaptureCareerInterestParsed = z.output<typeof captureCareerInterestSchema>;

export const evaluateEligibilitySchema = z
  .object({
    participantId: z.string().min(1),
    eligibility: z.enum(['eligible', 'not_eligible']),
    eligibilityNote: z
      .string()
      .trim()
      .min(
        10,
        'A note of at least 10 characters is required — this is the counsellor recommendation',
      )
      .max(1000),
    readinessScore: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export type EvaluateEligibilityInput = z.infer<typeof evaluateEligibilitySchema>;

export const logGuidanceSessionSchema = z
  .object({
    participantId: z.string().min(1),
    heldAt: z.string().min(1, 'Session date is required'),
    notes: z.string().trim().min(1, 'Enter session notes').max(2000),
    recommendation: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .strict();

export type LogGuidanceSessionInput = z.infer<typeof logGuidanceSessionSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface CareerProfile {
  participantId: string;
  participantName: string | null;
  jobCategories: string[];
  preferredCountries: string[];
  passportStatus: PassportStatus;
  willingToRelocate: boolean;
  readinessScore: number | null;
  eligibility: EligibilityState;
  eligibilityNote: string | null;
  evaluatedBy: string | null;
  evaluatedAt: string | null;
  resumeStatus: ResumeStatus;
  updatedAt: string;
}

/** One row of the career interest directory. */
export interface CareerProfileListItem {
  participantId: string;
  participantName: string;
  jobCategories: string[];
  eligibility: EligibilityState;
  readinessScore: number | null;
  updatedAt: string;
}

export interface GuidanceSession {
  id: string;
  heldAt: string;
  notes: string;
  recommendation: string | null;
  officerUid: string;
  officerName: string | null;
}
