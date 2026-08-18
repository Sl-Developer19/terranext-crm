import { z } from 'zod';

/**
 * Academy + programme catalogue (Doc 03 §1.2, Doc 14 §5–6, S22).
 * `certificateRules` per programme is what makes BR-03 configurable rather
 * than hardcoded; `feePlanDefault` seeds fee accounts at conversion (M7).
 */

export const CATALOGUE_STATUSES = ['active', 'archived'] as const;
export type CatalogueStatus = (typeof CATALOGUE_STATUSES)[number];

/**
 * Whether a programme is currently accepting new enrolments — independent of
 * `CatalogueStatus` (`active`/`archived`, which is about the programme
 * existing in the catalogue at all). An `active` programme can still be
 * `closed` intake (e.g. mid-cohort) or `waitlist` without being archived.
 */
export const INTAKE_STATUSES = ['open', 'closed', 'waitlist'] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

/** Money is integer paise everywhere (ADR-012) — never floats. */
const paise = z.number().int().min(0, 'Amount cannot be negative');

/**
 * ISO 4217 currency code, e.g. "INR". Validated as a 3-letter code, not
 * restricted to a hardcoded allow-list — ADR-012's paise convention is
 * INR-specific (no exchange-rate/minor-unit handling exists for any other
 * currency), so a non-INR value is accepted and stored but does not change
 * how amounts are computed anywhere in this codebase yet. Flagged in the
 * field's own label in the form, not silently pretended to be full
 * multi-currency support.
 */
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter ISO currency code, e.g. INR');

const slug = z
  .string()
  .trim()
  .min(2, 'Slug is required')
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only');

/** Lucide icon name (e.g. "graduation-cap") or empty — not validated against
 * an exhaustive hardcoded icon list, since that would just move the
 * hardcoding problem rather than remove it. The UI suggests common names. */
const icon = z.string().trim().max(60).optional().or(z.literal(''));

const themeColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a 6-digit hex colour, e.g. #0D6B4E')
  .optional()
  .or(z.literal(''));

export const academySchema = z
  .object({
    name: z.string().trim().min(2, 'Academy name is required').max(120),
    slug,
    description: z.string().trim().max(600).optional().or(z.literal('')),
    displayOrder: z.number().int().min(0).max(9999),
    icon,
    themeColor,
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

const programmeBaseFields = {
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
  /** BR-03 thresholds — the certificate gate, configurable per programme.
   * Only enforced/read at all when `certificateEnabled` is true. */
  minAttendancePct: z.number().int().min(0).max(100),
  minAssessmentScore: z.number().int().min(0).max(100),
  certificateEnabled: z.boolean(),
  totalFeePaise: paise,
  currency,
  intakeStatus: z.enum(INTAKE_STATUSES),
  /** Optional planning/default figure — batches (BR-04) carry their own
   * capacity independently; this is not a hard cap enforced anywhere. */
  capacity: z.number().int().positive().max(100_000).optional(),
  installments: z.array(installmentSchema).max(12, 'At most 12 installments'),
};

export const programmeSchema = z
  .object(programmeBaseFields)
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
  .object({ programmeId: z.string().min(1), ...programmeBaseFields })
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
  /** Sort order for public-facing listings (website + CRM pick-lists) — lower first. */
  displayOrder: number;
  /** Lucide icon name, e.g. "graduation-cap". Null if unset. */
  icon: string | null;
  /** 6-digit hex colour, e.g. "#0D6B4E". Null if unset. */
  themeColor: string | null;
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
  /** Whether BR-03 certificate eligibility applies to this programme at all —
   * when false, `certificateRules` still exists as stored data but issuance
   * is blocked outright (see `certificates/actions/manage-certificate.ts`). */
  certificateEnabled: boolean;
  certificateRules: { minAttendancePct: number; minAssessmentScore: number };
  feePlanDefault: { totalPaise: number; installments: Installment[] };
  /** ISO 4217 currency code the fee amounts are denominated in — see the
   * `currency` schema field's comment for what this does and doesn't imply. */
  currency: string;
  intakeStatus: IntakeStatus;
  /** Optional planning figure, not an enforced cap — see schema comment. */
  capacity: number | null;
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
