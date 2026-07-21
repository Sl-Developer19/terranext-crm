import { z } from 'zod';

/**
 * Communications log (Doc 03 §1.7, Doc 14 §19, S41). FR-10.3 is the whole
 * point of this module: the log doc is written *before* anything is handed to
 * a provider, so a message that was attempted but never delivered still leaves
 * a trace. The provider is the system of record for message bodies — we store
 * a ≤300-char preview only.
 */

export const CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type Channel = (typeof CHANNELS)[number];

export const DIRECTIONS = ['outbound', 'inbound'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const REF_TYPES = ['lead', 'participant'] as const;
export type RefType = (typeof REF_TYPES)[number];

export const COMM_STATUSES = ['queued', 'sent', 'failed'] as const;
export type CommStatus = (typeof COMM_STATUSES)[number];

export const BODY_PREVIEW_MAX = 300;

/** Outbound send — creates the log doc as `queued` (FR-10.3). */
export const sendCommunicationSchema = z
  .object({
    channel: z.enum(CHANNELS),
    refType: z.enum(REF_TYPES),
    refId: z.string().min(1, 'Select who this message is about'),
    templateKey: z.string().min(1).nullable().default(null),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1, 'Message body is required').max(5000),
  })
  .strict()
  .superRefine((value, ctx) => {
    // A subject is meaningless on SMS/WhatsApp and required on email — the
    // provider will reject a subject-less email outright.
    if (value.channel === 'email' && !value.subject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subject'],
        message: 'A subject is required for email',
      });
    }
  });
export type SendCommunicationInput = z.infer<typeof sendCommunicationSchema>;

/** Records a message that already happened off-system (inbound reply, phone-relayed SMS). */
export const logCommunicationSchema = z
  .object({
    channel: z.enum(CHANNELS),
    direction: z.enum(DIRECTIONS),
    refType: z.enum(REF_TYPES),
    refId: z.string().min(1, 'Select who this message is about'),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1, 'Message body is required').max(5000),
  })
  .strict();
export type LogCommunicationInput = z.infer<typeof logCommunicationSchema>;

export const communicationFilterSchema = z
  .object({
    channel: z.enum(CHANNELS).optional(),
    status: z.enum(COMM_STATUSES).optional(),
    refType: z.enum(REF_TYPES).optional(),
    refId: z.string().optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();
export type CommunicationFilter = z.infer<typeof communicationFilterSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface Communication {
  id: string;
  channel: Channel;
  direction: Direction;
  refType: RefType;
  refId: string;
  refName: string;
  templateKey: string | null;
  subject: string | null;
  bodyPreview: string;
  status: CommStatus;
  sentAt: string | null;
  byUid: string;
  createdAt: string;
}

export interface RecipientOption {
  id: string;
  name: string;
  refType: RefType;
}
