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

import { appendTimelineEntry, findParticipantById } from '../repository';
import { addParticipantNoteSchema, type AddParticipantNoteInput } from '../schema';

/**
 * Appends a staff note to the participant timeline (Doc 03 §1.4 — the
 * `timeline` subcollection is append-only; there is deliberately no edit or
 * delete path, so the consolidated history stays trustworthy).
 */
export async function addParticipantNote(
  input: AddParticipantNoteInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:update')) return permissionError();

  const parsed = addParticipantNoteSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { participantId, summary } = parsed.data;

  try {
    const participant = await findParticipantById(participantId);
    if (!participant) return notFoundError('Participant not found.');

    await appendTimelineEntry(participantId, { type: 'note', summary, byUid: session.uid });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'participant',
      entityId: participantId,
      entityPath: `participants/${participantId}`,
      context: { feature: 'participants', reason: 'timeline_note' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not add the note. Please try again.');
  }
}
