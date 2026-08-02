'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { batchExists, createSessionRecord, programmeExists } from '../repository';
import { createSessionSchema, type CreateSessionInput } from '../schema';

/** Trainer creates a session before recording — the "Create Session" step of the workflow. */
export async function createSession(
  input: CreateSessionInput,
): Promise<Result<{ sessionId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }
  const { title, batchId, programmeId, deviceLabel } = parsed.data;

  try {
    if (batchId && !(await batchExists(batchId))) {
      return validationError({ batchId: 'That batch no longer exists.' });
    }
    if (programmeId && !(await programmeExists(programmeId))) {
      return validationError({ programmeId: 'That programme no longer exists.' });
    }

    const sessionId = await createSessionRecord(
      {
        title,
        batchId: batchId ?? null,
        programmeId: programmeId ?? null,
        deviceLabel: deviceLabel ?? null,
      },
      session.uid,
      session.branchId,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'ai_session',
      entityId: sessionId,
      entityPath: `aiSessions/${sessionId}`,
      context: { feature: 'ai-intelligence' },
    });

    return ok({ sessionId });
  } catch {
    return internalError('Could not create the session. Please try again.');
  }
}
