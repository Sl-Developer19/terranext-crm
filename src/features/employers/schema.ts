import { z } from 'zod';

/** Employer directory (Doc 03 §1.6, Doc 14 §15, S32). */

export const EMPLOYER_STATUSES = ['active', 'archived'] as const;
export type EmployerStatus = (typeof EMPLOYER_STATUSES)[number];

const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const employerSchema = z
  .object({
    name: z.string().trim().min(2, 'Employer name is required').max(120),
    country: z.string().trim().min(2, 'Country is required').max(80),
    industry: optionalTrimmed(80),
    contactName: optionalTrimmed(120),
    contactPhone: optionalTrimmed(20),
    contactEmail: z
      .string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal(''))
      .refine((v) => !v || z.string().email().safeParse(v).success, 'Enter a valid email'),
    agreementNote: optionalTrimmed(1000),
  })
  .strict();

export type EmployerInput = z.infer<typeof employerSchema>;

export const updateEmployerSchema = employerSchema
  .extend({ employerId: z.string().min(1) })
  .strict();
export type UpdateEmployerInput = z.infer<typeof updateEmployerSchema>;

export const setEmployerStatusSchema = z
  .object({
    employerId: z.string().min(1),
    status: z.enum(EMPLOYER_STATUSES),
  })
  .strict();
export type SetEmployerStatusInput = z.infer<typeof setEmployerStatusSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface Employer {
  id: string;
  name: string;
  country: string;
  industry: string | null;
  contact: { name: string | null; phone: string | null; email: string | null };
  agreementNote: string | null;
  status: EmployerStatus;
  placementCount: number;
}

/** Minimal shape for the employer picklist in the placements pipeline. */
export interface EmployerOption {
  id: string;
  name: string;
  country: string;
}
