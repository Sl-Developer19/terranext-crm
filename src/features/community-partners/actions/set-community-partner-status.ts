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
import { setCommunityPartnerStatusSchema, type SetCommunityPartnerStatusInput } from '../schema';

/**
 * Suspends or reactivates an already-approved Community Partner (TCGN) —
 * mirrors `growth-partners/actions/set-growth-partner-status.ts` exactly.
 * Suspending revokes refresh tokens immediately (ADR-006 pattern, matching
 * `setUserStatus`) — a suspended partner's already-issued session cookie
 * fails the very next verification, so a rejected/suspended partner cannot
 * log in even with a still-valid, unexpired cookie.
 */
export async function setCommunityPartnerStatus(
  input: SetCommunityPartnerStatusInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'growthPartners:update')) return permissionError();

  const parsed = setCommunityPartnerStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid status.' });
  const { partnerId, status } = parsed.data;

  const db = adminDb();
  const ref = db.collection('communityPartners').doc(partnerId);
  const snap = await ref.get();
  if (!snap.exists || snap.get('deletedAt') !== null) {
    return notFoundError('Community Partner not found.');
  }
  const before = snap.get('status');
  if (!canToggleStatus(before)) {
    return conflictError('Only an approved Community Partner can be suspended or reactivated.');
  }

  const authUid = snap.get('authUid') as string | null;

  try {
    if (authUid) {
      await adminAuth().setCustomUserClaims(authUid, {
        actorType: 'growth_partner',
        partnerId,
        partnerType: 'community_business',
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
    entityType: 'community_partner',
    entityId: partnerId,
    entityPath: `communityPartners/${partnerId}`,
    changes: { status: { before, after: status } },
    context: { feature: 'community-partners' },
  });

  return ok({ ok: true });
}
