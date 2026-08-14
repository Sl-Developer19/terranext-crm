import { z } from 'zod';

/**
 * Certificates (Doc 03 §1.5, Doc 14 §13, BR-03/BR-05).
 * Doc ID = certificate number, pattern `TNXC-YYYY-NNNNN`, from a counter.
 */

export const CERTIFICATE_STATUSES = ['issued', 'revoked'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const issueCertificateSchema = z
  .object({
    participantId: z.string().min(1),
    enrolmentId: z.string().min(1),
    /**
     * Ops-manager override for an exception issuance. Requires a reason and
     * is audited as an `override`, never as a routine create.
     */
    override: z.boolean().default(false),
    overrideReason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .strict()
  .refine((value) => !value.override || (value.overrideReason ?? '').length >= 10, {
    message: 'An override requires a reason of at least 10 characters',
    path: ['overrideReason'],
  });

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;

export const revokeCertificateSchema = z
  .object({
    certificateId: z.string().min(1),
    reason: z
      .string()
      .trim()
      .min(10, 'A revocation reason of at least 10 characters is required')
      .max(500),
  })
  .strict();

export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

/** BR-03 evidence snapshot, frozen at issuance (Doc 14 §13). */
export interface CertificateCriteria {
  attendancePct: number;
  minAttendanceRequired: number;
  assessmentAvgScore: number;
  minAssessmentRequired: number;
  assessmentPassed: boolean;
}

export interface Certificate {
  id: string;
  participantId: string;
  participantName: string | null;
  enrolmentId: string;
  programmeId: string;
  programmeName: string | null;
  batchId: string | null;
  issuedAt: string;
  issuedBy: string;
  criteria: CertificateCriteria;
  status: CertificateStatus;
  revokedReason: string | null;
  revokedAt: string | null;
  /** Random 32-hex used by the public verification endpoint. */
  verifyHash: string;
  /**
   * The exact template version rendered at issuance (Certificate Template
   * Engine). Null for certificates issued before the engine existed, or if
   * no active template was assigned to the programme at issuance time — the
   * certificate record itself is unaffected either way. Frozen forever: a
   * later template edit never changes what an already-issued certificate
   * points to (historical integrity).
   */
  templateId: string | null;
  templateVersionId: string | null;
  templateVersionNumber: number | null;
  /** Storage path of the generated PDF, set once rendering succeeds (non-fatal if it doesn't — see issueCertificateAction). */
  pdfStoragePath: string | null;
}

/** One row of the eligibility queue (S27). */
export interface EligibilityRow {
  participantId: string;
  participantName: string;
  enrolmentId: string;
  programmeId: string;
  programmeName: string | null;
  batchId: string | null;
  attendancePct: number;
  minAttendanceRequired: number;
  assessmentAvgScore: number;
  minAssessmentRequired: number;
  eligible: boolean;
  /** Per-criterion explanation when not eligible (BR-03 detail). */
  blockers: string[];
  existingCertificateId: string | null;
}

/** Public verification result — deliberately carries no PII. */
export interface VerificationResult {
  valid: boolean;
  certificateNo?: string;
  programmeName?: string;
  issuedAt?: string;
  status?: CertificateStatus;
}
