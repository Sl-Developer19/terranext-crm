import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { STAFF_ROLES, type StaffRole } from '@/types/common';

import type { StaffUser } from './schema';

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

/** Directory read for /admin/users (Doc 16 S50). Excludes soft-deleted accounts. */
export async function listStaffUsers(): Promise<StaffUser[]> {
  const snap = await adminDb()
    .collection('users')
    .where('deletedAt', '==', null)
    .orderBy('displayName')
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    const role = STAFF_ROLES.includes(data.role as StaffRole)
      ? (data.role as StaffRole)
      : 'trainer';
    return {
      uid: doc.id,
      displayName: typeof data.displayName === 'string' ? data.displayName : '',
      email: typeof data.email === 'string' ? data.email : '',
      phone: typeof data.phone === 'string' ? data.phone : '',
      role,
      status: data.status === 'active' ? 'active' : 'disabled',
      assignedBatchIds: Array.isArray(data.assignedBatchIds) ? data.assignedBatchIds : [],
      lastLoginAt: toIso(data.lastLoginAt),
      mustChangePassword: data.mustChangePassword === true,
    };
  });
}
