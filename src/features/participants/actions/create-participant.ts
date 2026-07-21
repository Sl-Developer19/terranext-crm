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

import { createParticipantRecord, findByPhone } from '../repository';
import { createParticipantSchema, type CreateParticipantInput } from '../schema';

export interface CreateParticipantResult {
  participantId: string;
  /** An existing participant already uses this phone number (BR-01 signal). */
  possibleDuplicate: boolean;
}

/**
 * Creates a participant lifetime record (BR-01, Doc 03 §1.4).
 *
 * Doc 14 §11 states participants are created by `convertLead`; that
 * transaction lands in M3 and will call `createParticipantRecord` directly
 * rather than duplicating the shape. This action is the direct-entry path
 * for participants who never existed as a lead (transfers, historic
 * backfill), gated by the `participants:create` grant already in the
 * Doc 04 §3 matrix — no new permission was invented for it.
 *
 * A duplicate phone is surfaced, not blocked: BR-01 is about not creating a
 * SECOND record for the same human, and only a human can judge whether a
 * shared phone (a parent's number on two siblings) is actually a duplicate.
 */
export async function createParticipant(
  input: CreateParticipantInput,
): Promise<Result<CreateParticipantResult>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:create')) return permissionError();

  const parsed = createParticipantSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { leadId, ...personal } = parsed.data;

  try {
    const duplicate = await findByPhone(personal.phone);

    const participantId = await createParticipantRecord({
      input: personal,
      leadId: leadId ?? null,
      actorUid: session.uid,
      branchId: session.branchId,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'participant',
      entityId: participantId,
      entityPath: `participants/${participantId}`,
      context: { feature: 'participants' },
    });

    return ok({ participantId, possibleDuplicate: duplicate !== null });
  } catch {
    return internalError('Could not create the participant. Please try again.');
  }
}
