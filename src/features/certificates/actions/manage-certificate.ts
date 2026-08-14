'use server';

import { format } from 'date-fns';

import { enqueueTemplatedMessage } from '@/features/communications/enqueue';
import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminBucket } from '@/lib/firebase/admin';
import { appOrigin } from '@/lib/http/app-origin';
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

import {
  findActiveTemplateForAssignment,
  renderAndStoreCertificatePdf,
} from '@/features/certificate-templates';
import { findProgrammeById } from '@/features/catalogue/repository';
import { findEnrolments, findParticipantById } from '@/features/participants/repository';

import { buildCertificateVerifyUrl, canRevoke } from '../logic';
import {
  ensureAlumniRecord,
  findCertificateById,
  issueCertificate,
  revokeCertificateRecord,
  setCertificatePdfPath,
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

    // Configuration gate, checked before BR-03 eligibility — a programme
    // with certificates disabled never issues one, regardless of attendance
    // or assessment thresholds, and regardless of `override` (an ops
    // override waives failed criteria, not the programme's own certificate
    // policy — those are different decisions made by different people).
    if (!programme.certificateEnabled) {
      return preconditionError('BR-03', 'Certificates are disabled for this programme.');
    }

    // Certificate Template Engine: an ACTIVE template must be resolvable
    // before anything is minted — programme-level assignment first, then
    // academy-level fallback. No template, no certificate, regardless of
    // override; a certificate cannot be rendered onto artwork that doesn't
    // exist, and a coordinator issuing one is not the moment to invent one.
    const templateMatch = await findActiveTemplateForAssignment(
      enrolment.programmeId,
      programme.academyId,
    );
    if (!templateMatch) {
      return preconditionError(
        'BR-03',
        'No active certificate template is configured for this programme.',
      );
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
      templateId: templateMatch.templateId,
      templateVersionId: templateMatch.versionId,
      templateVersionNumber: templateMatch.versionNumber,
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
    // re-running without risking the issuance itself. Caught locally: a
    // throw here must not fall into the outer catch and report the whole
    // issuance as failed when the certificate was already issued and audited.
    try {
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
    } catch {
      // Non-fatal — see above. The alumni record can be created by re-running
      // this idempotent step; it must not undo a successful certificate issuance.
    }

    // Certificate Template Engine: render the PDF onto the resolved active
    // template version and store it. Non-fatal on failure for the same
    // reason as the alumni step — the certificate record is already the
    // fact of record; a rendering problem is recoverable by regenerating
    // the PDF later without undoing the issuance itself.
    try {
      const origin = await appOrigin();
      const verifyUrl = buildCertificateVerifyUrl(
        origin,
        outcome.certificateId,
        outcome.verifyHash,
      );
      const durationLabel = `${programme.durationDays} day${programme.durationDays === 1 ? '' : 's'}`;

      const renderResult = await renderAndStoreCertificatePdf({
        certificateId: outcome.certificateId,
        templateId: templateMatch.templateId,
        templateVersionId: templateMatch.versionId,
        verifyUrl,
        participantName: participant.personal.fullName,
        programmeName: programme.name,
        academyName: programme.academyName ?? '',
        completionDate: format(outcome.issuedAt, 'PP'),
        duration: durationLabel,
      });
      if (renderResult.kind === 'stored') {
        await setCertificatePdfPath(outcome.certificateId, renderResult.storagePath, session.uid);
      }
    } catch {
      // Non-fatal — see above.
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

/**
 * Short-lived download URL for a certificate's generated PDF — same
 * signed-URL pattern as participant document downloads, audited the same
 * way (Doc 10 §6). Not available until the PDF has actually rendered.
 */
export async function issueCertificateDownloadUrl(
  certificateId: string,
): Promise<Result<{ url: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'certificates:view')) return permissionError();

  if (!certificateId || typeof certificateId !== 'string') {
    return validationError({ certificateId: 'Invalid certificate reference' });
  }

  try {
    const certificate = await findCertificateById(certificateId);
    if (!certificate) return notFoundError('Certificate not found.');
    if (!certificate.pdfStoragePath) {
      return validationError({ certificateId: 'The certificate PDF is not available yet.' });
    }

    const [url] = await adminBucket()
      .file(certificate.pdfStoragePath)
      .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 15 * 60 * 1_000 });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'export',
      entityType: 'certificate',
      entityId: certificateId,
      entityPath: `certificates/${certificateId}`,
      context: { feature: 'certificates', reason: 'certificate_download' },
    });

    return ok({ url });
  } catch {
    return internalError('Could not prepare the download. Please try again.');
  }
}
