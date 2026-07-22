'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  err,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';
import type { StaffRole } from '@/types/common';

import { isProtectedRole, isSelfTargeting, wouldStrandPlatform } from '../logic';
import { setUserStatusSchema, type SetUserStatusInput } from '../schema';

async function countOtherActiveHolders(role: StaffRole, excludingUid: string): Promise<number> {
  const snap = await adminDb()
    .collection('users')
    .where('role', '==', role)
    .where('status', '==', 'active')
    .where('deletedAt', '==', null)
    .get();
  return snap.docs.filter((d) => d.id !== excludingUid).length;
}

const ROLE_LABEL: Partial<Record<StaffRole, string>> = {
  system_admin: 'System Administrator',
  founder: 'Founder',
};

/**
 * Doc 19 setUserStatus — precondition: not self. Disabling revokes refresh
 * tokens immediately (ADR-006: per-request status enforcement, not a 1h wait).
 */
export async function setUserStatus(input: SetUserStatusInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'users:update')) return permissionError();

  const parsed = setUserStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid status.' });
  const { uid, status } = parsed.data;

  if (isSelfTargeting(session.uid, uid)) {
    return err({
      code: 'precondition',
      message: 'You cannot change your own account status.',
      retryable: false,
    });
  }

  const db = adminDb();
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return notFoundError('This staff account no longer exists.');
  const before = snap.get('status') as 'active' | 'disabled';
  const role = snap.get('role') as StaffRole;

  // A compromised Founder account must still be disableable, so this guards
  // the *last* holder rather than the role outright — locking the role itself
  // would make account compromise unrecoverable.
  if (status === 'disabled' && isProtectedRole(role)) {
    const remaining = await countOtherActiveHolders(role, uid);
    if (wouldStrandPlatform(remaining)) {
      return err({
        code: 'precondition',
        message: `This is the last active ${ROLE_LABEL[role] ?? role} — promote another account before disabling this one.`,
        retryable: false,
      });
    }
  }

  await ref.update({ status, updatedAt: new Date(), updatedBy: session.uid });
  if (status === 'disabled') {
    await adminAuth().revokeRefreshTokens(uid);
  }

  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'status_change',
    entityType: 'user',
    entityId: uid,
    entityPath: `users/${uid}`,
    changes: { status: { before, after: status } },
    context: { feature: 'users' },
  });

  return ok({ ok: true });
}
