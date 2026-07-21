'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { findBatchById } from '@/features/batches/repository';
import { isAttendanceWriteScoped } from '@/features/attendance/logic';

import { isScoreInRange } from '../logic';
import {
  createAssessmentRecord,
  enterAssessmentScores,
  findAssessmentById,
  updateAssessmentRecord,
} from '../repository';
import {
  assessmentSchema,
  enterScoresSchema,
  updateAssessmentSchema,
  type AssessmentInput,
  type EnterScoresInput,
  type UpdateAssessmentInput,
} from '../schema';

/** Assessment CRUD + score entry (Doc 03 §1.5). */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

export async function createAssessment(input: AssessmentInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'assessments:create')) return permissionError();

  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { batchId, ...rest } = parsed.data;

  try {
    const batch = await findBatchById(batchId);
    if (!batch) return validationError({ batchId: 'Select an existing batch' });

    // Trainers may only create assessments for batches they run — the same
    // row-level scope attendance uses (Doc 10 §2).
    if (isAttendanceWriteScoped(session.role, batch.trainerUid, session.uid)) {
      return permissionError('You can only create assessments for batches you run.');
    }

    const id = await createAssessmentRecord(
      { batchId, programmeId: batch.programmeId, ...rest },
      session.uid,
      session.branchId,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'assessment',
      entityId: id,
      entityPath: `assessments/${id}`,
      context: { feature: 'assessments' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not create the assessment. Please try again.');
  }
}

export async function updateAssessment(
  input: UpdateAssessmentInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'assessments:update')) return permissionError();

  const parsed = updateAssessmentSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { assessmentId, ...rest } = parsed.data;

  try {
    const existing = await findAssessmentById(assessmentId);
    if (!existing) return notFoundError('Assessment not found.');

    const batch = await findBatchById(existing.batchId);
    if (batch && isAttendanceWriteScoped(session.role, batch.trainerUid, session.uid)) {
      return permissionError('You can only edit assessments for batches you run.');
    }

    await updateAssessmentRecord(assessmentId, rest, session.uid);

    // Changing the pass mark retroactively changes who passed, so it is
    // always recorded as an explicit diff for the audit trail.
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (existing.passScore !== rest.passScore) {
      changes.passScore = { before: existing.passScore, after: rest.passScore };
    }
    if (existing.maxScore !== rest.maxScore) {
      changes.maxScore = { before: existing.maxScore, after: rest.maxScore };
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'assessment',
      entityId: assessmentId,
      entityPath: `assessments/${assessmentId}`,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
      context: { feature: 'assessments' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the assessment. Please try again.');
  }
}

/**
 * Enters scores. The client sends marks only — pass/fail is derived
 * server-side from the assessment's own pass mark, so a tampered request
 * cannot manufacture a pass that BR-03 would later honour.
 */
export async function enterScores(input: EnterScoresInput): Promise<Result<{ entered: number }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'assessments:update') && !can(session.role, 'assessments:create')) {
    return permissionError();
  }

  const parsed = enterScoresSchema.safeParse(input);
  if (!parsed.success) return validationError({ scores: 'Enter at least one valid score' });
  const { assessmentId, scores } = parsed.data;

  try {
    const assessment = await findAssessmentById(assessmentId);
    if (!assessment) return notFoundError('Assessment not found.');

    const batch = await findBatchById(assessment.batchId);
    if (batch && isAttendanceWriteScoped(session.role, batch.trainerUid, session.uid)) {
      return permissionError('You can only enter scores for batches you run.');
    }

    const outOfRange = scores.find(
      (entry) => entry.score !== null && !isScoreInRange(entry.score, assessment.maxScore),
    );
    if (outOfRange) {
      return validationError({
        scores: `Scores must be whole numbers between 0 and ${assessment.maxScore}.`,
      });
    }

    await enterAssessmentScores(assessmentId, assessment.passScore, scores, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'assessment',
      entityId: assessmentId,
      entityPath: `assessments/${assessmentId}/scores`,
      context: { feature: 'assessments', reason: `scores_entered:${scores.length}` },
    });

    return ok({ entered: scores.length });
  } catch {
    return internalError('Could not save scores. Please try again.');
  }
}
