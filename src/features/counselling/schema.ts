import { z } from 'zod';

/**
 * Counselling sessions (Doc 03 §1.3, Doc 14 §9, S12, BR-02).
 *
 * BR-02 is the reason this collection exists: a lead cannot become a
 * participant without a recorded session whose outcome is `recommended` and
 * which names the programme recommended. The shape rule — `recommended`
 * requires a non-null recommendation — is enforced here, in the server action,
 * and in Firestore rules, because it is the evidence an admission rests on.
 */

export const SESSION_MODES = ['in_person', 'phone', 'video'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_OUTCOMES = ['recommended', 'not_suitable', 'follow_up'] as const;
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  in_person: 'In person',
  phone: 'Phone',
  video: 'Video',
};

export const SESSION_OUTCOME_LABELS: Record<SessionOutcome, string> = {
  recommended: 'Recommended',
  not_suitable: 'Not suitable',
  follow_up: 'Follow-up needed',
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined));

export const recordSessionSchema = z
  .object({
    leadId: z.string().min(1, 'Select a lead'),
    heldAt: z.string().min(1, 'When was the session held?'),
    mode: z.enum(SESSION_MODES),
    outcome: z.enum(SESSION_OUTCOMES),
    notes: z
      .string()
      .trim()
      .min(10, 'Record what was discussed (at least 10 characters)')
      .max(4000),
    needsAssessment: optionalText(2000),
    recommendedProgrammeId: optionalText(120),
    recommendationRemarks: optionalText(2000),
  })
  .strict()
  .superRefine((value, ctx) => {
    // BR-02 shape rule. Without this, an admission could rest on a session
    // that recommended nothing in particular.
    if (value.outcome === 'recommended' && !value.recommendedProgrammeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recommendedProgrammeId'],
        message: 'A recommended outcome must name the programme being recommended (BR-02)',
      });
    }
  });
export type RecordSessionInput = z.infer<typeof recordSessionSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface CounsellingSession {
  id: string;
  leadId: string;
  leadName: string;
  consultantUid: string;
  consultantName: string;
  heldAt: string;
  mode: SessionMode;
  notes: string;
  needsAssessment: string | null;
  recommendation: { programmeId: string; programmeName: string; remarks: string | null } | null;
  outcome: SessionOutcome;
  createdAt: string;
}

export interface CounsellingLeadOption {
  id: string;
  name: string;
  stage: string;
}
