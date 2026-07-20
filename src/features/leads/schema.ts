import { z } from 'zod';

/** Domain schemas for lead management (Doc 03 §1.3, Doc 15 BR-07). Framework-free. */

const E164 = /^\+[1-9]\d{7,14}$/;

export const LEAD_SOURCES = [
  'website',
  'campaign',
  'referral',
  'college',
  'walk-in',
  'social',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STAGES = [
  'new',
  'contacted',
  'counselling_booked',
  'counselling_attended',
  'hot',
  'admitted',
  'lost',
  'follow_up',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_ACTIVITY_TYPES = ['call', 'note', 'stage_change', 'followup'] as const;
export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];

export const createLeadSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the lead's name").max(120),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : undefined)),
    source: z.enum(LEAD_SOURCES, { errorMap: () => ({ message: 'Select a source' }) }),
    // Free-text until the catalogue module (academies/programmes) lands —
    // stored under the same field names Doc 03 reserves for the future FK.
    programmeInterest: z.string().trim().max(120).optional().or(z.literal('')),
    consentGiven: z.literal(true, {
      errorMap: () => ({ message: 'Consent is required to create a lead record' }),
    }),
  })
  .strict();

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z
  .object({
    leadId: z.string().min(1),
    stage: z.enum(LEAD_STAGES).optional(),
    programmeInterest: z.string().trim().max(120).optional().or(z.literal('')),
    nextFollowUpAt: z.string().datetime().optional().or(z.literal('')),
    lostReason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .strict();

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const assignLeadSchema = z
  .object({
    leadId: z.string().min(1),
    assignToUid: z.string().min(1),
  })
  .strict();

export type AssignLeadInput = z.infer<typeof assignLeadSchema>;

export const logLeadActivitySchema = z
  .object({
    leadId: z.string().min(1),
    type: z.enum(LEAD_ACTIVITY_TYPES),
    summary: z.string().trim().min(1, 'Enter a summary').max(1_000),
  })
  .strict();

export type LogLeadActivityInput = z.infer<typeof logLeadActivitySchema>;

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  programmeInterest: string | null;
  stage: LeadStage;
  assignedToUid: string | null;
  assignedToName: string | null;
  nextFollowUpAt: string | null;
  lostReason: string | null;
  participantId: string | null;
  consentGiven: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  type: LeadActivityType;
  summary: string;
  at: string;
  byUid: string;
  byName: string;
}
