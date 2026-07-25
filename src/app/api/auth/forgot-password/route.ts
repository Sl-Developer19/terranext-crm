import { NextResponse, type NextRequest } from 'next/server';

import { forgotPasswordSchema } from '@/features/auth';
import { forgotPasswordServiceDeps } from '@/lib/auth/forgot-password-runtime';
import { performForgotPassword } from '@/lib/auth/forgot-password-service';
import { clientIpFromHeaders } from '@/lib/auth/identity';
import { ERROR_HTTP_STATUS } from '@/lib/utils/result';

/**
 * Password-reset request entry point (Doc 10 §1 extension). Public by
 * design (Doc 20 §5 pattern) — no session exists yet. Always returns the
 * same generic response regardless of whether the email has an account.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let email: string;
  try {
    email = forgotPasswordSchema.parse(await request.json()).email;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'validation', message: 'Enter a valid email address.', retryable: false },
      },
      { status: ERROR_HTTP_STATUS.validation },
    );
  }

  const result = await performForgotPassword(forgotPasswordServiceDeps(), {
    email,
    appOrigin: request.nextUrl.origin,
    ip: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, data: result.data });
  }
  return NextResponse.json(
    { ok: false, error: result.error },
    { status: ERROR_HTTP_STATUS[result.error.code] },
  );
}
