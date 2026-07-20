import { NextResponse, type NextRequest } from 'next/server';

import { clientIpFromHeaders } from '@/lib/auth/identity';
import { loginServiceDeps } from '@/lib/auth/login-runtime';
import { performLogin } from '@/lib/auth/login-service';
import { AUTH_MESSAGES } from '@/lib/auth/messages';
import { signMfaPendingToken } from '@/lib/auth/mfa-token';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { ERROR_HTTP_STATUS } from '@/lib/utils/result';
import { loginSchema } from '@/features/auth';

/**
 * Official authentication entry point (Doc 10 §1 as amended by ADR-013,
 * Doc 20 §5). The password stage runs server-side so the brute-force
 * lockout policy governs every attempt; on success the response sets the
 * `__session` cookie directly — no client-side Firebase sign-in involved.
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

  const outcome = await performLogin(loginServiceDeps(), {
    email,
    password,
    ip: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  });

  switch (outcome.kind) {
    case 'authenticated': {
      const response = NextResponse.json({ ok: true, data: { status: 'authenticated' } });
      response.cookies.set(SESSION_COOKIE_NAME, outcome.sessionCookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: outcome.sessionCookie.maxAgeMs / 1000,
      });
      return response;
    }
    case 'mfa_required': {
      // Issue a short-lived signed token the client uses to POST to /api/auth/mfa/challenge.
      // The client must include this token + the TOTP code; the route verifies
      // the token signature before calling the Identity Toolkit finalize endpoint.
      const mfaToken = await signMfaPendingToken({
        mfaPendingCredential: outcome.mfaPendingCredential,
        mfaEnrollmentId: outcome.mfaEnrollmentId,
      });
      return NextResponse.json(
        {
          ok: true,
          data: { status: 'mfa_required', mfaToken, message: AUTH_MESSAGES.mfaRequired },
        },
        { status: 200 },
      );
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
