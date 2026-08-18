import { NextResponse, type NextRequest } from 'next/server';

import { registerPublicCommunityPartner } from '@/features/community-partners/actions/register-public-community-partner';
import { PUBLIC_INTAKE } from '@/config/public-intake';

/**
 * Website → CRM Community Partner Registration intake (TCGN), mirrors
 * `/api/registerGrowthPartner` and `/api/createLead`.
 *
 * Unauthenticated by design: the registration form is on the public
 * marketing site, which deploys independently (ADR-002). Same defences as
 * `createLead`/`registerGrowthPartner` — origin allow-list, honeypot, rate
 * limits.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && PUBLIC_INTAKE.allowedOrigins.includes(origin);
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Firebase-AppCheck',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function OPTIONS(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

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

  const result = await registerPublicCommunityPartner(body, {
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
          : result.error.code === 'conflict'
            ? 409
            : 500;

  return NextResponse.json(result, {
    status,
    headers: {
      ...headers,
      ...(result.error.code === 'rate_limited' ? { 'Retry-After': '3600' } : {}),
    },
  });
}
