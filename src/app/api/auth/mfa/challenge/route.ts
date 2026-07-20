import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyTotpChallenge } from '@/lib/auth/mfa-service';
import { verifyMfaPendingToken } from '@/lib/auth/mfa-token';
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from '@/lib/auth/session';
import { adminAuth } from '@/lib/firebase/admin';

/**
 * MFA challenge finalisation (Doc 10 §1 TOTP flow).
 *
 * Accepts: { mfaToken: string, totpCode: string }
 * - mfaToken: the short-lived JWT issued by /api/auth/login on mfa_required
 * - totpCode: 6-digit TOTP code from the user's authenticator app
 *
 * On success: mints a session cookie and returns { status: 'authenticated' }.
 * On failure: returns 401 with { status: 'invalid_code' }.
 *
 * Brute-force protection: the login lockout policy is NOT re-applied here
 * because the mfaToken has a 5-minute TTL and the Identity Toolkit enforces
 * its own TOTP attempt limit internally.
 */

const challengeSchema = z.object({
  mfaToken: z.string().min(1),
  totpCode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit code'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let mfaToken: string;
  let totpCode: string;

  try {
    const parsed = challengeSchema.parse(await request.json());
    mfaToken = parsed.mfaToken;
    totpCode = parsed.totpCode;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'validation',
          message: 'Enter the 6-digit code from your authenticator app.',
          retryable: true,
        },
      },
      { status: 400 },
    );
  }

  // Verify the short-lived MFA pending token
  const pending = await verifyMfaPendingToken(mfaToken);
  if (!pending) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'unauthenticated',
          message: 'The MFA session has expired. Please sign in again.',
          retryable: false,
        },
      },
      { status: 401 },
    );
  }

  // Verify the TOTP code against the Identity Toolkit
  const result = await verifyTotpChallenge(
    pending.mfaPendingCredential,
    totpCode,
    pending.mfaEnrollmentId,
  );

  if (result.status === 'invalid_code') {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'unauthenticated',
          message: 'Invalid or expired code. Check your authenticator app and try again.',
          retryable: true,
        },
      },
      { status: 401 },
    );
  }

  if (result.status === 'error') {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'unavailable',
          message: 'Authentication service unavailable. Please try again.',
          retryable: true,
        },
      },
      { status: 503 },
    );
  }

  // TOTP verified — mint a session cookie
  const sessionCookie = await adminAuth().createSessionCookie(result.idToken, {
    expiresIn: SESSION_DURATION_MS,
  });

  const response = NextResponse.json({ ok: true, data: { status: 'authenticated' } });
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return response;
}
