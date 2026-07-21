import { NextResponse, type NextRequest } from 'next/server';

import { verifyCertificate } from '@/features/certificates/repository';

/**
 * Public certificate verification (Doc 19 §1 `verifyCertificate`).
 *
 * Unauthenticated by design — an employer checking a candidate's certificate
 * has no CRM account. Three properties matter here:
 *
 * 1. **No PII, ever.** The response carries the certificate number,
 *    programme, issue date, and status. Never the participant's name, phone,
 *    or anything else identifying — that is what makes a public endpoint
 *    over participant data acceptable at all.
 * 2. **No enumeration oracle.** A wrong number and a wrong hash return the
 *    identical `{valid: false}` shape, so the endpoint cannot be used to
 *    discover which certificate numbers exist.
 * 3. **Revocation is honoured.** A revoked certificate returns valid:false.
 *
 * Rate limiting is a deployment-layer concern (Doc 10 §5) and is listed in
 * the go-live hardening checklist rather than implemented here.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const certificateNo = request.nextUrl.searchParams.get('no')?.trim() ?? '';
  const hash = request.nextUrl.searchParams.get('hash')?.trim() ?? '';

  if (!certificateNo || !hash) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  try {
    const result = await verifyCertificate(certificateNo, hash);
    return NextResponse.json(result, {
      status: 200,
      // Short cache: verification results are stable, but a revocation
      // should take effect quickly rather than being cached for hours.
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch {
    // Never leak an internal failure shape to an anonymous caller.
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}
