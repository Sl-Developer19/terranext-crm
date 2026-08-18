import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { adminAuth } from '@/lib/firebase/admin';

import { AUTH_SECURITY } from '@/config/auth-security';

/**
 * Growth Partner session (Doc 25, ADR-014) — deliberately parallel to, not
 * shared with, `lib/auth/session.ts`. A partner token carries no `role`
 * claim, so `getSession()` never resolves one; this is the only place a
 * partner's identity is read.
 */
export const PARTNER_SESSION_COOKIE_NAME = AUTH_SECURITY.partnerSessionCookie.name;
export const PARTNER_SESSION_DURATION_MS = AUTH_SECURITY.partnerSessionCookie.maxAgeMs;

/**
 * Which identity collection `partnerId` belongs to (TCGN) — `actorType`
 * stays a single value (`growth_partner`) for every external-partner kind
 * forever (ADR-014); this is the one field that tells callers which
 * collection to query. Defaults to `'individual'` for every session minted
 * before this field existed — no claim migration required, no forced
 * re-login for existing Growth Partners.
 */
export type PartnerType = 'individual' | 'community_business';

export interface PartnerSession {
  uid: string;
  email: string | null;
  partnerId: string;
  partnerType: PartnerType;
  status: 'active' | 'suspended';
}

/**
 * Authoritative server-side partner session. Verifies the session cookie
 * with revocation checking (ADR-006 pattern) — a suspended partner's
 * already-issued cookie fails here immediately, same as `setUserStatus` does
 * for staff. `cache()` deduplicates verification within a single request.
 */
export const getPartnerSession = cache(async (): Promise<PartnerSession | null> => {
  const store = await cookies();
  const sessionCookie = store.get(PARTNER_SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    if (decoded.actorType !== 'growth_partner') return null;
    const partnerId = decoded.partnerId;
    if (typeof partnerId !== 'string' || partnerId === '') return null;
    const status = decoded.partnerStatus === 'active' ? 'active' : 'suspended';
    // A suspended partner's token still verifies (revocation only kills
    // sessions minted *before* the suspension); this refuses it anyway so a
    // still-valid cookie issued moments before suspension can't slip through.
    // Blocks rejected/suspended Community Partners exactly the same way it
    // already blocks suspended Growth Partners — no kind-specific branch.
    if (status !== 'active') return null;
    const partnerType: PartnerType =
      decoded.partnerType === 'community_business' ? 'community_business' : 'individual';

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      partnerId,
      partnerType,
      status,
    };
  } catch {
    return null;
  }
});
