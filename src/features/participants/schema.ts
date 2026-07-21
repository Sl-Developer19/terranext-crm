import { z } from 'zod';

/**
 * Domain schemas for the participant lifetime record (Doc 03 §1.4, Doc 14
 * §11, BR-01). Framework-free — reused by actions, repository, and UI.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Participant lifecycle status.
 *
 * Doc 14 §11 defines `active|completed|alumni|withdrawn`. Two deltas, both
 * deliberate and documented in Doc 03 §1.4:
 * - `enrolled` added as the pre-start state (a participant exists from
 *   conversion, but their first batch may not have begun).
 * - `dropped` replaces Doc 14's `withdrawn` so the participant vocabulary
 *   matches the `enrolments` subcollection, which already uses `dropped`.
 * `alumni` is retained unchanged — BR-05's certification trigger sets it.
 *
 * "Lead" is intentionally NOT a status here: a participant only exists after
 * conversion (BR-01/BR-02); pre-conversion enquiries live in `leads` and are
 * linked by the immutable `leadId` field.
 */
export const PARTICIPANT_STATUSES = [
  'enrolled',
  'active',
  'completed',
  'dropped',
  'alumni',
] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const ENROLMENT_STATUSES = ['orientation', 'in_progress', 'completed', 'dropped'] as const;
export type EnrolmentStatus = (typeof ENROLMENT_STATUSES)[number];

export const DOCUMENT_KINDS = ['photo', 'id_proof', 'resume', 'passport', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = ['pending', 'ready', 'rejected'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Storage allow-list (Doc 10 §4) — mirrored in storage.rules. */
export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/** Doc 10 §4: `request.resource.size < 10MB`. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const;
export type Gender = (typeof GENDERS)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined));

export const createParticipantSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter the participant's full name").max(120),
    dob: z.string().min(1, 'Date of birth is required'),
    gender: z.enum(GENDERS).optional(),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : undefined)),
    address: optionalText(300),
    emergencyContactName: z.string().trim().min(2, 'Emergency contact name is required').max(120),
    emergencyContactPhone: z.string().trim().regex(E164, 'Enter emergency phone in E.164 format'),
    emergencyContactRelation: z.string().trim().min(2, 'Relation is required').max(60),
    parentName: optionalText(120),
    parentPhone: z
      .string()
      .trim()
      .regex(E164, 'Enter parent phone in E.164 format')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : undefined)),
    /** Provenance link when converting from a lead (BR-01). */
    leadId: optionalText(64),
  })
  .strict();

export type CreateParticipantInput = z.infer<typeof createParticipantSchema>;

export const updateParticipantSchema = z
  .object({
    participantId: z.string().min(1),
    fullName: z.string().trim().min(2, "Enter the participant's full name").max(120),
    dob: z.string().min(1, 'Date of birth is required'),
    gender: z.enum(GENDERS).optional(),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format'),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : undefined)),
    address: optionalText(300),
    emergencyContactName: z.string().trim().min(2, 'Emergency contact name is required').max(120),
    emergencyContactPhone: z.string().trim().regex(E164, 'Enter emergency phone in E.164 format'),
    emergencyContactRelation: z.string().trim().min(2, 'Relation is required').max(60),
    parentName: optionalText(120),
    parentPhone: z
      .string()
      .trim()
      .regex(E164, 'Enter parent phone in E.164 format')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : undefined)),
  })
  .strict();

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;

export const setParticipantStatusSchema = z
  .object({
    participantId: z.string().min(1),
    status: z.enum(PARTICIPANT_STATUSES),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .strict();

export type SetParticipantStatusInput = z.infer<typeof setParticipantStatusSchema>;

export const addEnrolmentSchema = z
  .object({
    participantId: z.string().min(1),
    academyId: z.string().trim().min(1, 'Academy is required').max(120),
    programmeId: z.string().trim().min(1, 'Programme is required').max(120),
    batchId: optionalText(120),
    status: z.enum(ENROLMENT_STATUSES).default('orientation'),
  })
  .strict();

export type AddEnrolmentInput = z.infer<typeof addEnrolmentSchema>;

export const setEnrolmentStatusSchema = z
  .object({
    participantId: z.string().min(1),
    enrolmentId: z.string().min(1),
    status: z.enum(ENROLMENT_STATUSES),
    batchId: optionalText(120),
  })
  .strict();

export type SetEnrolmentStatusInput = z.infer<typeof setEnrolmentStatusSchema>;

export const addParticipantNoteSchema = z
  .object({
    participantId: z.string().min(1),
    summary: z.string().trim().min(1, 'Enter a note').max(200),
  })
  .strict();

export type AddParticipantNoteInput = z.infer<typeof addParticipantNoteSchema>;

export const requestUploadTicketSchema = z
  .object({
    participantId: z.string().min(1),
    kind: z.enum(DOCUMENT_KINDS),
    fileName: z.string().trim().min(1, 'File name is required').max(200),
    sizeBytes: z
      .number()
      .int()
      .positive('File appears to be empty')
      .max(MAX_DOCUMENT_BYTES, 'Files must be 10MB or smaller'),
    contentType: z.enum(ALLOWED_CONTENT_TYPES, {
      errorMap: () => ({ message: 'Only JPEG, PNG, WebP, and PDF files are accepted' }),
    }),
  })
  .strict();

export type RequestUploadTicketInput = z.infer<typeof requestUploadTicketSchema>;

export const documentRefSchema = z
  .object({
    participantId: z.string().min(1),
    documentId: z.string().min(1),
  })
  .strict();

export type DocumentRefInput = z.infer<typeof documentRefSchema>;

export const participantFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(PARTICIPANT_STATUSES).optional(),
  academyId: z.string().trim().max(120).optional(),
  batchId: z.string().trim().max(120).optional(),
});

export type ParticipantFilters = z.infer<typeof participantFiltersSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface ParticipantPersonal {
  fullName: string;
  dob: string | null;
  gender: Gender | null;
  phone: string;
  email: string | null;
  address: string | null;
  emergencyContact: { name: string; phone: string; relation: string };
}

export interface ParticipantFamily {
  parentName: string | null;
  parentPhone: string | null;
}

export interface Participant {
  id: string;
  leadId: string | null;
  personal: ParticipantPersonal;
  family: ParticipantFamily;
  status: ParticipantStatus;
  currentEnrolmentId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Directory row — the projection the list screen needs, nothing more. */
export interface ParticipantListItem {
  id: string;
  fullName: string;
  phone: string;
  status: ParticipantStatus;
  academyId: string | null;
  batchId: string | null;
  updatedAt: string;
}

export interface Enrolment {
  id: string;
  academyId: string;
  programmeId: string;
  batchId: string | null;
  status: EnrolmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  /** Trigger-maintained, display-only (C-2 — never an authorization input). */
  attendancePct: number;
  assessmentSummary: { attempted: number; passed: number; avgScore: number };
  certificateId: string | null;
}

export interface TimelineEntry {
  id: string;
  type: string;
  refPath: string;
  summary: string;
  at: string;
  byUid: string;
  byName: string;
}

export interface ParticipantDocument {
  id: string;
  kind: DocumentKind;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  status: DocumentStatus;
  storagePath: string;
  uploadedBy: string;
  uploadedAt: string;
}
