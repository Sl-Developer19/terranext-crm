import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { adminAuth } from '@/lib/firebase/admin';
import { STAFF_ROLES, type BranchId, type StaffRole } from '@/types/common';

import { AUTH_SECURITY } from '@/config/auth-security';

// Single source for cookie policy is config/auth-security (ADR-013).
export const SESSION_COOKIE_NAME = AUTH_SECURITY.sessionCookie.name;
export const SESSION_DURATION_MS = AUTH_SECURITY.sessionCookie.maxAgeMs;

export interface Session {
  uid: string;
  email: string | null;
  role: StaffRole;
  branchId: BranchId;
}

function toStaffRole(value: unknown): StaffRole | null {
  return STAFF_ROLES.includes(value as StaffRole) ? (value as StaffRole) : null;
}

/**
 * Authoritative server-side session (Doc 10 §1). Verifies the Firebase
 * session cookie with revocation checking — a disabled/role-changed user
 * whose refresh tokens were revoked fails here immediately, which is the
 * per-request status enforcement promised in ADR-006.
 *
 * `cache()` deduplicates verification within a single request render.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const sessionCookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    const role = toStaffRole(decoded.role);
    // A token without a valid staff role claim is not a provisioned staff
    // member — treat as unauthenticated, never as a default role.
    if (!role) return null;
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      role,
      branchId: typeof decoded.branchId === 'string' ? decoded.branchId : 'HQ',
    };
  } catch {
    return null;
  }
});
