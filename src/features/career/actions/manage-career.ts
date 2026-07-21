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

import { findParticipantById } from '@/features/participants/repository';

import {
  evaluateEligibilityRecord,
  logGuidanceSessionRecord,
  upsertCareerProfileRecord,
} from '../repository';
import {
  captureCareerInterestSchema,
  evaluateEligibilitySchema,
  logGuidanceSessionSchema,
  type CaptureCareerInterestInput,
  type EvaluateEligibilityInput,
  type LogGuidanceSessionInput,
} from '../schema';

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
}

export async function captureCareerInterest(
  input: CaptureCareerInterestInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'career:create') && !can(session.role, 'career:update')) {
    return permissionError();
  }

  const parsed = captureCareerInterestSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { participantId, ...fields } = parsed.data;

  try {
    const participant = await findParticipantById(participantId);
    if (!participant) return notFoundError('Participant not found.');

    await upsertCareerProfileRecord(participantId, fields, session.uid, session.branchId);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'career_profile',
      entityId: participantId,
      entityPath: `careerProfiles/${participantId}`,
      context: { feature: 'career' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not save career interest. Please try again.');
  }
}

/**
 * BR-09: eligibility is set by a human decision, never derived. The note is
 * the counsellor recommendation the SOP asks for — mandatory, not optional.
 */
export async function evaluateEligibility(
  input: EvaluateEligibilityInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'career:update')) return permissionError();

  const parsed = evaluateEligibilitySchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { participantId, eligibility, eligibilityNote, readinessScore } = parsed.data;

  try {
    await evaluateEligibilityRecord(
      participantId,
      eligibility,
      eligibilityNote,
      readinessScore,
      session.uid,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'career_profile',
      entityId: participantId,
      entityPath: `careerProfiles/${participantId}`,
      changes: { eligibility: { before: null, after: eligibility } },
      context: { feature: 'career', reason: eligibilityNote },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not save the evaluation. Please try again.');
  }
}

export async function logGuidanceSession(
  input: LogGuidanceSessionInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'career:update')) return permissionError();

  const parsed = logGuidanceSessionSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { participantId, heldAt, notes, recommendation } = parsed.data;

  try {
    const id = await logGuidanceSessionRecord(
      participantId,
      { heldAt, notes, recommendation: recommendation || null },
      session.uid,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'career_profile',
      entityId: participantId,
      entityPath: `careerProfiles/${participantId}/guidanceSessions/${id}`,
      context: { feature: 'career' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not record the session. Please try again.');
  }
}
