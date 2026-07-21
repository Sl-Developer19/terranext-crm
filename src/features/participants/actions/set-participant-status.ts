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

import { isManuallyAssignableStatus, isTerminalStatus, requiresStatusReason } from '../logic';
import { findParticipantById, updateParticipantStatus } from '../repository';
import { setParticipantStatusSchema, type SetParticipantStatusInput } from '../schema';

/**
 * Moves a participant through the lifecycle (Doc 03 §1.4).
 *
 * `alumni` is rejected here by design: BR-05 grants it via the
 * `onCertificateIssued` trigger, and allowing a dropdown to set it would let
 * staff mint alumni with no certificate behind them.
 */
export async function setParticipantStatus(
  input: SetParticipantStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:update')) return permissionError();

  const parsed = setParticipantStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ status: 'Select a valid status' });
  const { participantId, status, reason } = parsed.data;

  if (!isManuallyAssignableStatus(status)) {
    return validationError({
      status: 'Alumni status is granted automatically on certification (BR-05).',
    });
  }
  if (requiresStatusReason(status) && !reason) {
    return validationError({ reason: 'A reason is required when dropping a participant.' });
  }

  try {
    const existing = await findParticipantById(participantId);
    if (!existing) return notFoundError('Participant not found.');
    if (existing.status === status) return ok({ ok: true });

    await updateParticipantStatus(
      participantId,
      status,
      isTerminalStatus(status),
      session.uid,
      `Status changed from "${existing.status}" to "${status}"${reason ? `: ${reason}` : ''}`,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'participant',
      entityId: participantId,
      entityPath: `participants/${participantId}`,
      changes: { status: { before: existing.status, after: status } },
      context: { feature: 'participants', ...(reason ? { reason } : {}) },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not change the status. Please try again.');
  }
}
