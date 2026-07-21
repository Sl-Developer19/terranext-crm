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

import { findParticipantById, updateParticipantRecord } from '../repository';
import { updateParticipantSchema, type UpdateParticipantInput } from '../schema';

/**
 * Edits personal / contact / parent-guardian details (Doc 16 S21 "edit
 * personal (ops)"). Search tokens are rebuilt by the repository on every
 * write so a renamed participant stays findable.
 */
export async function updateParticipant(
  input: UpdateParticipantInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:update')) return permissionError();

  const parsed = updateParticipantSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { participantId, ...personal } = parsed.data;

  try {
    const existing = await findParticipantById(participantId);
    if (!existing) return notFoundError('Participant not found.');

    await updateParticipantRecord(participantId, personal, session.uid);

    // Field-level diff only — never full snapshots (Doc 03 §6).
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (existing.personal.fullName !== personal.fullName) {
      changes.fullName = { before: existing.personal.fullName, after: personal.fullName };
    }
    if (existing.personal.phone !== personal.phone) {
      changes.phone = { before: existing.personal.phone, after: personal.phone };
    }
    if ((existing.personal.email ?? null) !== (personal.email ?? null)) {
      changes.email = { before: existing.personal.email, after: personal.email ?? null };
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'participant',
      entityId: participantId,
      entityPath: `participants/${participantId}`,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
      context: { feature: 'participants' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the participant. Please try again.');
  }
}
