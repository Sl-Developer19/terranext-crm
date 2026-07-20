import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { finalizeTotpEnrollment, startTotpEnrollment } from '@/lib/auth/mfa-service';

/**
 * MFA TOTP enrollment (Doc 10 §1).
 *
 * GET  /api/auth/mfa/enroll — initiates enrollment, returns secret + QR URI
 * POST /api/auth/mfa/enroll — finalises enrollment with a verified code
 *
 * The enrollment flow:
 * 1. GET: server generates a TOTP secret, returns it as a QR code URI and
 *    a base32 secret for manual entry. The session must be valid.
 * 2. POST: client submits a code from the authenticator app. On success,
 *    the `mfaEnrolled: true` custom claim is set. The session cookie stays;
 *    next verification call will see the new claim.
 *
 * Only the signed-in user can enroll their own account.
 * Audit: enrollment events are written as `permission_change` on users/{uid}.
 */

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'unauthenticated', message: 'Sign in required.', retryable: false },
      },
      { status: 401 },
    );
  }

  try {
    const { qrCodeUri, totpSecret, sessionInfo } = await startTotpEnrollment(
      session.uid,
      session.email ?? session.uid,
    );

    return NextResponse.json({
      ok: true,
      data: {
        qrCodeUri,
        totpSecret,
        sessionInfo,
        message:
          'Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.',
      },
    });
  } catch (err) {
    console.error('MFA enrollment start failed', err);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'unavailable',
          message: 'Could not start MFA enrollment. Please try again.',
          retryable: true,
        },
      },
      { status: 503 },
    );
  }
}

const finalizeSchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
  sessionInfo: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'unauthenticated', message: 'Sign in required.', retryable: false },
      },
      { status: 401 },
    );
  }

  let totpCode: string;
  let sessionInfo: string;
  try {
    const parsed = finalizeSchema.parse(await request.json());
    totpCode = parsed.totpCode;
    sessionInfo = parsed.sessionInfo;
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

  const result = await finalizeTotpEnrollment(session.uid, totpCode, sessionInfo);

  if (result.status === 'invalid_code') {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'unauthenticated',
          message: 'Invalid code. Ensure your device clock is synced and try again.',
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
          message: 'Enrollment failed. Please try again.',
          retryable: true,
        },
      },
      { status: 503 },
    );
  }

  // Audit the enrollment event (BR-06, Doc 14 §4)
  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'permission_change',
    entityType: 'user',
    entityId: session.uid,
    entityPath: `users/${session.uid}`,
    changes: { mfaEnrolled: { before: false, after: true } },
    context: { feature: 'auth' },
  });

  return NextResponse.json({
    ok: true,
    data: { status: 'enrolled', message: 'MFA has been enabled for your account.' },
  });
}
