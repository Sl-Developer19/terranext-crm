import { z } from 'zod';

/**
 * College master + campus leaders (Doc 03, Doc 14 §10, S15).
 *
 * Colleges are a lead *source*: leads carry `sourceDetail.collegeId`, which is
 * what makes college-wise lead reporting possible. Campus leaders are the
 * named contacts who refer them, and may themselves be participants.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export const COLLEGE_STATUSES = ['active', 'archived'] as const;
export type CollegeStatus = (typeof COLLEGE_STATUSES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined));

export const collegeSchema = z
  .object({
    name: z.string().trim().min(2, 'College name is required').max(160),
    city: z.string().trim().min(2, 'City is required').max(120),
    contactPerson: optionalText(120),
    contactPhone: z
      .string()
      .trim()
      .regex(E164, 'Enter phone in E.164 format, e.g. +919876543210')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : undefined)),
  })
  .strict();
export type CollegeInput = z.infer<typeof collegeSchema>;

export const updateCollegeSchema = collegeSchema.extend({ collegeId: z.string().min(1) });
export type UpdateCollegeInput = z.infer<typeof updateCollegeSchema>;

export const setCollegeStatusSchema = z
  .object({
    collegeId: z.string().min(1),
    status: z.enum(COLLEGE_STATUSES),
  })
  .strict();
export type SetCollegeStatusInput = z.infer<typeof setCollegeStatusSchema>;

export const campusLeaderSchema = z
  .object({
    collegeId: z.string().min(1),
    name: z.string().trim().min(2, "Leader's name is required").max(120),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    participantId: optionalText(40),
  })
  .strict();
export type CampusLeaderInput = z.infer<typeof campusLeaderSchema>;

export const setLeaderActiveSchema = z
  .object({
    collegeId: z.string().min(1),
    leaderId: z.string().min(1),
    active: z.boolean(),
  })
  .strict();
export type SetLeaderActiveInput = z.infer<typeof setLeaderActiveSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface College {
  id: string;
  name: string;
  city: string;
  contactPerson: string | null;
  contactPhone: string | null;
  status: CollegeStatus;
  /** Leads attributed to this college — the reason the master exists. */
  leadCount: number;
  admittedCount: number;
  leaderCount: number;
}

export interface CampusLeader {
  id: string;
  name: string;
  phone: string;
  participantId: string | null;
  active: boolean;
}
