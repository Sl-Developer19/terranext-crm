import 'server-only';

import { redirect } from 'next/navigation';

import { getPartnerSession, type PartnerSession } from '@/lib/auth/partner-session';

/**
 * Route-level guard for `/partner/*` (Doc 25, ADR-014) — the partner-portal
 * counterpart to `requirePermission`. There is no module/action matrix here:
 * a Growth Partner's only authorization question is "signed in and active,"
 * row-level scoping to `partnerId` handles the rest.
 */
export async function requirePartnerSession(): Promise<PartnerSession> {
  const session = await getPartnerSession();
  if (!session) redirect('/partner/login');
  return session;
}
