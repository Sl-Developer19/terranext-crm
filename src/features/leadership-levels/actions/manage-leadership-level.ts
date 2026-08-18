'use server';

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
  createLeadershipLevelRecord,
  findLeadershipLevelById,
  isLevelSlugTaken,
  setLeadershipLevelStatusRecord,
  updateLeadershipLevelRecord,
} from '../repository';
import {
  leadershipLevelSchema,
  setLeadershipLevelStatusSchema,
  updateLeadershipLevelSchema,
  type LeadershipLevelInput,
  type SetLeadershipLevelStatusInput,
  type UpdateLeadershipLevelInput,
} from '../schema';

/**
 * Leadership level CRUD (Settings §3) — gated on `settings:configure`, same
 * permission as General settings and ID Formats (Doc 16 S53): this is
 * organisation-wide Growth Partner programme configuration, not a
 * partner-management action, so it belongs with the rest of Settings rather
 * than under `growthPartners:*`.
 */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
}

export async function createLeadershipLevel(
  input: LeadershipLevelInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'settings:configure')) return permissionError();

  const parsed = leadershipLevelSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));

  try {
    if (await isLevelSlugTaken(parsed.data.slug)) {
      return conflictError('A leadership level with this slug already exists.');
    }

    const id = await createLeadershipLevelRecord(parsed.data, session.uid, session.branchId);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'leadership_level',
      entityId: id,
      entityPath: `leadershipLevels/${id}`,
      context: { feature: 'leadership-levels' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not create the leadership level. Please try again.');
  }
}

export async function updateLeadershipLevel(
  input: UpdateLeadershipLevelInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'settings:configure')) return permissionError();

  const parsed = updateLeadershipLevelSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { levelId, ...fields } = parsed.data;

  try {
    const existing = await findLeadershipLevelById(levelId);
    if (!existing) return notFoundError('Leadership level not found.');
    if (await isLevelSlugTaken(fields.slug, levelId)) {
      return conflictError('A leadership level with this slug already exists.');
    }

    await updateLeadershipLevelRecord(levelId, fields, session.uid);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (existing.name !== fields.name) changes.name = { before: existing.name, after: fields.name };
    if (existing.slug !== fields.slug) {
      changes.slug = { before: existing.slug, after: fields.slug };
    }
    if (existing.displayOrder !== fields.displayOrder) {
      changes.displayOrder = { before: existing.displayOrder, after: fields.displayOrder };
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'leadership_level',
      entityId: levelId,
      entityPath: `leadershipLevels/${levelId}`,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
      context: { feature: 'leadership-levels' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the leadership level. Please try again.');
  }
}

/**
 * Archive/restore ("Delete" in the requirement — never a hard delete, same
 * Doc 03 §4 posture as catalogue academies/programmes). An archived level
 * stays resolvable for any partner already on it; it's just excluded from
 * the picker for new assignments and from `findDefaultLeadershipLevelSlug`.
 */
export async function setLeadershipLevelStatus(
  input: SetLeadershipLevelStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'settings:configure')) return permissionError();

  const parsed = setLeadershipLevelStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ status: 'Select a valid status' });
  const { levelId, status } = parsed.data;

  try {
    const existing = await findLeadershipLevelById(levelId);
    if (!existing) return notFoundError('Leadership level not found.');

    await setLeadershipLevelStatusRecord(levelId, status, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'leadership_level',
      entityId: levelId,
      entityPath: `leadershipLevels/${levelId}`,
      changes: { status: { before: existing.status, after: status } },
      context: { feature: 'leadership-levels' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not change the status. Please try again.');
  }
}
