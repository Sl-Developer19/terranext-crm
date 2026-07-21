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

import { toBodyPreview } from '../logic';
import { createCommunicationRecord, refExists } from '../repository';
import {
  logCommunicationSchema,
  sendCommunicationSchema,
  type LogCommunicationInput,
  type SendCommunicationInput,
} from '../schema';
import { findTemplate } from '../templates';

/** Communications log writes (S41, FR-10.3). */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
}

/**
 * FR-10.3 log-before-send: the doc lands as `queued` and the provider hand-off
 * is a separate step. No email/SMS provider is configured in this environment
 * yet, so messages stay `queued` until the dispatch worker exists — which is
 * exactly the state the log is designed to make visible rather than hide.
 */
export async function sendCommunication(
  input: SendCommunicationInput,
): Promise<Result<{ communicationId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'communications:create')) return permissionError();

  const parsed = sendCommunicationSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { channel, refType, refId, templateKey, subject, body } = parsed.data;

  if (templateKey && !findTemplate(templateKey)) {
    return validationError({ templateKey: 'That template no longer exists.' });
  }

  try {
    if (!(await refExists(refType, refId))) {
      return notFoundError(refType === 'lead' ? 'Lead not found.' : 'Participant not found.');
    }

    const communicationId = await createCommunicationRecord(
      {
        channel,
        direction: 'outbound',
        refType,
        refId,
        templateKey,
        subject: subject ?? null,
        bodyPreview: toBodyPreview(body),
        status: 'queued',
        sentAt: null,
      },
      session.uid,
      session.branchId,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'communication',
      entityId: communicationId,
      entityPath: `communications/${communicationId}`,
      changes: { status: { before: null, after: 'queued' } },
      context: { feature: 'communications' },
    });

    return ok({ communicationId });
  } catch {
    return internalError('Could not queue the message. Please try again.');
  }
}

/** Records a message that already happened off-system — logged as `sent`, never queued. */
export async function logCommunication(
  input: LogCommunicationInput,
): Promise<Result<{ communicationId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'communications:create')) return permissionError();

  const parsed = logCommunicationSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { channel, direction, refType, refId, subject, body } = parsed.data;

  try {
    if (!(await refExists(refType, refId))) {
      return notFoundError(refType === 'lead' ? 'Lead not found.' : 'Participant not found.');
    }

    const communicationId = await createCommunicationRecord(
      {
        channel,
        direction,
        refType,
        refId,
        templateKey: null,
        subject: subject ?? null,
        bodyPreview: toBodyPreview(body),
        status: 'sent',
        sentAt: new Date(),
      },
      session.uid,
      session.branchId,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'communication',
      entityId: communicationId,
      entityPath: `communications/${communicationId}`,
      changes: { status: { before: null, after: 'sent' } },
      context: { feature: 'communications' },
    });

    return ok({ communicationId });
  } catch {
    return internalError('Could not record the message. Please try again.');
  }
}
