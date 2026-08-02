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

import { findSessionMeta, softDeleteSession } from '../repository';
import { deleteSessionSchema, type DeleteSessionInput } from '../schema';

/** Soft delete only (ADR-009) — the audio object and generated knowledge are
 * left in place; the session is simply hidden from the active listing. */
export async function deleteSession(
  input: DeleteSessionInput,
): Promise<Result<{ sessionId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:delete')) return permissionError();

  const parsed = deleteSessionSchema.safeParse(input);
  if (!parsed.success) return validationError({ sessionId: 'Invalid session reference.' });
  const { sessionId } = parsed.data;

  try {
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');

    await softDeleteSession(sessionId, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'soft_delete',
      entityType: 'ai_session',
      entityId: sessionId,
      entityPath: `aiSessions/${sessionId}`,
      context: { feature: 'ai-intelligence' },
    });

    return ok({ sessionId });
  } catch {
    return internalError('Could not delete the session. Please try again.');
  }
}
