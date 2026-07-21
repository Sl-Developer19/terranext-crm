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
  createAcademyRecord,
  findAcademyById,
  isSlugTaken,
  updateAcademyRecord,
} from '../repository';
import {
  academySchema,
  updateAcademySchema,
  type AcademyInput,
  type UpdateAcademyInput,
} from '../schema';

/** Academy catalogue CRUD (S22). Academies are archived, never deleted (Doc 03 §4). */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

export async function createAcademy(input: AcademyInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'programmes:create')) return permissionError();

  const parsed = academySchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));

  try {
    // The slug is a public-facing identifier the website will route on —
    // uniqueness matters beyond this screen.
    if (await isSlugTaken(parsed.data.slug)) {
      return conflictError('An academy with this slug already exists.');
    }

    const id = await createAcademyRecord(parsed.data, session.uid, session.branchId);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'academy',
      entityId: id,
      entityPath: `academies/${id}`,
      context: { feature: 'catalogue' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not create the academy. Please try again.');
  }
}

export async function updateAcademy(input: UpdateAcademyInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'programmes:update')) return permissionError();

  const parsed = updateAcademySchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { academyId, ...fields } = parsed.data;

  try {
    const existing = await findAcademyById(academyId);
    if (!existing) return notFoundError('Academy not found.');
    if (await isSlugTaken(fields.slug, academyId)) {
      return conflictError('An academy with this slug already exists.');
    }

    await updateAcademyRecord(academyId, fields, session.uid);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (existing.name !== fields.name) changes.name = { before: existing.name, after: fields.name };
    if (existing.slug !== fields.slug) changes.slug = { before: existing.slug, after: fields.slug };

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'academy',
      entityId: academyId,
      entityPath: `academies/${academyId}`,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
      context: { feature: 'catalogue' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the academy. Please try again.');
  }
}
