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
  createEmployerRecord,
  findEmployerById,
  isEmployerNameTaken,
  setEmployerStatusRecord,
  updateEmployerRecord,
} from '../repository';
import {
  employerSchema,
  setEmployerStatusSchema,
  updateEmployerSchema,
  type EmployerInput,
  type SetEmployerStatusInput,
  type UpdateEmployerInput,
} from '../schema';

/** Employer directory CRUD (S32). Employers are archived, never deleted. */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
}

export async function createEmployer(input: EmployerInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'employers:create')) return permissionError();

  const parsed = employerSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));

  try {
    if (await isEmployerNameTaken(parsed.data.name)) {
      return conflictError('An employer with this name already exists.');
    }

    const id = await createEmployerRecord(parsed.data, session.uid, session.branchId);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'employer',
      entityId: id,
      entityPath: `employers/${id}`,
      context: { feature: 'employers' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not create the employer. Please try again.');
  }
}

export async function updateEmployer(input: UpdateEmployerInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'employers:update')) return permissionError();

  const parsed = updateEmployerSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { employerId, ...fields } = parsed.data;

  try {
    const existing = await findEmployerById(employerId);
    if (!existing) return notFoundError('Employer not found.');
    if (await isEmployerNameTaken(fields.name, employerId)) {
      return conflictError('An employer with this name already exists.');
    }

    await updateEmployerRecord(employerId, fields, session.uid);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (existing.name !== fields.name) changes.name = { before: existing.name, after: fields.name };

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'employer',
      entityId: employerId,
      entityPath: `employers/${employerId}`,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
      context: { feature: 'employers' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the employer. Please try again.');
  }
}

export async function setEmployerStatus(
  input: SetEmployerStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'employers:update')) return permissionError();

  const parsed = setEmployerStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { employerId, status } = parsed.data;

  try {
    const existing = await findEmployerById(employerId);
    if (!existing) return notFoundError('Employer not found.');

    await setEmployerStatusRecord(employerId, status, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'employer',
      entityId: employerId,
      entityPath: `employers/${employerId}`,
      changes: { status: { before: existing.status, after: status } },
      context: { feature: 'employers' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the employer status. Please try again.');
  }
}
