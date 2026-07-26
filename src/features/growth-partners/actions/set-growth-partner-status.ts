'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
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

import { canToggleStatus } from '../logic';
import { setGrowthPartnerStatusSchema, type SetGrowthPartnerStatusInput } from '../schema';

/**
 * Suspends or reactivates an already-approved Growth Partner (Doc 25 §2).
 * Suspending revokes refresh tokens immediately (ADR-006 pattern, matching
 * `setUserStatus`) — a suspended partner's already-issued session cookie
 * fails the very next verification.
 */
export async function setGrowthPartnerStatus(
  input: SetGrowthPartnerStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'growthPartners:update')) return permissionError();

  const parsed = setGrowthPartnerStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid status.' });
  const { partnerId, status } = parsed.data;

  const db = adminDb();
  const ref = db.collection('growthPartners').doc(partnerId);
  const snap = await ref.get();
  if (!snap.exists || snap.get('deletedAt') !== null) {
    return notFoundError('Growth Partner not found.');
  }
  const before = snap.get('status');
  if (!canToggleStatus(before)) {
    return conflictError('Only an approved Growth Partner can be suspended or reactivated.');
  }

  const authUid = snap.get('authUid') as string | null;

  try {
    if (authUid) {
      await adminAuth().setCustomUserClaims(authUid, {
        actorType: 'growth_partner',
        partnerId,
        partnerStatus: status,
      });
      if (status === 'suspended') {
        await adminAuth().revokeRefreshTokens(authUid);
      }
    }
  } catch {
    return internalError('Could not update the partner account. Please try again.');
  }

  const now = new Date();
  await ref.update({ status, updatedAt: now, updatedBy: session.uid });

  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'status_change',
    entityType: 'growth_partner',
    entityId: partnerId,
    entityPath: `growthPartners/${partnerId}`,
    changes: { status: { before, after: status } },
    context: { feature: 'growth-partners' },
  });

  return ok({ ok: true });
}
