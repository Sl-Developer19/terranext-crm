import { NextResponse, type NextRequest } from 'next/server';

import { verifyCertificate } from '@/features/certificates/repository';
import { clientIpFromHeaders } from '@/lib/auth/identity';
import { consumeRateLimit, HOUR_MS } from '@/lib/rate-limit/fixed-window';

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
 * Rate-limited per IP (Doc 27 §2.2, go-live hardening): the response is
 * already enumeration-safe, so this guards cost/availability, not secrecy —
 * generous enough for a legitimate employer checking several candidates.
 */
const PER_IP_PER_HOUR = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = clientIpFromHeaders(request.headers);
  const verdict = await consumeRateLimit({
    scope: 'certVerify_ip',
    identifier: ip,
    limit: PER_IP_PER_HOUR,
    windowMs: HOUR_MS,
  });
  if (!verdict.allowed) {
    return NextResponse.json(
      { valid: false },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
    );
  }

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
