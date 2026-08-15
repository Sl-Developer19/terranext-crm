import { NextResponse, type NextRequest } from 'next/server';

import { forgotPasswordSchema } from '@/features/auth';
import { getBrandingSettings } from '@/features/settings';
import { forgotPasswordServiceDeps } from '@/lib/auth/forgot-password-runtime';
import { performForgotPassword } from '@/lib/auth/forgot-password-service';
import { clientIpFromHeaders } from '@/lib/auth/identity';
import { consumeRateLimit, HOUR_MS } from '@/lib/rate-limit/fixed-window';
import { ERROR_HTTP_STATUS } from '@/lib/utils/result';

/**
 * Password-reset request entry point (Doc 10 §1 extension). Public by
 * design (Doc 20 §5 pattern) — no session exists yet. Always returns the
 * same generic response regardless of whether the email has an account.
 *
 * Rate-limited per IP (Doc 27 §2.3): the response is already
 * enumeration-safe, so this guards against bulk-triggering reset emails to
 * arbitrary addresses (cost/reputation risk with the mail provider), not
 * account takeover.
 */
const PER_IP_PER_HOUR = 5;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = clientIpFromHeaders(request.headers);
  const verdict = await consumeRateLimit({
    scope: 'forgotPassword_ip',
    identifier: ip,
    limit: PER_IP_PER_HOUR,
    windowMs: HOUR_MS,
  });
  if (!verdict.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'rate_limited',
          message: 'Too many requests. Please try again later.',
          retryable: true,
        },
      },
      {
        status: ERROR_HTTP_STATUS.rate_limited,
        headers: { 'Retry-After': String(verdict.retryAfterSeconds) },
      },
    );
  }

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

  const branding = await getBrandingSettings();
  const result = await performForgotPassword(
    forgotPasswordServiceDeps(branding.emailLogoUrl || undefined),
    {
      email,
      appOrigin: request.nextUrl.origin,
      ip: clientIpFromHeaders(request.headers),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  );

  if (result.ok) {
    return NextResponse.json({ ok: true, data: result.data });
  }
  return NextResponse.json(
    { ok: false, error: result.error },
    { status: ERROR_HTTP_STATUS[result.error.code] },
  );
}
