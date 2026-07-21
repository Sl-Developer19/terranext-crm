'use server';

import { findParticipantById } from '@/features/participants/repository';
import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import {
  createAlumniOverrideRecord,
  findAlumniRecordById,
  recordEngagementDelta,
  setConsentRecord,
} from '../repository';
import {
  createAlumniOverrideSchema,
  recordEngagementSchema,
  setConsentSchema,
  type CreateAlumniOverrideInput,
  type RecordEngagementInput,
  type SetConsentInput,
} from '../schema';

/** Alumni registry mutations (S33). Membership itself is granted by BR-05 or override only. */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
}

export async function recordEngagement(
  input: RecordEngagementInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'alumni:update')) return permissionError();

  const parsed = recordEngagementSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { participantId, field } = parsed.data;

  try {
    const existing = await findAlumniRecordById(participantId);
    if (!existing) return notFoundError('Alumni record not found.');

    await recordEngagementDelta(participantId, field, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'alumni_record',
      entityId: participantId,
      entityPath: `alumniRecords/${participantId}`,
      changes: {
        [field]: { before: existing.engagement[field], after: existing.engagement[field] + 1 },
      },
      context: { feature: 'alumni' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not record engagement. Please try again.');
  }
}

export async function setConsent(input: SetConsentInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'alumni:update')) return permissionError();

  const parsed = setConsentSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { participantId, consent } = parsed.data;

  try {
    const existing = await findAlumniRecordById(participantId);
    if (!existing) return notFoundError('Alumni record not found.');

    await setConsentRecord(participantId, consent, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'alumni_record',
      entityId: participantId,
      entityPath: `alumniRecords/${participantId}`,
      changes: {
        consentForSuccessStory: { before: existing.consentForSuccessStory, after: consent },
      },
      context: { feature: 'alumni' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update consent. Please try again.');
  }
}

/** BR-05 manual override — `system_admin` only, reason always audited. */
export async function createAlumniOverride(
  input: CreateAlumniOverrideInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'alumni:configure')) {
    return permissionError('Only a System Administrator can grant alumni status manually.');
  }

  const parsed = createAlumniOverrideSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { participantId, reason } = parsed.data;

  try {
    const participant = await findParticipantById(participantId);
    if (!participant) return notFoundError('Participant not found.');

    const created = await createAlumniOverrideRecord(participantId, session.uid, session.branchId);
    if (!created) return conflictError('This participant already has an alumni record.');

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'override',
      entityType: 'alumni_record',
      entityId: participantId,
      entityPath: `alumniRecords/${participantId}`,
      context: { feature: 'alumni', reason },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not grant alumni status. Please try again.');
  }
}
