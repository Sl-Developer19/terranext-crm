'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import type { StaffRole } from '@/types/common';
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
  collegeExists,
  createCampusLeaderRecord,
  createCollegeRecord,
  findCollegeById,
  isCollegeNameTaken,
  setCollegeStatusRecord,
  setLeaderActiveRecord,
  updateCollegeRecord,
} from '../repository';
import {
  campusLeaderSchema,
  collegeSchema,
  setCollegeStatusSchema,
  setLeaderActiveSchema,
  updateCollegeSchema,
  type CampusLeaderInput,
  type CollegeInput,
  type SetCollegeStatusInput,
  type SetLeaderActiveInput,
  type UpdateCollegeInput,
} from '../schema';

/** College master + campus leader mutations (S15). */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
}

/**
 * `colleges:update` is one grant shared by two very different mutations:
 * editing the college master record (name/city/contact) and managing its
 * campus-leader sub-entities. Doc 04/18 document consultant's grant as
 * "leaders only," but the coarse `Module × Action` permission model has no
 * sub-resource scope to express that — so without this explicit check,
 * `updateCollege`/`setCollegeStatus` would let a consultant rewrite college
 * master data the docs (and the two-person design intent) say they cannot.
 * Restricting here, in the two master-record actions only, closes the gap
 * without widening the shared permission matrix (Doc 04 §3 changes are a
 * Tier 1 review, not a fix to bolt on unreviewed).
 */
function canEditCollegeMaster(role: StaffRole): boolean {
  return can(role, 'colleges:create');
}

export async function createCollege(input: CollegeInput): Promise<Result<{ collegeId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'colleges:create')) return permissionError();

  const parsed = collegeSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));

  try {
    if (await isCollegeNameTaken(parsed.data.name)) {
      return conflictError('A college with this name already exists.');
    }

    const collegeId = await createCollegeRecord(parsed.data, session.uid, session.branchId);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'college',
      entityId: collegeId,
      entityPath: `colleges/${collegeId}`,
      changes: { name: { before: null, after: parsed.data.name } },
      context: { feature: 'colleges' },
    });

    return ok({ collegeId });
  } catch {
    return internalError('Could not create the college. Please try again.');
  }
}

export async function updateCollege(input: UpdateCollegeInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'colleges:update')) return permissionError();
  if (!canEditCollegeMaster(session.role)) return permissionError();

  const parsed = updateCollegeSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { collegeId, ...fields } = parsed.data;

  try {
    const existing = await findCollegeById(collegeId);
    if (!existing) return notFoundError('College not found.');

    if (await isCollegeNameTaken(fields.name, collegeId)) {
      return conflictError('A college with this name already exists.');
    }

    await updateCollegeRecord(collegeId, fields, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'college',
      entityId: collegeId,
      entityPath: `colleges/${collegeId}`,
      changes: { name: { before: existing.name, after: fields.name } },
      context: { feature: 'colleges' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the college. Please try again.');
  }
}

/** Archiving is reversible and never deletes — college-wise history must survive. */
export async function setCollegeStatus(
  input: SetCollegeStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'colleges:update')) return permissionError();
  if (!canEditCollegeMaster(session.role)) return permissionError();

  const parsed = setCollegeStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { collegeId, status } = parsed.data;

  try {
    const existing = await findCollegeById(collegeId);
    if (!existing) return notFoundError('College not found.');

    await setCollegeStatusRecord(collegeId, status, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'college',
      entityId: collegeId,
      entityPath: `colleges/${collegeId}`,
      changes: { status: { before: existing.status, after: status } },
      context: { feature: 'colleges' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the college status. Please try again.');
  }
}

export async function addCampusLeader(
  input: CampusLeaderInput,
): Promise<Result<{ leaderId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'colleges:update')) return permissionError();

  const parsed = campusLeaderSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { collegeId, name, phone, participantId } = parsed.data;

  try {
    if (!(await collegeExists(collegeId))) return notFoundError('College not found.');

    const leaderId = await createCampusLeaderRecord(
      collegeId,
      { name, phone, participantId: participantId ?? null },
      session.uid,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'college',
      entityId: leaderId,
      entityPath: `colleges/${collegeId}/campusLeaders/${leaderId}`,
      changes: { name: { before: null, after: name } },
      context: { feature: 'colleges' },
    });

    return ok({ leaderId });
  } catch {
    return internalError('Could not add the campus leader. Please try again.');
  }
}

export async function setLeaderActive(input: SetLeaderActiveInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'colleges:update')) return permissionError();

  const parsed = setLeaderActiveSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { collegeId, leaderId, active } = parsed.data;

  try {
    if (!(await collegeExists(collegeId))) return notFoundError('College not found.');

    await setLeaderActiveRecord(collegeId, leaderId, active, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'college',
      entityId: leaderId,
      entityPath: `colleges/${collegeId}/campusLeaders/${leaderId}`,
      changes: { active: { before: !active, after: active } },
      context: { feature: 'colleges' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the campus leader. Please try again.');
  }
}
