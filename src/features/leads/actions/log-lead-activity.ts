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

import { isLeadRowScoped } from '../logic';
import { logLeadActivitySchema, type LogLeadActivityInput } from '../schema';

/**
 * Appends a call/note/follow-up entry to a lead's activity trail (Doc 03
 * §1.3 subcollection, SOP 15.x follow-up trail). Row-scoped like
 * `updateLead`: consultants may only log against leads assigned to them.
 */
export async function logLeadActivity(input: LogLeadActivityInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'leads:update')) return permissionError();

  const parsed = logLeadActivitySchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { leadId, type, summary } = parsed.data;

  const db = adminDb();
  const ref = db.collection('leads').doc(leadId);

  try {
    const snap = await ref.get();
    if (!snap.exists || snap.get('deletedAt') !== null) return notFoundError('Lead not found.');
    const assignedToUid = (snap.get('assignedToUid') as string | null) ?? null;
    if (isLeadRowScoped(session.role, assignedToUid, session.uid)) return permissionError();

    const now = new Date();
    const batch = db.batch();
    batch.set(ref.collection('activities').doc(), { type, summary, at: now, byUid: session.uid });
    batch.update(ref, { updatedAt: now, updatedBy: session.uid });
    await batch.commit();

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'lead',
      entityId: leadId,
      entityPath: `leads/${leadId}`,
      context: { feature: 'leads', reason: `activity:${type}` },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not log the activity. Please try again.');
  }
}
