import { NextResponse, type NextRequest } from 'next/server';

import { createPublicLead } from '@/features/leads/actions/create-public-lead';
import { PUBLIC_INTAKE } from '@/config/public-intake';

/**
 * Website → CRM lead intake (Doc 20 §2 `createLead`, BR-07, FR-07).
 *
 * Unauthenticated by design: the enquiry form is on the public marketing site,
 * which deploys independently (ADR-002). Four defences stand in for a session:
 *
 * 1. **Origin allow-list** — only the configured website origins may post.
 * 2. **Honeypot** — handled in the service; a filled trap looks like success.
 * 3. **Rate limits** — 20/IP/hour and 5/phone/day (Doc 20 §2).
 * 4. **App Check** — enforced at the Firebase layer once configured in the
 *    console; the header is forwarded but not verified here, since verifying
 *    it requires the console-side registration to exist first.
 *
 * The response never distinguishes "new lead" from "deduped into an existing
 * one" in a way the website must handle differently — both are a success.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && PUBLIC_INTAKE.allowedOrigins.includes(origin);
  return {
    // Echo only a known origin — never `*`, which would let any site post
    // enquiries into the CRM from a visitor's browser.
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Firebase-AppCheck',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Preflight for the cross-origin form post. */
export function OPTIONS(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

function clientIp(request: NextRequest): string {
  // App Hosting sits behind a proxy; the left-most X-Forwarded-For entry is
  // the original client. Falls back to a constant so the limiter still groups
  // requests rather than silently disabling itself.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  // In production an unknown origin is refused outright. Server-to-server
  // callers (and curl) send no Origin at all, which stays allowed so the
  // website's own SSR path and health checks keep working.
  if (origin && !PUBLIC_INTAKE.allowedOrigins.includes(origin)) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'permission', message: 'Origin not allowed.', retryable: false },
      },
      { status: 403, headers },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'validation', message: 'Malformed JSON body.', retryable: false },
      },
      { status: 400, headers },
    );
  }

  const result = await createPublicLead(body, {
    ip: clientIp(request),
    userAgent: request.headers.get('user-agent') ?? '',
  });

  if (result.ok) {
    return NextResponse.json(result, { status: 201, headers });
  }

  const status =
    result.error.code === 'validation'
      ? 422
      : result.error.code === 'rate_limited'
        ? 429
        : result.error.code === 'permission'
          ? 403
          : 500;

  return NextResponse.json(result, {
    status,
    headers: {
      ...headers,
      ...(result.error.code === 'rate_limited' ? { 'Retry-After': '3600' } : {}),
    },
  });
}
