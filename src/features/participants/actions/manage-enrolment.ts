'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { statusAfterEnrolment } from '../logic';
import { addEnrolmentRecord, findParticipantById, updateEnrolmentStatus } from '../repository';
import {
  addEnrolmentSchema,
  setEnrolmentStatusSchema,
  type AddEnrolmentInput,
  type SetEnrolmentStatusInput,
} from '../schema';

/**
 * Academy/programme enrolment + batch assignment (Doc 03 §1.4).
 *
 * Re-enrolment creates a NEW enrolment document on the same participant —
 * never a new participant (BR-01/FR-03.3). The programme catalogue
 * (`academies`/`programmes`) and `batches` are free-text identifiers until
 * those modules land; the field names already match their future FKs, so
 * this becomes a picklist without a schema migration.
 *
 * BR-04 batch capacity is NOT enforced here — capacity lives on the batch
 * document, which does not exist yet. `allocateBatchAction` (Doc 19) owns
 * that transaction when Batch Management ships.
 */
export async function addEnrolment(input: AddEnrolmentInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:update')) return permissionError();

  const parsed = addEnrolmentSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { participantId, academyId, programmeId, batchId, status } = parsed.data;

  try {
    const participant = await findParticipantById(participantId);
    if (!participant) return notFoundError('Participant not found.');

    const enrolmentId = await addEnrolmentRecord(
      participantId,
      { academyId, programmeId, batchId: batchId ?? null, status },
      session.uid,
      statusAfterEnrolment(participant.status),
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'enrolment',
      entityId: enrolmentId,
      entityPath: `participants/${participantId}/enrolments/${enrolmentId}`,
      context: { feature: 'participants' },
    });

    return ok({ id: enrolmentId });
  } catch {
    return internalError('Could not add the enrolment. Please try again.');
  }
}

/** Updates an enrolment's progress status and/or batch assignment. */
export async function setEnrolmentStatus(
  input: SetEnrolmentStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:update')) return permissionError();

  const parsed = setEnrolmentStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ status: 'Select a valid status' });
  const { participantId, enrolmentId, status, batchId } = parsed.data;

  try {
    const participant = await findParticipantById(participantId);
    if (!participant) return notFoundError('Participant not found.');

    await updateEnrolmentStatus(participantId, enrolmentId, status, batchId ?? null, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'enrolment',
      entityId: enrolmentId,
      entityPath: `participants/${participantId}/enrolments/${enrolmentId}`,
      changes: { status: { before: null, after: status } },
      context: { feature: 'participants' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the enrolment. Please try again.');
  }
}
