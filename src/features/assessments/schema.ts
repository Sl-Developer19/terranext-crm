import { z } from 'zod';

/**
 * Assessments and scores (Doc 03 §1.5, Doc 14 §12). Together with attendance
 * these are the two raw inputs BR-03 certificate eligibility is recomputed
 * from at issuance (condition C-2).
 */

export const assessmentSchema = z
  .object({
    batchId: z.string().min(1, 'Select a batch'),
    name: z.string().trim().min(2, 'Assessment name is required').max(120),
    maxScore: z.number().int().positive('Maximum score must be greater than zero').max(1000),
    passScore: z.number().int().min(0, 'Pass score cannot be negative').max(1000),
    heldAt: z.string().min(1, 'Assessment date is required'),
  })
  .strict()
  .refine((value) => value.passScore <= value.maxScore, {
    // A pass mark above the maximum is unreachable — every participant would
    // fail regardless of performance.
    message: 'Pass score cannot exceed the maximum score',
    path: ['passScore'],
  });

export type AssessmentInput = z.infer<typeof assessmentSchema>;

export const updateAssessmentSchema = z
  .object({
    assessmentId: z.string().min(1),
    name: z.string().trim().min(2, 'Assessment name is required').max(120),
    maxScore: z.number().int().positive().max(1000),
    passScore: z.number().int().min(0).max(1000),
    heldAt: z.string().min(1, 'Assessment date is required'),
  })
  .strict()
  .refine((value) => value.passScore <= value.maxScore, {
    message: 'Pass score cannot exceed the maximum score',
    path: ['passScore'],
  });

export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

export const scoreEntrySchema = z
  .object({
    participantId: z.string().min(1),
    /** null clears a previously entered score (a mis-entry, not a zero). */
    score: z.number().int().min(0).max(1000).nullable(),
  })
  .strict();

export const enterScoresSchema = z
  .object({
    assessmentId: z.string().min(1),
    scores: z.array(scoreEntrySchema).min(1, 'Enter at least one score').max(500),
  })
  .strict();

export type EnterScoresInput = z.infer<typeof enterScoresSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface Assessment {
  id: string;
  batchId: string;
  batchCode: string | null;
  programmeId: string;
  name: string;
  maxScore: number;
  passScore: number;
  heldAt: string;
  /** Scores entered so far, for the list view's progress column. */
  scoredCount: number;
}

export interface ScoreRecord {
  participantId: string;
  score: number;
  result: 'pass' | 'fail';
  enteredBy: string;
  enteredAt: string;
}

/** One row of the score-entry grid: roster entry joined with any score. */
export interface ScoreRow {
  participantId: string;
  participantName: string;
  score: number | null;
  result: 'pass' | 'fail' | null;
}

export interface ParticipantScoreEntry {
  assessmentId: string;
  assessmentName: string;
  score: number;
  maxScore: number;
  result: 'pass' | 'fail';
  heldAt: string;
}
