import { z } from 'zod';

/**
 * Certificate Template Engine (extension of Doc 03 §1.5/§1.6, BR-03/BR-05).
 *
 * A `certificateTemplates/{templateId}` doc is a named, academy/programme-
 * assigned template *family*. Its `versions/{versionId}` subcollection holds
 * immutable-once-approved snapshots — the unit that actually carries artwork,
 * field positions, and lifecycle status (DRAFT → REVIEW → APPROVED → ACTIVE →
 * ARCHIVED). Editing an approved/active version never mutates it in place;
 * editors always work against a new draft version cloned from it.
 *
 * All field coordinates are stored as 0–1 fractions of the artwork's own
 * pixel dimensions — nothing about layout is hardcoded in code, only in the
 * template document itself.
 */

export const TEMPLATE_VERSION_STATUSES = [
  'draft',
  'review',
  'approved',
  'active',
  'archived',
] as const;
export type TemplateVersionStatus = (typeof TEMPLATE_VERSION_STATUSES)[number];

const unitFraction = z.number().min(0).max(1);

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a 6-digit hex colour, e.g. #1A1A1A');

/**
 * Font choices are limited to pdf-lib's 14 standard PDF fonts — no font
 * upload capability exists (none was requested), so anything else could not
 * actually be embedded in the generated PDF.
 */
export const TEMPLATE_FONT_FAMILIES = [
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'TimesRoman',
  'TimesRomanBold',
  'TimesRomanItalic',
  'Courier',
  'CourierBold',
] as const;
export type TemplateFontFamily = (typeof TEMPLATE_FONT_FAMILIES)[number];

export const textFieldConfigSchema = z
  .object({
    visible: z.boolean(),
    x: unitFraction,
    y: unitFraction,
    width: unitFraction,
    height: unitFraction,
    fontFamily: z.enum(TEMPLATE_FONT_FAMILIES),
    fontSize: z.number().min(4).max(400),
    fontWeight: z.enum(['normal', 'bold']),
    color: hexColor,
    align: z.enum(['left', 'center', 'right']),
    lineHeight: z.number().min(0.5).max(4),
    letterSpacing: z.number().min(-5).max(50),
  })
  .strict();
export type TextFieldConfig = z.infer<typeof textFieldConfigSchema>;

export const imageFieldConfigSchema = z
  .object({
    visible: z.boolean(),
    x: unitFraction,
    y: unitFraction,
    width: unitFraction,
    height: unitFraction,
    objectFit: z.enum(['contain', 'cover']),
    opacity: z.number().min(0).max(1),
  })
  .strict();
export type ImageFieldConfig = z.infer<typeof imageFieldConfigSchema>;

export const qrFieldConfigSchema = z
  .object({
    visible: z.boolean(),
    x: unitFraction,
    y: unitFraction,
    size: unitFraction,
  })
  .strict();
export type QrFieldConfig = z.infer<typeof qrFieldConfigSchema>;

export const TEXT_FIELD_KEYS = [
  'participantName',
  'programmeName',
  'academyName',
  'completionDate',
  'certificateId',
  'duration',
  'signatoryName1',
  'signatoryDesignation1',
  'signatoryName2',
  'signatoryDesignation2',
] as const;
export type TextFieldKey = (typeof TEXT_FIELD_KEYS)[number];

export const IMAGE_FIELD_KEYS = ['signature1', 'signature2'] as const;
export type ImageFieldKey = (typeof IMAGE_FIELD_KEYS)[number];

export const SIGNATURE_SLOTS = IMAGE_FIELD_KEYS;
export type SignatureSlot = ImageFieldKey;

export const templateFieldsSchema = z
  .object({
    participantName: textFieldConfigSchema,
    programmeName: textFieldConfigSchema,
    academyName: textFieldConfigSchema,
    completionDate: textFieldConfigSchema,
    certificateId: textFieldConfigSchema,
    duration: textFieldConfigSchema,
    signatoryName1: textFieldConfigSchema,
    signatoryDesignation1: textFieldConfigSchema,
    signatoryName2: textFieldConfigSchema,
    signatoryDesignation2: textFieldConfigSchema,
    signature1: imageFieldConfigSchema,
    signature2: imageFieldConfigSchema,
    verificationQr: qrFieldConfigSchema,
  })
  .strict();
export type TemplateFields = z.infer<typeof templateFieldsSchema>;

export const signatorySchema = z
  .object({
    name: z.string().trim().max(120).default(''),
    designation: z.string().trim().max(120).default(''),
    storagePath: z.string().trim().min(1).nullable().default(null),
  })
  .strict();
export type Signatory = z.infer<typeof signatorySchema>;

export const signatoriesSchema = z
  .object({
    signature1: signatorySchema,
    signature2: signatorySchema,
  })
  .strict();
export type Signatories = z.infer<typeof signatoriesSchema>;

export const ARTWORK_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
export const ARTWORK_MAX_BYTES = 15 * 1024 * 1024;
export const SIGNATURE_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
export const SIGNATURE_MAX_BYTES = 5 * 1024 * 1024;

export const artworkMetaSchema = z
  .object({
    storagePath: z.string().min(1),
    mimeType: z.enum(ARTWORK_MIME_TYPES),
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
    sizeBytes: z.number().int().positive(),
  })
  .strict();
export type ArtworkMeta = z.infer<typeof artworkMetaSchema>;

/* ── Action inputs ─────────────────────────────────────────────────────── */

export const createTemplateSchema = z
  .object({
    name: z.string().trim().min(2, 'Template name is required').max(120),
    description: z.string().trim().max(600).optional().or(z.literal('')),
    academyId: z.string().min(1).nullable(),
    programmeId: z.string().min(1).nullable(),
  })
  .strict()
  .refine((v) => v.academyId !== null || v.programmeId !== null, {
    message: 'Assign the template to an academy or a programme',
    path: ['programmeId'],
  });
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const requestArtworkUploadSchema = z
  .object({
    templateId: z.string().min(1),
    versionId: z.string().min(1),
    fileName: z.string().trim().min(1).max(200),
    contentType: z.enum(ARTWORK_MIME_TYPES),
    sizeBytes: z.number().int().positive().max(ARTWORK_MAX_BYTES),
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
  })
  .strict();
export type RequestArtworkUploadInput = z.infer<typeof requestArtworkUploadSchema>;

export const confirmArtworkUploadSchema = z
  .object({
    templateId: z.string().min(1),
    versionId: z.string().min(1),
    contentType: z.enum(ARTWORK_MIME_TYPES),
    sizeBytes: z.number().int().positive().max(ARTWORK_MAX_BYTES),
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
  })
  .strict();
export type ConfirmArtworkUploadInput = z.infer<typeof confirmArtworkUploadSchema>;

export const versionRefSchema = z
  .object({ templateId: z.string().min(1), versionId: z.string().min(1) })
  .strict();
export type VersionRefInput = z.infer<typeof versionRefSchema>;

export const requestSignatureUploadSchema = z
  .object({
    templateId: z.string().min(1),
    versionId: z.string().min(1),
    slot: z.enum(SIGNATURE_SLOTS),
    fileName: z.string().trim().min(1).max(200),
    contentType: z.enum(SIGNATURE_MIME_TYPES),
    sizeBytes: z.number().int().positive().max(SIGNATURE_MAX_BYTES),
  })
  .strict();
export type RequestSignatureUploadInput = z.infer<typeof requestSignatureUploadSchema>;

export const confirmSignatureUploadSchema = versionRefSchema.extend({
  slot: z.enum(SIGNATURE_SLOTS),
  contentType: z.enum(SIGNATURE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(SIGNATURE_MAX_BYTES),
});
export type ConfirmSignatureUploadInput = z.infer<typeof confirmSignatureUploadSchema>;

export const updateSignatoryInfoSchema = versionRefSchema.extend({
  slot: z.enum(SIGNATURE_SLOTS),
  name: z.string().trim().max(120),
  designation: z.string().trim().max(120),
});
export type UpdateSignatoryInfoInput = z.infer<typeof updateSignatoryInfoSchema>;

export const updateVersionFieldsSchema = versionRefSchema.extend({
  fields: templateFieldsSchema,
});
export type UpdateVersionFieldsInput = z.infer<typeof updateVersionFieldsSchema>;

export const updateTemplateMetaSchema = z
  .object({
    templateId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(600).optional().or(z.literal('')),
    academyId: z.string().min(1).nullable(),
    programmeId: z.string().min(1).nullable(),
  })
  .strict()
  .refine((v) => v.academyId !== null || v.programmeId !== null, {
    message: 'Assign the template to an academy or a programme',
    path: ['programmeId'],
  });
export type UpdateTemplateMetaInput = z.infer<typeof updateTemplateMetaSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  academyId: string | null;
  academyName: string | null;
  programmeId: string | null;
  programmeName: string | null;
  activeVersionId: string | null;
  activeVersionNumber: number | null;
  latestVersionNumber: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  status: TemplateVersionStatus;
  artwork: ArtworkMeta | null;
  fields: TemplateFields;
  signatories: Signatories;
  submittedAt: string | null;
  submittedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  activatedAt: string | null;
  activatedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ArtworkUploadTicket {
  versionId: string;
  uploadUrl: string;
  contentType: string;
}

export interface SignatureUploadTicket {
  versionId: string;
  slot: SignatureSlot;
  uploadUrl: string;
  contentType: string;
}
