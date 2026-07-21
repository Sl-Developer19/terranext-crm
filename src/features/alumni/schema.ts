import { z } from 'zod';

/**
 * Alumni registry (Doc 03 §1.6, Doc 14 §17, BR-05, S33). Doc ID = participant
 * ID (1:1) — membership is granted once, on certification, never re-granted.
 * Creation itself is trigger-only (`ensureAlumniRecord`, BR-05) or an
 * audited `system_admin` override; this feature only reads the registry and
 * records ongoing engagement + consent.
 */

export const ENGAGEMENT_FIELDS = ['referrals', 'eventsAttended'] as const;
export type EngagementField = (typeof ENGAGEMENT_FIELDS)[number];

export const recordEngagementSchema = z
  .object({
    participantId: z.string().min(1),
    field: z.enum(ENGAGEMENT_FIELDS),
  })
  .strict();
export type RecordEngagementInput = z.infer<typeof recordEngagementSchema>;

export const setConsentSchema = z
  .object({
    participantId: z.string().min(1),
    consent: z.boolean(),
  })
  .strict();
export type SetConsentInput = z.infer<typeof setConsentSchema>;

/** BR-05 override path: a manual alumni grant with no triggering certificate. */
export const createAlumniOverrideSchema = z
  .object({
    participantId: z.string().min(1),
    reason: z
      .string()
      .trim()
      .min(10, 'A reason of at least 10 characters is required for a manual override')
      .max(1000),
  })
  .strict();
export type CreateAlumniOverrideInput = z.infer<typeof createAlumniOverrideSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface AlumniRecord {
  participantId: string;
  participantName: string;
  memberSince: string;
  triggeredByCertificateId: string | null;
  engagement: { referrals: number; eventsAttended: number };
  consentForSuccessStory: boolean;
  updatedAt: string;
}
