'use server';

import { enqueueTemplatedMessage } from '@/features/communications/enqueue';
import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  preconditionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { findProgrammeById } from '@/features/catalogue/repository';
import { findEnrolments, findParticipantById } from '@/features/participants/repository';

import { canRevoke } from '../logic';
import {
  ensureAlumniRecord,
  findCertificateById,
  issueCertificate,
  revokeCertificateRecord,
} from '../repository';
import {
  issueCertificateSchema,
  revokeCertificateSchema,
  type IssueCertificateInput,
  type RevokeCertificateInput,
} from '../schema';

/** Certificate issuance and revocation (Doc 19, BR-03/BR-05). */

export async function issueCertificateAction(
  input: IssueCertificateInput,
): Promise<Result<{ certificateId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');

  const parsed = issueCertificateSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const { participantId, enrolmentId, override, overrideReason } = parsed.data;

  // Routine issuance is a coordinator action; overriding a failed BR-03
  // check is an ops-manager approval (Doc 19 §2).
  if (override) {
    if (!can(session.role, 'certificates:approve')) {
      return permissionError('Only an Operations Manager can override certificate eligibility.');
    }
  } else if (!can(session.role, 'certificates:create')) {
    return permissionError();
  }

  try {
    const participant = await findParticipantById(participantId);
    if (!participant) return notFoundError('Participant not found.');

    const enrolments = await findEnrolments(participantId);
    const enrolment = enrolments.find((e) => e.id === enrolmentId);
    if (!enrolment) return notFoundError('Enrolment not found.');

    const programme = await findProgrammeById(enrolment.programmeId);
    if (!programme) {
      return validationError({
        programmeId: 'This enrolment references a programme that no longer exists.',
      });
    }

    const outcome = await issueCertificate({
      participantId,
      enrolmentId,
      programmeId: enrolment.programmeId,
      batchId: enrolment.batchId,
      minAttendancePct: programme.certificateRules.minAttendancePct,
      minAssessmentScore: programme.certificateRules.minAssessmentScore,
      actorUid: session.uid,
      branchId: session.branchId,
      override,
    });

    if (outcome.kind === 'already_issued') {
      return ok({ certificateId: outcome.certificateId });
    }

    if (outcome.kind === 'not_eligible') {
      // Per-criterion detail, exactly as Doc 19 requires — never a bare
      // "not eligible" the coordinator cannot act on.
      return preconditionError('BR-03', outcome.verdict.blockers.join(' '));
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: override && outcome.verdict.eligible === false ? 'override' : 'create',
      entityType: 'certificate',
      entityId: outcome.certificateId,
      entityPath: `certificates/${outcome.certificateId}`,
      changes: {
        attendancePct: { before: null, after: outcome.verdict.attendancePct },
        assessmentAvgScore: { before: null, after: outcome.verdict.assessmentAvgScore },
      },
      context: {
        feature: 'certificates',
        ...(override && overrideReason ? { reason: overrideReason } : {}),
      },
    });

    // BR-05: certification creates the alumni record. Runs after issuance
    // rather than inside its transaction — the certificate is the fact that
    // matters, and this is idempotent, so a failure here is recoverable by
    // re-running without risking the issuance itself.
    const created = await ensureAlumniRecord(
      participantId,
      outcome.certificateId,
      session.uid,
      session.branchId,
    );
    if (created) {
      await writeAudit({
        actorUid: 'system',
        actorRole: 'system',
        action: 'create',
        entityType: 'alumni_record',
        entityId: participantId,
        entityPath: `alumniRecords/${participantId}`,
        context: { feature: 'certificates', reason: `BR-05:${outcome.certificateId}` },
      });
    }

    // Doc 19 §3 `onCertificateIssued`: notify the participant. Idempotent by
    // ref+template, and swallowed on failure — the certificate is issued
    // either way, and a notification problem must not undo that fact.
    await enqueueTemplatedMessage({
      templateKey: 'participant.certificate_issued',
      refType: 'participant',
      refId: participantId,
      branchId: session.branchId,
    }).catch(() => undefined);

    return ok({ certificateId: outcome.certificateId });
  } catch {
    return internalError('Could not issue the certificate. Please try again.');
  }
}

/** Revocation is always an `override` in the audit trail, reason mandatory. */
export async function revokeCertificate(
  input: RevokeCertificateInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'certificates:approve')) {
    return permissionError('Only an Operations Manager can revoke a certificate.');
  }

  const parsed = revokeCertificateSchema.safeParse(input);
  if (!parsed.success) {
    return validationError({
      reason: 'A revocation reason of at least 10 characters is required.',
    });
  }
  const { certificateId, reason } = parsed.data;

  try {
    const certificate = await findCertificateById(certificateId);
    if (!certificate) return notFoundError('Certificate not found.');
    if (!canRevoke(certificate.status)) {
      return preconditionError('BR-03', 'This certificate has already been revoked.');
    }

    await revokeCertificateRecord(certificateId, reason, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'override',
      entityType: 'certificate',
      entityId: certificateId,
      entityPath: `certificates/${certificateId}`,
      changes: { status: { before: 'issued', after: 'revoked' } },
      context: { feature: 'certificates', reason },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not revoke the certificate. Please try again.');
  }
}
