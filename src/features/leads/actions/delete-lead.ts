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

import { deleteLeadSchema, type DeleteLeadInput } from '../schema';

/**
 * Soft-deletes a lead (ADR-009 — Firestore documents are never hard-deleted).
 *
 * Restricted to `leads:delete`, which the permission map grants only to
 * Founder and System Administrator (owner decision, 2026-07-25) — this is
 * re-checked here regardless of what the UI shows, since the UI hiding the
 * button is not the enforcement boundary; this guard is.
 */
export async function deleteLead(input: DeleteLeadInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'leads:delete')) return permissionError();

  const parsed = deleteLeadSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid delete request.' });
  const { leadId } = parsed.data;

  const db = adminDb();
  const ref = db.collection('leads').doc(leadId);

  try {
    const snap = await ref.get();
    if (!snap.exists || snap.get('deletedAt') !== null) return notFoundError('Lead not found.');

    const now = new Date();
    await ref.update({
      deletedAt: now,
      deletedBy: session.uid,
      isDeleted: true,
      updatedAt: now,
      updatedBy: session.uid,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'soft_delete',
      entityType: 'lead',
      entityId: leadId,
      entityPath: `leads/${leadId}`,
      changes: { deletedAt: { before: null, after: now.toISOString() } },
      context: { feature: 'leads' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not delete the lead. Please try again.');
  }
}
