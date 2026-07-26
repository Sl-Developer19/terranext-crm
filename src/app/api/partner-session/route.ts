import { NextResponse, type NextRequest } from 'next/server';

import { writeAudit } from '@/lib/audit/write';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { PARTNER_SESSION_COOKIE_NAME } from '@/lib/auth/partner-session';

/**
 * Partner session teardown (Doc 25, ADR-014) — mirrors DELETE /api/session.
 * Not covered by middleware (clears its own cookie; needs no valid session).
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get(PARTNER_SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(sessionCookie, false);
      await adminAuth().revokeRefreshTokens(decoded.uid);
      if (decoded.actorType === 'growth_partner') {
        const snap = await adminDb()
          .collection('growthPartners')
          .where('authUid', '==', decoded.uid)
          .limit(1)
          .get();
        const partnerId = snap.docs[0]?.id ?? decoded.uid;
        await writeAudit({
          actorUid: decoded.uid,
          actorRole: 'growth_partner',
          action: 'login',
          entityType: 'growth_partner',
          entityId: partnerId,
          entityPath: `growthPartners/${partnerId}`,
          context: { feature: 'growth-partners', reason: 'sign_out' },
        });
      }
    } catch {
      // Invalid cookie — nothing to revoke; still clear it below.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PARTNER_SESSION_COOKIE_NAME);
  return response;
}
