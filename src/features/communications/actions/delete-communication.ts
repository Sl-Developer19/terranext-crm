'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { deleteCommunicationSchema, type DeleteCommunicationInput } from '../schema';

/**
 * Soft-deletes a communications log entry (ADR-009 — never a hard delete).
 *
 * Restricted to `communications:delete`, which the permission map grants
 * only to Founder and System Administrator (owner decision, 2026-07-25) —
 * re-checked here regardless of what the UI shows, since the UI hiding the
 * button is not the enforcement boundary; this guard is.
 */
export async function deleteCommunication(
  input: DeleteCommunicationInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'communications:delete')) return permissionError();

  const parsed = deleteCommunicationSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid delete request.' });
  const { communicationId } = parsed.data;

  const db = adminDb();
  const ref = db.collection('communications').doc(communicationId);

  try {
    const snap = await ref.get();
    // Existing rows predate this feature and never had `deletedAt` at all —
    // `!= null` correctly treats a missing field the same as an explicit
    // null (not yet deleted), so no backfill/migration is required.
    if (!snap.exists || snap.get('deletedAt') != null) {
      return notFoundError('Communication not found.');
    }

    const now = new Date();
    await ref.update({
      deletedAt: now,
      deletedBy: session.uid,
      isDeleted: true,
      updatedAt: now,
      updatedBy: session.uid,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'soft_delete',
      entityType: 'communication',
      entityId: communicationId,
      entityPath: `communications/${communicationId}`,
      changes: { deletedAt: { before: null, after: now.toISOString() } },
      context: { feature: 'communications' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not delete the message. Please try again.');
  }
}
