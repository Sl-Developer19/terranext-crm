'use server';

import { getCareerProfile } from '@/features/career';
import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  preconditionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { canCreatePlacement, isValidTransition } from '../logic';
import { advancePlacementRecord, createPlacementRecord, findPlacementById } from '../repository';
import {
  advancePlacementSchema,
  createPlacementSchema,
  type AdvancePlacementInput,
  type CreatePlacementInput,
} from '../schema';

/** Placements pipeline mutations (S31). */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
}

export async function createPlacement(
  input: CreatePlacementInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'placements:create')) return permissionError();

  const parsed = createPlacementSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { participantId, employerId, jobCategory, country, thirdPartyNotes } = parsed.data;

  try {
    const profile = await getCareerProfile(participantId);
    if (!profile || !canCreatePlacement(profile.eligibility)) {
      return preconditionError(
        'BR-09',
        'This participant must have an eligible career profile evaluation before a placement can be created.',
      );
    }

    const id = await createPlacementRecord(
      { participantId, employerId, jobCategory, country, thirdPartyNotes: thirdPartyNotes || null },
      session.uid,
      session.branchId,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'placement',
      entityId: id,
      entityPath: `placements/${id}`,
      context: { feature: 'placements' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not create the placement. Please try again.');
  }
}

export async function advancePlacement(
  input: AdvancePlacementInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'placements:update')) return permissionError();

  const parsed = advancePlacementSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { placementId, status, note } = parsed.data;

  try {
    const existing = await findPlacementById(placementId);
    if (!existing) return notFoundError('Placement not found.');
    if (!isValidTransition(existing.status, status)) {
      return validationError({ status: `Cannot move from "${existing.status}" to "${status}".` });
    }

    await advancePlacementRecord(placementId, status, note || null, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'placement',
      entityId: placementId,
      entityPath: `placements/${placementId}`,
      changes: { status: { before: existing.status, after: status } },
      context: { feature: 'placements', ...(note ? { reason: note } : {}) },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the placement. Please try again.');
  }
}
