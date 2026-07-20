'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { isLeadRowScoped, isStageTransition } from '../logic';
import { updateLeadSchema, type LeadStage, type UpdateLeadInput } from '../schema';

/**
 * Edits a lead's stage/programme interest/follow-up/lost reason (Doc 16
 * S11). Row-scoped (Doc 10 §2): consultants may only update leads assigned
 * to them; ops_manager/founder may update any. A stage change is logged as
 * an `activities` entry so the follow-up trail (Doc 03 §1.3) stays complete
 * without a second, separate call from the UI.
 */
export async function updateLead(input: UpdateLeadInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'leads:update')) return permissionError();

  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { leadId, stage, programmeInterest, nextFollowUpAt, lostReason } = parsed.data;

  const db = adminDb();
  const ref = db.collection('leads').doc(leadId);

  try {
    const snap = await ref.get();
    if (!snap.exists || snap.get('deletedAt') !== null) return notFoundError('Lead not found.');
    const assignedToUid = (snap.get('assignedToUid') as string | null) ?? null;
    if (isLeadRowScoped(session.role, assignedToUid, session.uid)) return permissionError();

    const now = new Date();
    const previousStage = snap.get('stage') as LeadStage;
    const update: Record<string, unknown> = { updatedAt: now, updatedBy: session.uid };
    if (stage !== undefined) update.stage = stage;
    if (programmeInterest !== undefined) update.programmeInterestId = programmeInterest || null;
    if (nextFollowUpAt !== undefined) {
      update.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    }
    if (lostReason !== undefined) update.lostReason = lostReason || null;

    const batch = db.batch();
    batch.update(ref, update);

    const stageChanged = isStageTransition(previousStage, stage);
    if (stageChanged) {
      batch.set(ref.collection('activities').doc(), {
        type: 'stage_change',
        summary: `Stage changed from "${previousStage}" to "${stage}"`,
        at: now,
        byUid: session.uid,
      });
    }
    await batch.commit();

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'lead',
      entityId: leadId,
      entityPath: `leads/${leadId}`,
      ...(stageChanged ? { changes: { stage: { before: previousStage, after: stage } } } : {}),
      context: { feature: 'leads' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the lead. Please try again.');
  }
}
