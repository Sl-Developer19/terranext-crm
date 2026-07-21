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

import { generateSessionDates } from '../logic';
import {
  createSessionRecord,
  createSessionsForDates,
  findBatchById,
  setSessionStatusRecord,
} from '../repository';
import {
  sessionSchema,
  setSessionStatusSchema,
  type SessionInput,
  type SetSessionStatusInput,
} from '../schema';

/** Session calendar for a batch (Doc 03 §1.5). Attendance (M4) marks against these. */

export async function addSession(input: SessionInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'batches:update')) return permissionError();

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return validationError({ date: 'Enter a valid session date' });
  const { batchId, date, topic, trainerUid } = parsed.data;

  try {
    const batch = await findBatchById(batchId);
    if (!batch) return notFoundError('Batch not found.');

    const id = await createSessionRecord(
      batchId,
      { date, topic: topic || null, trainerUid: trainerUid || batch.trainerUid },
      session.uid,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'batch',
      entityId: batchId,
      entityPath: `batches/${batchId}/sessions/${id}`,
      context: { feature: 'batches', reason: 'session_added' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not add the session. Please try again.');
  }
}

/**
 * Regenerates missing sessions from the batch schedule. Idempotent by date —
 * it tops up gaps rather than duplicating sessions that already exist, so a
 * schedule change after the batch started does not destroy attendance history.
 */
export async function regenerateSessions(batchId: string): Promise<Result<{ created: number }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'batches:update')) return permissionError();

  try {
    const batch = await findBatchById(batchId);
    if (!batch) return notFoundError('Batch not found.');

    const dates = generateSessionDates(batch.startDate, batch.endDate, batch.schedule.days);
    const created = await createSessionsForDates(batchId, dates, batch.trainerUid, session.uid);

    if (created > 0) {
      await writeAudit({
        actorUid: session.uid,
        actorRole: session.role,
        action: 'create',
        entityType: 'batch',
        entityId: batchId,
        entityPath: `batches/${batchId}/sessions`,
        context: { feature: 'batches', reason: `sessions_generated:${created}` },
      });
    }

    return ok({ created });
  } catch {
    return internalError('Could not generate sessions. Please try again.');
  }
}

export async function setSessionStatus(
  input: SetSessionStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'batches:update')) return permissionError();

  const parsed = setSessionStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ status: 'Select a valid status' });
  const { batchId, sessionId, status } = parsed.data;

  try {
    const batch = await findBatchById(batchId);
    if (!batch) return notFoundError('Batch not found.');

    await setSessionStatusRecord(batchId, sessionId, status, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'batch',
      entityId: batchId,
      entityPath: `batches/${batchId}/sessions/${sessionId}`,
      changes: { status: { before: null, after: status } },
      context: { feature: 'batches', reason: 'session_status' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the session. Please try again.');
  }
}
