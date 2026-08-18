'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { findLeadershipLevelBySlug } from '@/features/leadership-levels';
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

import {
  setGrowthPartnerLeadershipLevelSchema,
  type SetGrowthPartnerLeadershipLevelInput,
} from '../schema';

/**
 * Changes which leadership level an already-approved Growth Partner is on
 * (Settings §3 defines what levels exist; this assigns one to a specific
 * partner). Separate action, separate permission from level *definitions* —
 * this is ordinary partner management (`growthPartners:update`), not
 * organisation-wide configuration (`settings:configure`).
 */
export async function setGrowthPartnerLeadershipLevel(
  input: SetGrowthPartnerLeadershipLevelInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'growthPartners:update')) return permissionError();

  const parsed = setGrowthPartnerLeadershipLevelSchema.safeParse(input);
  if (!parsed.success) return validationError({ levelSlug: 'Select a valid level.' });
  const { partnerId, levelSlug } = parsed.data;

  try {
    const ref = adminDb().collection('growthPartners').doc(partnerId);
    const snap = await ref.get();
    if (!snap.exists || snap.get('deletedAt') !== null) {
      return notFoundError('Growth Partner not found.');
    }

    const level = await findLeadershipLevelBySlug(levelSlug);
    if (!level || level.status !== 'active') {
      return conflictError('That leadership level is not active — choose an active one.');
    }

    const before = (snap.get('leadershipLevel') as string) ?? null;
    await ref.update({ leadershipLevel: levelSlug, updatedAt: new Date(), updatedBy: session.uid });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'growth_partner',
      entityId: partnerId,
      entityPath: `growthPartners/${partnerId}`,
      changes: { leadershipLevel: { before, after: levelSlug } },
      context: { feature: 'growth-partners' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not change the leadership level. Please try again.');
  }
}
