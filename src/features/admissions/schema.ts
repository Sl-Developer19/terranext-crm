import { z } from 'zod';

import type { Br02Checklist } from '@/features/counselling';

/**
 * Admissions (S13/S14, Doc 16). The conversion is the single most
 * consequential write in the CRM: it mints a permanent Participant ID that
 * BR-01 promises will never be issued twice for the same person. Every gate
 * — BR-02 counselling evidence, BR-01 duplicate check, BR-04 batch capacity —
 * is re-checked server-side regardless of what the stepper allowed.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined));

export const convertLeadSchema = z
  .object({
    leadId: z.string().min(1),

    // Step 1 — verify details (pre-filled from the lead, editable).
    fullName: z.string().trim().min(2, 'Full name is required').max(120),
    dob: z.string().min(1, 'Date of birth is required'),
    gender: optionalText(40),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
    address: optionalText(500),
    emergencyContactName: z.string().trim().min(2, 'Emergency contact name is required').max(120),
    emergencyContactPhone: z.string().trim().regex(E164, 'Enter emergency phone in E.164 format'),
    emergencyContactRelation: z.string().trim().min(2, 'Relation is required').max(60),
    parentName: optionalText(120),
    parentPhone: optionalText(20),

    // Step 2 — duplicate resolution (BR-01).
    acknowledgedDuplicate: z.boolean().default(false),

    // Step 3 — programme and batch (BR-04 capacity shown in the UI).
    academyId: z.string().min(1, 'Select an academy'),
    programmeId: z.string().min(1, 'Select a programme'),
    batchId: optionalText(120),
  })
  .strict();
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

/** One row of the S13 queue: the lead plus its BR-02 verdict. */
export interface AdmissionCandidate {
  leadId: string;
  name: string;
  phone: string;
  email: string | null;
  stage: string;
  source: string;
  assignedToName: string | null;
  checklist: Br02Checklist;
  recommendedProgrammeName: string | null;
  updatedAt: string;
}

/** A possible existing record for the same person (BR-01 duplicate surface). */
export interface DuplicateMatch {
  participantId: string;
  fullName: string;
  phone: string;
  matchedOn: 'phone';
}
