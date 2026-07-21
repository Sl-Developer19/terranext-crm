'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
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

import { findParticipantById } from '@/features/participants/repository';

import {
  addParentRecord,
  createFamilyRecord,
  findFamilyById,
  linkParticipantRecord,
  updateFamilyRecord,
} from '../repository';
import {
  addParentSchema,
  createFamilySchema,
  linkParticipantSchema,
  updateFamilySchema,
  type AddParentInput,
  type CreateFamilyInput,
  type LinkParticipantInput,
  type UpdateFamilyInput,
} from '../schema';

/** Family and parent profile CRUD (parent-first acquisition path). */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    fields[issue.path.join('.') || 'form'] ??= issue.message;
  }
  return fields;
}

export async function createFamily(input: CreateFamilyInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'parents:create')) return permissionError();

  const parsed = createFamilySchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));

  try {
    const id = await createFamilyRecord(parsed.data, session.uid, session.branchId);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'family',
      entityId: id,
      entityPath: `families/${id}`,
      context: { feature: 'parents' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not create the family record. Please try again.');
  }
}

export async function updateFamily(input: UpdateFamilyInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'parents:update')) return permissionError();

  const parsed = updateFamilySchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { familyId, ...fields } = parsed.data;

  try {
    const existing = await findFamilyById(familyId);
    if (!existing) return notFoundError('Family not found.');

    await updateFamilyRecord(familyId, fields, session.uid);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (existing.primaryContactPhone !== fields.primaryContactPhone) {
      changes.primaryContactPhone = {
        before: existing.primaryContactPhone,
        after: fields.primaryContactPhone,
      };
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'family',
      entityId: familyId,
      entityPath: `families/${familyId}`,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
      context: { feature: 'parents' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the family record. Please try again.');
  }
}

export async function addParent(input: AddParentInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'parents:update')) return permissionError();

  const parsed = addParentSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { familyId, ...fields } = parsed.data;

  try {
    const family = await findFamilyById(familyId);
    if (!family) return notFoundError('Family not found.');

    const id = await addParentRecord(familyId, fields, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'parent',
      entityId: id,
      entityPath: `families/${familyId}/parents/${id}`,
      context: { feature: 'parents' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not add the parent. Please try again.');
  }
}

/**
 * Links an existing participant to the household. Deliberately a link, never
 * a copy (BR-01) — the participant record stays the single lifetime record
 * and the family simply references it.
 */
export async function linkParticipant(input: LinkParticipantInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'parents:update')) return permissionError();

  const parsed = linkParticipantSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { familyId, participantId } = parsed.data;

  try {
    const [family, participant] = await Promise.all([
      findFamilyById(familyId),
      findParticipantById(participantId),
    ]);
    if (!family) return notFoundError('Family not found.');
    if (!participant) return notFoundError('Participant not found.');

    if (family.linkedParticipantIds.includes(participantId)) {
      return ok({ ok: true });
    }

    // A participant belongs to one household; linking to a second would make
    // "family programme history" ambiguous about which household owns them.
    const existingLink = await adminDb()
      .collection('families')
      .where('linkedParticipantIds', 'array-contains', participantId)
      .limit(1)
      .get();
    if (!existingLink.empty && existingLink.docs[0]?.id !== familyId) {
      return conflictError('This participant is already linked to another family.');
    }

    await linkParticipantRecord(familyId, participantId, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'family',
      entityId: familyId,
      entityPath: `families/${familyId}`,
      changes: { linkedParticipantIds: { before: null, after: participantId } },
      context: { feature: 'parents', reason: 'participant_linked' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not link the participant. Please try again.');
  }
}
