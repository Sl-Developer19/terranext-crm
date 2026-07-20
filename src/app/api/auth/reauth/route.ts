import { NextResponse, type NextRequest } from 'next/server';

import { reauthSchema } from '@/features/auth';
import { clientIpFromHeaders } from '@/lib/auth/identity';
import { reauthServiceDeps } from '@/lib/auth/reauth-runtime';
import { performReauth } from '@/lib/auth/reauth-service';
import { getSession } from '@/lib/auth/session';
import { ERROR_HTTP_STATUS } from '@/lib/utils/result';

/**
 * Idle-timeout unlock endpoint (Doc 10 §1 addendum, M1-B). Requires an
 * already-valid `__session` cookie — the email re-checked here is the
 * session's own (never client-submitted), and the resulting password
 * verification must match the session's own uid. No session cookie is
 * minted or replaced; this only tells the client it may clear its lock.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session || !session.email) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'unauthenticated', message: 'Sign in required.', retryable: false },
      },
      { status: ERROR_HTTP_STATUS.unauthenticated },
    );
  }

  let password: string;
  try {
    password = reauthSchema.parse(await request.json()).password;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'validation', message: 'Enter your password.', retryable: false },
      },
      { status: ERROR_HTTP_STATUS.validation },
    );
  }

  const outcome = await performReauth(reauthServiceDeps(), {
    sessionUid: session.uid,
    sessionRole: session.role,
    email: session.email,
    password,
    ip: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  });

  if (outcome.kind === 'unlocked') {
    return NextResponse.json({ ok: true, data: { status: 'unlocked' } });
  }

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
