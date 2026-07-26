import { NextResponse, type NextRequest } from 'next/server';

import { clientIpFromHeaders } from '@/lib/auth/identity';
import { loginSchema } from '@/features/auth';
import { partnerLoginServiceDeps } from '@/lib/auth/partner-login-runtime';
import { PARTNER_SESSION_COOKIE_NAME } from '@/lib/auth/partner-session';
import { performLogin } from '@/lib/auth/login-service';
import { ERROR_HTTP_STATUS } from '@/lib/utils/result';

/**
 * Growth Partner authentication entry point (Doc 25, ADR-014) — the partner
 * counterpart to `/api/auth/login`, reusing the exact same `performLogin`
 * orchestration (lockout policy, enumeration-resistant messaging) with a
 * partner-scoped directory/session/audit wiring. Sets the separate
 * `__partner_session` cookie so a staff and a partner session never collide.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  let email: string;
  let password: string;
  try {
    const parsed = loginSchema.parse(await request.json());
    email = parsed.email;
    password = parsed.password;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'validation',
          message: 'Enter a valid email address and password.',
          retryable: false,
        },
      },
      { status: ERROR_HTTP_STATUS.validation },
    );
  }

  const outcome = await performLogin(partnerLoginServiceDeps(), {
    email,
    password,
    ip: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  });

  switch (outcome.kind) {
    case 'authenticated': {
      const response = NextResponse.json({ ok: true, data: { status: 'authenticated' } });
      response.cookies.set(PARTNER_SESSION_COOKIE_NAME, outcome.sessionCookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: outcome.sessionCookie.maxAgeMs / 1000,
      });
      return response;
    }
    case 'rejected': {
      const { error } = outcome.result.ok ? { error: null } : outcome.result;
      const response = NextResponse.json(
        { ok: false, error },
        { status: error ? ERROR_HTTP_STATUS[error.code] : 500 },
      );
      if (outcome.retryAfterSeconds !== undefined) {
        response.headers.set('Retry-After', String(outcome.retryAfterSeconds));
      }
      return response;
    }
  }
}
