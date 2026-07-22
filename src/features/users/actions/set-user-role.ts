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

import { isSelfTargeting, leavesProtectedRole, wouldStrandPlatform } from '../logic';
import { setUserRoleSchema, type SetUserRoleInput } from '../schema';

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

/** Doc 19 setUserRole — precondition: never strand the platform without a System Administrator. */
export async function setUserRole(input: SetUserRoleInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'users:update')) return permissionError();

  const parsed = setUserRoleSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Select a valid role.' });
  const { uid, role, assignedBatchIds } = parsed.data;

  if (isSelfTargeting(session.uid, uid)) {
    return err({
      code: 'precondition',
      message: 'You cannot change your own role. Ask another system administrator.',
      retryable: false,
    });
  }

  const db = adminDb();
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return notFoundError('This staff account no longer exists.');
  const before = snap.get('role') as StaffRole;

  // Guards the seat being *vacated*, not the one being taken: demoting the
  // last Founder to system_admin still strands the platform's super-admin.
  if (leavesProtectedRole(before, role)) {
    const remaining = await countOtherActiveHolders(before, uid);
    if (wouldStrandPlatform(remaining)) {
      return err({
        code: 'precondition',
        message: `This is the last active ${ROLE_LABEL[before] ?? before} — promote another account before changing this role.`,
        retryable: false,
      });
    }
  }

  await adminAuth().setCustomUserClaims(uid, { role, branchId: session.branchId });
  await ref.update({
    role,
    assignedBatchIds,
    updatedAt: new Date(),
    updatedBy: session.uid,
  });
  // Claims change; force re-authentication rather than waiting out the token TTL.
  await adminAuth().revokeRefreshTokens(uid);

  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'permission_change',
    entityType: 'user',
    entityId: uid,
    entityPath: `users/${uid}`,
    changes: { role: { before, after: role } },
    context: { feature: 'users' },
  });

  return ok({ ok: true });
}
