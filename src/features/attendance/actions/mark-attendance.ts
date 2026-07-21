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

import { findBatchById } from '@/features/batches/repository';

import { isAttendanceWriteScoped } from '../logic';
import { markSessionAttendance } from '../repository';
import { markAttendanceSchema, type MarkAttendanceInput } from '../schema';

/**
 * Marks a session's attendance (Doc 19 `onAttendanceWrite` equivalent).
 *
 * Deviation from Doc 10 §3, deliberate: the blueprint anticipated
 * trainer-scoped *client* writes validated by Firestore rules. This runs as
 * a server action with the same scope enforced server-side instead, because
 * the roll-up recompute has to happen server-side anyway — splitting the
 * write across two trust tiers would have meant maintaining the trainer↔batch
 * rule in two places. Rules stay default-deny for attendance, which is
 * strictly more restrictive than the blueprint proposed.
 */
export async function markAttendance(
  input: MarkAttendanceInput,
): Promise<Result<{ marked: number }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'attendance:update') && !can(session.role, 'attendance:create')) {
    return permissionError();
  }

  const parsed = markAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return validationError({ marks: 'Select a status for at least one participant' });
  }
  const { batchId, sessionId, marks } = parsed.data;

  try {
    const batch = await findBatchById(batchId);
    if (!batch) return notFoundError('Batch not found.');

    // Row-level scope: a trainer may only mark their own batches (Doc 10 §2).
    if (isAttendanceWriteScoped(session.role, batch.trainerUid, session.uid)) {
      return permissionError('You can only mark attendance for batches you run.');
    }

    await markSessionAttendance(batchId, sessionId, batch.programmeId, marks, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'attendance',
      entityId: sessionId,
      entityPath: `batches/${batchId}/sessions/${sessionId}/attendance`,
      context: { feature: 'attendance', reason: `marked:${marks.length}` },
    });

    return ok({ marked: marks.length });
  } catch {
    return internalError('Could not save attendance. Please try again.');
  }
}
