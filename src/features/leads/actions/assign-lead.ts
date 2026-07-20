'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import { internalError, notFoundError, ok, permissionError, type Result } from '@/lib/utils/result';

import { assignLeadSchema, type AssignLeadInput } from '../schema';

/**
 * Assigns (or reassigns) a lead to a consultant (Doc 04 §3: `leads:assign`
 * is ops_manager-only — consultants cannot self-assign or reassign).
 */
export async function assignLead(input: AssignLeadInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'leads:assign')) return permissionError();

  const parsed = assignLeadSchema.safeParse(input);
  if (!parsed.success) return permissionError('Invalid assignment request.');
  const { leadId, assignToUid } = parsed.data;

  const db = adminDb();
  const ref = db.collection('leads').doc(leadId);

  try {
    const snap = await ref.get();
    if (!snap.exists || snap.get('deletedAt') !== null) return notFoundError('Lead not found.');

    const previousAssignee = (snap.get('assignedToUid') as string | null) ?? null;
    const now = new Date();

    const batch = db.batch();
    batch.update(ref, { assignedToUid: assignToUid, updatedAt: now, updatedBy: session.uid });
    batch.set(ref.collection('activities').doc(), {
      type: 'note',
      summary: 'Lead reassigned',
      at: now,
      byUid: session.uid,
    });
    await batch.commit();

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'lead',
      entityId: leadId,
      entityPath: `leads/${leadId}`,
      changes: { assignedToUid: { before: previousAssignee, after: assignToUid } },
      context: { feature: 'leads' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not assign the lead. Please try again.');
  }
}
