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

import {
  createSessionRecord,
  leadExists,
  markLeadCounselled,
  programmeExists,
} from '../repository';
import { recordSessionSchema, type RecordSessionInput } from '../schema';

/** S12 — record a counselling session (BR-02 evidence). */
export async function recordSession(
  input: RecordSessionInput,
): Promise<Result<{ sessionId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'counselling:create')) return permissionError();

  const parsed = recordSessionSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }
  const {
    leadId,
    heldAt,
    mode,
    outcome,
    notes,
    needsAssessment,
    recommendedProgrammeId,
    recommendationRemarks,
  } = parsed.data;

  const heldAtDate = new Date(heldAt);
  if (Number.isNaN(heldAtDate.getTime())) {
    return validationError({ heldAt: 'Enter a valid date and time.' });
  }

  try {
    if (!(await leadExists(leadId))) return notFoundError('Lead not found.');

    // Re-check BR-02's shape server-side: the client schema enforces it too,
    // but this is the evidence an admission rests on, so it is never taken
    // on the UI's word.
    if (outcome === 'recommended' && !recommendedProgrammeId) {
      return validationError({
        recommendedProgrammeId: 'A recommended outcome must name the programme (BR-02).',
      });
    }
    if (recommendedProgrammeId && !(await programmeExists(recommendedProgrammeId))) {
      return validationError({ recommendedProgrammeId: 'That programme no longer exists.' });
    }

    const sessionId = await createSessionRecord(
      {
        leadId,
        heldAt: heldAtDate,
        mode,
        outcome,
        notes,
        needsAssessment: needsAssessment ?? null,
        recommendation: recommendedProgrammeId
          ? { programmeId: recommendedProgrammeId, remarks: recommendationRemarks ?? null }
          : null,
      },
      session.uid,
      session.branchId,
    );

    await markLeadCounselled(leadId, outcome, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'counselling_session',
      entityId: sessionId,
      entityPath: `counsellingSessions/${sessionId}`,
      changes: { outcome: { before: null, after: outcome } },
      context: { feature: 'counselling' },
    });

    return ok({ sessionId });
  } catch {
    return internalError('Could not record the session. Please try again.');
  }
}
