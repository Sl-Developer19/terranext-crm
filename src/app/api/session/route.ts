import { NextResponse, type NextRequest } from 'next/server';

import { writeAudit } from '@/lib/audit/write';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { adminAuth } from '@/lib/firebase/admin';
import { STAFF_ROLES, type StaffRole } from '@/types/common';

/**
 * Session teardown endpoint (Doc 10 §1 as amended by ADR-013).
 * DELETE: revoke refresh tokens + clear cookie.
 *
 * Session creation lives in POST /api/auth/login — the official
 * authentication entry point, where the brute-force lockout policy is
 * enforced before any credential check. The former POST (ID-token → cookie)
 * handler is gone with the client-direct sign-in flow it served.
 *
 * Not covered by middleware (clears its own cookie; needs no valid session).
 */

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(sessionCookie, false);
      await adminAuth().revokeRefreshTokens(decoded.uid);
      const role = STAFF_ROLES.includes(decoded.role as StaffRole)
        ? (decoded.role as StaffRole)
        : 'system';
      await writeAudit({
        actorUid: decoded.uid,
        actorRole: role,
        action: 'login',
        entityType: 'session',
        entityId: decoded.uid,
        entityPath: `users/${decoded.uid}`,
        context: { feature: 'auth', reason: 'sign_out' },
      });
    } catch {
      // Invalid cookie — nothing to revoke; still clear it below.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
