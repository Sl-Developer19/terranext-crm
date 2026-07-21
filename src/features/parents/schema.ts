import { z } from 'zod';

/**
 * Parent & family records (Doc 03 §8 Q3 — the reserved `familyRecordId`
 * activated by the parent-first acquisition path).
 *
 * A `families/{id}` document is the household; parents are its members and
 * participants are linked to it. This is what lets "Family Programme
 * History" answer "what has this household done with us" across siblings,
 * which a per-participant `parentName` string never could.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export const PARENT_RELATIONS = ['mother', 'father', 'guardian', 'other'] as const;
export type ParentRelation = (typeof PARENT_RELATIONS)[number];

/** Where the household came into contact with the academy. */
export const FAMILY_SOURCES = [
  'participant_parent',
  'direct_enquiry',
  'referral',
  'campaign',
  'event',
] as const;
export type FamilySource = (typeof FAMILY_SOURCES)[number];

export const PARENT_SESSION_MODES = ['in_person', 'phone', 'video'] as const;
export type ParentSessionMode = (typeof PARENT_SESSION_MODES)[number];

/**
 * Parent counselling outcome. `recommended` is the outcome that makes a
 * parent convertible — it mirrors BR-02's rule for participants: a
 * conversion requires a counselling session that actually recommended one.
 */
export const PARENT_SESSION_OUTCOMES = ['recommended', 'follow_up', 'not_interested'] as const;
export type ParentSessionOutcome = (typeof PARENT_SESSION_OUTCOMES)[number];

/** Whether this parent has themselves become a lead/participant. */
export const PARENT_CONVERSION_STATUSES = ['not_converted', 'lead_created', 'enrolled'] as const;
export type ParentConversionStatus = (typeof PARENT_CONVERSION_STATUSES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined));

export const createFamilySchema = z
  .object({
    familyName: z.string().trim().min(2, 'Family name is required').max(120),
    primaryContactName: z.string().trim().min(2, "Enter the parent's name").max(120),
    primaryContactPhone: z
      .string()
      .trim()
      .regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    primaryContactEmail: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : undefined)),
    relation: z.enum(PARENT_RELATIONS, { errorMap: () => ({ message: 'Select a relation' }) }),
    source: z.enum(FAMILY_SOURCES, { errorMap: () => ({ message: 'Select a source' }) }),
    address: optionalText(300),
    notes: optionalText(1000),
  })
  .strict();

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;

export const updateFamilySchema = createFamilySchema
  .extend({ familyId: z.string().min(1) })
  .strict();
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;

export const addParentSchema = z
  .object({
    familyId: z.string().min(1),
    name: z.string().trim().min(2, "Enter the parent's name").max(120),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format'),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : undefined)),
    relation: z.enum(PARENT_RELATIONS),
    occupation: optionalText(120),
  })
  .strict();

export type AddParentInput = z.infer<typeof addParentSchema>;

export const linkParticipantSchema = z
  .object({
    familyId: z.string().min(1),
    participantId: z.string().min(1),
  })
  .strict();
export type LinkParticipantInput = z.infer<typeof linkParticipantSchema>;

export const logParentSessionSchema = z
  .object({
    familyId: z.string().min(1),
    parentId: z.string().min(1),
    heldAt: z.string().min(1, 'Session date is required'),
    mode: z.enum(PARENT_SESSION_MODES, { errorMap: () => ({ message: 'Select a mode' }) }),
    notes: z.string().trim().min(1, 'Enter session notes').max(2000),
    outcome: z.enum(PARENT_SESSION_OUTCOMES, {
      errorMap: () => ({ message: 'Select an outcome' }),
    }),
    recommendedProgrammeId: optionalText(120),
    nextFollowUpAt: z.string().optional().or(z.literal('')),
  })
  .strict()
  .refine(
    (value) => value.outcome !== 'recommended' || (value.recommendedProgrammeId ?? '') !== '',
    {
      // Mirrors BR-02: a "recommended" outcome that recommends nothing is not
      // a recommendation, and would let a conversion through on an empty basis.
      message: 'Select the programme being recommended',
      path: ['recommendedProgrammeId'],
    },
  );

export type LogParentSessionInput = z.infer<typeof logParentSessionSchema>;

export const convertParentSchema = z
  .object({
    familyId: z.string().min(1),
    parentId: z.string().min(1),
    programmeInterest: z.string().trim().max(120).optional().or(z.literal('')),
  })
  .strict();
export type ConvertParentInput = z.infer<typeof convertParentSchema>;

export const familyFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  source: z.enum(FAMILY_SOURCES).optional(),
  conversionStatus: z.enum(PARENT_CONVERSION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});
export type FamilyFilters = z.infer<typeof familyFiltersSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface Parent {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  relation: ParentRelation;
  occupation: string | null;
  conversionStatus: ParentConversionStatus;
  /** Set when this parent has been converted into a lead of their own. */
  leadId: string | null;
  participantId: string | null;
}

export interface Family {
  id: string;
  familyName: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string | null;
  relation: ParentRelation;
  source: FamilySource;
  address: string | null;
  notes: string | null;
  /** Participants belonging to this household (BR-01 records, not copies). */
  linkedParticipantIds: string[];
  parentCount: number;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyListItem {
  id: string;
  familyName: string;
  primaryContactName: string;
  primaryContactPhone: string;
  source: FamilySource;
  linkedParticipantCount: number;
  /** Highest conversion state reached by any parent in the household. */
  conversionStatus: ParentConversionStatus;
  updatedAt: string;
}

export interface ParentSession {
  id: string;
  parentId: string;
  parentName: string | null;
  heldAt: string;
  mode: ParentSessionMode;
  notes: string;
  outcome: ParentSessionOutcome;
  recommendedProgrammeId: string | null;
  nextFollowUpAt: string | null;
  counsellorUid: string;
  counsellorName: string | null;
}

/** One row of Family Programme History — what this household has done with us. */
export interface FamilyProgrammeHistoryRow {
  participantId: string;
  participantName: string;
  /** 'participant' for children, 'parent' when the parent themselves enrolled. */
  memberKind: 'participant' | 'parent';
  programmeId: string;
  programmeName: string | null;
  batchId: string | null;
  status: string;
  enrolledAt: string;
  certificateId: string | null;
}

export interface PaginatedFamilies {
  rows: FamilyListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
