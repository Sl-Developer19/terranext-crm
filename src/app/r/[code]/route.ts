import { NextResponse, type NextRequest } from 'next/server';

import { recordCommunityPartnerScan } from '@/features/community-partners';
import { recordGrowthPartnerScan } from '@/features/growth-partners';
import { PUBLIC_SITE_ORIGIN } from '@/config/public-intake';

/**
 * QR Referral redirect (TCGN, Feature 6) — the endpoint every printed
 * Community Partner QR code points to. Deliberately stateless and
 * best-effort: the redirect itself must never fail or be delayed by a
 * Firestore hiccup (same "never lose an enquiry" posture as `createLead`) —
 * a garbage/mistyped/expired code still forwards the visitor to the public
 * registration page, just without a referral credited. Actual code
 * resolution and the active/inactive distinction happen later, at
 * `createPublicLead` (lead-submission time) — this route never rejects a
 * code, it only forwards it and records a best-effort scan.
 *
 * Serves both partner kinds: a Community Partner code ("TCGN-000001") and an
 * individual Growth Partner code ("TGP-000001") share this one redirect,
 * dispatched by prefix so a scan is recorded against whichever collection
 * could actually own the code, not queried against both on every hit.
 *
 * Unauthenticated by design (excluded from `middleware.ts`'s matcher) — a
 * stranger scanning a poster has no CRM session, partner or staff.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;

  const target = new URL('/apply', PUBLIC_SITE_ORIGIN);
  if (code) target.searchParams.set('ref', code);

  // Best-effort only — never let a Firestore error block the redirect a
  // real customer is waiting on. Prefix dispatch, not a lookup-then-decide:
  // an unrecognised prefix records nothing, same "silent no-op" posture
  // either scan function already has for an unknown code within its own kind.
  if (code) {
    const scan = code.startsWith('TCGN-') ? recordCommunityPartnerScan : recordGrowthPartnerScan;
    await scan(code).catch(() => undefined);
  }

  return NextResponse.redirect(target, { status: 302 });
}
