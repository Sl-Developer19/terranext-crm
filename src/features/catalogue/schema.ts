import { z } from 'zod';

/**
 * Academy + programme catalogue (Doc 03 §1.2, Doc 14 §5–6, S22).
 * `certificateRules` per programme is what makes BR-03 configurable rather
 * than hardcoded; `feePlanDefault` seeds fee accounts at conversion (M7).
 */

export const CATALOGUE_STATUSES = ['active', 'archived'] as const;
export type CatalogueStatus = (typeof CATALOGUE_STATUSES)[number];

/** Money is integer paise everywhere (ADR-012) — never floats. */
const paise = z.number().int().min(0, 'Amount cannot be negative');

const slug = z
  .string()
  .trim()
  .min(2, 'Slug is required')
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only');

export const academySchema = z
  .object({
    name: z.string().trim().min(2, 'Academy name is required').max(120),
    slug,
    description: z.string().trim().max(600).optional().or(z.literal('')),
  })
  .strict();

export type AcademyInput = z.infer<typeof academySchema>;

export const updateAcademySchema = academySchema.extend({ academyId: z.string().min(1) }).strict();
export type UpdateAcademyInput = z.infer<typeof updateAcademySchema>;

export const installmentSchema = z
  .object({
    label: z.string().trim().min(1, 'Installment label is required').max(60),
    amountPaise: paise,
    dueOffsetDays: z.number().int().min(0, 'Offset cannot be negative').max(3650),
  })
  .strict();

export type InstallmentInput = z.infer<typeof installmentSchema>;

export const programmeSchema = z
  .object({
    academyId: z.string().min(1, 'Select an academy'),
    name: z.string().trim().min(2, 'Programme name is required').max(120),
    code: z
      .string()
      .trim()
      .min(2, 'Programme code is required')
      .max(20)
      .regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers, and hyphens only'),
    durationDays: z.number().int().positive('Duration must be at least one day').max(3650),
    sessionCount: z.number().int().positive('There must be at least one session').max(1000),
    eligibility: z.string().trim().max(600).optional().or(z.literal('')),
    curriculumSummary: z.string().trim().max(2000).optional().or(z.literal('')),
    /** BR-03 thresholds — the certificate gate, configurable per programme. */
    minAttendancePct: z.number().int().min(0).max(100),
    minAssessmentScore: z.number().int().min(0).max(100),
    totalFeePaise: paise,
    installments: z.array(installmentSchema).max(12, 'At most 12 installments'),
  })
  .strict()
  .refine(
    (value) =>
      value.installments.length === 0 ||
      value.installments.reduce((sum, i) => sum + i.amountPaise, 0) === value.totalFeePaise,
    {
      // A fee plan whose parts don't sum to its total produces a fee account
      // that can never reconcile — catch it here, not in the ledger.
      message: 'Installment amounts must add up to the total fee',
      path: ['installments'],
    },
  );

export type ProgrammeInput = z.infer<typeof programmeSchema>;

export const updateProgrammeSchema = z
  .object({
    programmeId: z.string().min(1),
    academyId: z.string().min(1, 'Select an academy'),
    name: z.string().trim().min(2, 'Programme name is required').max(120),
    code: z
      .string()
      .trim()
      .min(2, 'Programme code is required')
      .max(20)
      .regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers, and hyphens only'),
    durationDays: z.number().int().positive().max(3650),
    sessionCount: z.number().int().positive().max(1000),
    eligibility: z.string().trim().max(600).optional().or(z.literal('')),
    curriculumSummary: z.string().trim().max(2000).optional().or(z.literal('')),
    minAttendancePct: z.number().int().min(0).max(100),
    minAssessmentScore: z.number().int().min(0).max(100),
    totalFeePaise: paise,
    installments: z.array(installmentSchema).max(12),
  })
  .strict()
  .refine(
    (value) =>
      value.installments.length === 0 ||
      value.installments.reduce((sum, i) => sum + i.amountPaise, 0) === value.totalFeePaise,
    { message: 'Installment amounts must add up to the total fee', path: ['installments'] },
  );

export type UpdateProgrammeInput = z.infer<typeof updateProgrammeSchema>;

export const setCatalogueStatusSchema = z
  .object({
    entity: z.enum(['academy', 'programme']),
    id: z.string().min(1),
    status: z.enum(CATALOGUE_STATUSES),
  })
  .strict();

export type SetCatalogueStatusInput = z.infer<typeof setCatalogueStatusSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface Academy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: CatalogueStatus;
  programmeCount: number;
}

export interface Installment {
  label: string;
  amountPaise: number;
  dueOffsetDays: number;
}

export interface Programme {
  id: string;
  academyId: string;
  academyName: string | null;
  name: string;
  code: string;
  durationDays: number;
  sessionCount: number;
  eligibility: string | null;
  curriculumSummary: string | null;
  certificateRules: { minAttendancePct: number; minAssessmentScore: number };
  feePlanDefault: { totalPaise: number; installments: Installment[] };
  status: CatalogueStatus;
}

/** Minimal shape for picklists in other features (batches, enrolments). */
export interface ProgrammeOption {
  id: string;
  name: string;
  code: string;
  academyId: string;
  academyName: string;
}
