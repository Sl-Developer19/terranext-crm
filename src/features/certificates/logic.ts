import { calculateAttendancePct } from '@/features/attendance/logic';
import { summarizeAttempts, type ScoredAttempt } from '@/features/assessments/logic';
import type { AttendanceStatus } from '@/features/attendance/schema';

/**
 * BR-03 certificate eligibility (Doc 15, condition C-2).
 *
 * The defining property: eligibility is computed from RAW evidence —
 * individual attendance marks and individual scores — never from the
 * denormalized `attendancePct` / `assessmentSummary` roll-ups on the
 * enrolment. Those roll-ups are display-only and can be stale; a stale
 * roll-up must never be able to issue a certificate to someone who has not
 * earned it, nor block someone who has. That is exactly what C-2 requires
 * and what the tests below pin down.
 */

export interface EligibilityEvidence {
  /** Every attendance mark for this participant in this batch. */
  attendanceStatuses: readonly AttendanceStatus[];
  /** Every scored attempt for this participant in this batch. */
  attempts: readonly ScoredAttempt[];
  /** Programme thresholds (`programmes.certificateRules`). */
  minAttendancePct: number;
  minAssessmentScore: number;
}

export interface EligibilityVerdict {
  eligible: boolean;
  attendancePct: number;
  assessmentAvgScore: number;
  assessmentPassed: boolean;
  /** Human-readable per-criterion failures — Doc 19 requires this detail. */
  blockers: string[];
}

/**
 * Evaluates BR-03 from raw evidence. Both criteria must be met; each failure
 * is reported separately so the UI can say precisely what is missing rather
 * than a bare "not eligible".
 */
export function evaluateEligibility(evidence: EligibilityEvidence): EligibilityVerdict {
  const attendancePct = calculateAttendancePct(evidence.attendanceStatuses);
  const summary = summarizeAttempts(evidence.attempts);

  const blockers: string[] = [];

  const attendanceMet = attendancePct >= evidence.minAttendancePct;
  if (!attendanceMet) {
    blockers.push(
      `Attendance is ${attendancePct}%, below the required ${evidence.minAttendancePct}%.`,
    );
  }

  // An unassessed participant is never eligible, regardless of threshold —
  // "not yet measured" must not read as "met the bar".
  const assessmentMet = summary.attempted > 0 && summary.avgScore >= evidence.minAssessmentScore;
  if (summary.attempted === 0) {
    blockers.push('No assessment has been recorded for this participant.');
  } else if (!assessmentMet) {
    blockers.push(
      `Assessment average is ${summary.avgScore}, below the required ${evidence.minAssessmentScore}.`,
    );
  }

  return {
    eligible: attendanceMet && assessmentMet,
    attendancePct,
    assessmentAvgScore: summary.avgScore,
    assessmentPassed: assessmentMet,
    blockers,
  };
}

/**
 * Certificate number from the `counters/certificateNo` sequence
 * (Doc 14 §3, pattern `TNXC-YYYY-NNNNN`).
 */
export function formatCertificateNo(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/** A revoked certificate can never be revoked again (Doc 19 `precondition`). */
export function canRevoke(status: 'issued' | 'revoked'): boolean {
  return status === 'issued';
}

/**
 * Public verification exposes programme and issue date only — never the
 * participant's name or any other PII (Doc 19 `verifyCertificate`).
 */
export function isVerificationSafe(fields: readonly string[]): boolean {
  const forbidden = new Set(['participantId', 'participantName', 'phone', 'email', 'dob']);
  return !fields.some((field) => forbidden.has(field));
}

/**
 * The URL a certificate's QR code encodes — the CRM's own public `/verify`
 * page, which itself calls the existing `/api/certificates/verify` JSON
 * endpoint. Never a second verification system: this is the one path a
 * scanned certificate can be checked through, staff or anonymous.
 */
export function buildCertificateVerifyUrl(
  crmOrigin: string,
  certificateNo: string,
  hash: string,
): string {
  const params = new URLSearchParams({ no: certificateNo, hash });
  return `${crmOrigin.replace(/\/$/, '')}/verify?${params.toString()}`;
}
