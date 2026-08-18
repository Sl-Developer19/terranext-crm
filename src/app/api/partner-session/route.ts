import { NextResponse, type NextRequest } from 'next/server';

import { writeAudit } from '@/lib/audit/write';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import {
  PARTNER_AUDIT_ENTITY_TYPE,
  PARTNER_COLLECTION_BY_TYPE,
  PARTNER_FEATURE_NAME,
} from '@/lib/auth/partner-directory';
import { PARTNER_SESSION_COOKIE_NAME } from '@/lib/auth/partner-session';

/**
 * Partner session teardown (Doc 25, ADR-014; extended for TCGN) — mirrors
 * DELETE /api/session. Not covered by middleware (clears its own cookie;
 * needs no valid session).
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get(PARTNER_SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(sessionCookie, false);
      await adminAuth().revokeRefreshTokens(decoded.uid);
      if (decoded.actorType === 'growth_partner') {
        // The decoded token already carries `partnerType` (minted at
        // approval — Doc 25 §2, TCGN Feature 3), so which collection to
        // audit against is read directly from it rather than trying both.
        const partnerType =
          decoded.partnerType === 'community_business' ? 'community_business' : 'individual';
        const collection = PARTNER_COLLECTION_BY_TYPE[partnerType];

        const snap = await adminDb()
          .collection(collection)
          .where('authUid', '==', decoded.uid)
          .limit(1)
          .get();
        const partnerId = snap.docs[0]?.id ?? decoded.uid;
        await writeAudit({
          actorUid: decoded.uid,
          actorRole: 'growth_partner',
          action: 'login',
          entityType: PARTNER_AUDIT_ENTITY_TYPE[collection],
          entityId: partnerId,
          entityPath: `${collection}/${partnerId}`,
          context: { feature: PARTNER_FEATURE_NAME[collection], reason: 'sign_out' },
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
