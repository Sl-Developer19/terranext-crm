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

import { canArchive } from '../logic';
import {
  createProgrammeRecord,
  findAcademyById,
  findProgrammeById,
  isProgrammeCodeTaken,
  setCatalogueStatusRecord,
  updateProgrammeRecord,
} from '../repository';
import {
  programmeSchema,
  setCatalogueStatusSchema,
  updateProgrammeSchema,
  type ProgrammeInput,
  type SetCatalogueStatusInput,
  type UpdateProgrammeInput,
} from '../schema';

/**
 * Programme catalogue CRUD (S22). A programme carries the BR-03 certificate
 * thresholds and the default fee plan, so it is the configuration surface two
 * later modules read rather than hardcoding.
 */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

export async function createProgramme(input: ProgrammeInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'programmes:create')) return permissionError();

  const parsed = programmeSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));

  try {
    const academy = await findAcademyById(parsed.data.academyId);
    if (!academy) return validationError({ academyId: 'Select an existing academy' });
    if (await isProgrammeCodeTaken(parsed.data.code)) {
      return conflictError('A programme with this code already exists.');
    }

    const id = await createProgrammeRecord(parsed.data, session.uid, session.branchId);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'programme',
      entityId: id,
      entityPath: `programmes/${id}`,
      context: { feature: 'catalogue' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not create the programme. Please try again.');
  }
}

export async function updateProgramme(input: UpdateProgrammeInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'programmes:update')) return permissionError();

  const parsed = updateProgrammeSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { programmeId, ...fields } = parsed.data;

  try {
    const existing = await findProgrammeById(programmeId);
    if (!existing) return notFoundError('Programme not found.');
    if (await isProgrammeCodeTaken(fields.code, programmeId)) {
      return conflictError('A programme with this code already exists.');
    }

    await updateProgrammeRecord(programmeId, fields, session.uid);

    // Certificate-threshold changes are the highest-consequence edit here:
    // they move the BR-03 gate for everyone subsequently assessed, so they
    // are always recorded as an explicit diff.
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (existing.certificateRules.minAttendancePct !== fields.minAttendancePct) {
      changes.minAttendancePct = {
        before: existing.certificateRules.minAttendancePct,
        after: fields.minAttendancePct,
      };
    }
    if (existing.certificateRules.minAssessmentScore !== fields.minAssessmentScore) {
      changes.minAssessmentScore = {
        before: existing.certificateRules.minAssessmentScore,
        after: fields.minAssessmentScore,
      };
    }
    if (existing.feePlanDefault.totalPaise !== fields.totalFeePaise) {
      changes.totalFeePaise = {
        before: existing.feePlanDefault.totalPaise,
        after: fields.totalFeePaise,
      };
    }
    if (existing.certificateEnabled !== fields.certificateEnabled) {
      changes.certificateEnabled = {
        before: existing.certificateEnabled,
        after: fields.certificateEnabled,
      };
    }
    if (existing.intakeStatus !== fields.intakeStatus) {
      changes.intakeStatus = { before: existing.intakeStatus, after: fields.intakeStatus };
    }
    if (existing.currency !== fields.currency) {
      changes.currency = { before: existing.currency, after: fields.currency };
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'programme',
      entityId: programmeId,
      entityPath: `programmes/${programmeId}`,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
      context: { feature: 'catalogue' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the programme. Please try again.');
  }
}

/**
 * Archive/restore. Catalogue entities are never hard-deleted (Doc 03 §4) —
 * a programme with certificates issued against it must stay resolvable, so
 * archiving is the only removal semantics that exists.
 */
export async function setCatalogueStatus(
  input: SetCatalogueStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'programmes:update')) return permissionError();

  const parsed = setCatalogueStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ status: 'Select a valid status' });
  const { entity, id, status } = parsed.data;

  try {
    let previousStatus: string;
    if (entity === 'academy') {
      const academy = await findAcademyById(id);
      if (!academy) return notFoundError('Academy not found.');
      if (status === 'archived' && !canArchive(academy.programmeCount)) {
        return conflictError(
          'Archive or move this academy’s programmes first — they would otherwise reference an archived academy.',
        );
      }
      previousStatus = academy.status;
      await setCatalogueStatusRecord('academies', id, status, session.uid);
    } else {
      const programme = await findProgrammeById(id);
      if (!programme) return notFoundError('Programme not found.');
      previousStatus = programme.status;
      await setCatalogueStatusRecord('programmes', id, status, session.uid);
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: entity,
      entityId: id,
      entityPath: `${entity === 'academy' ? 'academies' : 'programmes'}/${id}`,
      changes: { status: { before: previousStatus, after: status } },
      context: { feature: 'catalogue' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not change the status. Please try again.');
  }
}
