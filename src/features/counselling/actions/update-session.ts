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
  findSessionMeta,
  markLeadCounselled,
  programmeExists,
  updateSessionRecord,
} from '../repository';
import { updateSessionSchema, type UpdateSessionInput } from '../schema';

/**
 * Edits an existing counselling session (Held Sessions table, Edit button).
 * Updates the record in place — never creates a second session for the same
 * lead. `id`, `leadId`, `createdAt`, and `createdBy` are preserved by
 * construction (`updateSessionRecord` never writes them); only `updatedAt`/
 * `updatedBy` move.
 *
 * BR-02 itself needs no separate "satisfied" flag to update: `br02Checklist`
 * (admissions queue, convert-lead gate) reads the session's `outcome`/
 * `recommendation` live on every call, so the moment this write commits, the
 * next read anywhere in the app already reflects it. `markLeadCounselled` is
 * still re-run below so `lead.stage` keeps tracking the latest session's
 * outcome — the same invariant `recordSession` maintains at creation — which
 * is what keeps the lead correctly surfaced in stage-filtered views.
 */
export async function updateSession(
  input: UpdateSessionInput,
): Promise<Result<{ sessionId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'counselling:update')) return permissionError();

  const parsed = updateSessionSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }
  const {
    sessionId,
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
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Counselling session not found.');

    // Re-check BR-02's shape server-side — never taken on the client's word,
    // same posture as `recordSession`.
    if (outcome === 'recommended' && !recommendedProgrammeId) {
      return validationError({
        recommendedProgrammeId: 'A recommended outcome must name the programme (BR-02).',
      });
    }
    if (recommendedProgrammeId && !(await programmeExists(recommendedProgrammeId))) {
      return validationError({ recommendedProgrammeId: 'That programme no longer exists.' });
    }

    await updateSessionRecord(
      sessionId,
      {
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
    );

    await markLeadCounselled(meta.leadId, outcome, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'counselling_session',
      entityId: sessionId,
      entityPath: `counsellingSessions/${sessionId}`,
      changes: { outcome: { before: null, after: outcome } },
      context: { feature: 'counselling', reason: 'session_edit' },
    });

    return ok({ sessionId });
  } catch {
    return internalError('Could not update the session. Please try again.');
  }
}
