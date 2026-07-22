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
