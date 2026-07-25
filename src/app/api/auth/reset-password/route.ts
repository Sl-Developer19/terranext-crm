import { NextResponse, type NextRequest } from 'next/server';

import { resetPasswordSchema } from '@/features/auth';
import { clientIpFromHeaders } from '@/lib/auth/identity';
import { resetPasswordServiceDeps } from '@/lib/auth/reset-password-runtime';
import { performResetPassword } from '@/lib/auth/reset-password-service';
import { ERROR_HTTP_STATUS } from '@/lib/utils/result';

/**
 * Password-reset confirmation (Doc 10 §1 extension). Public by design — the
 * caller has no session yet; the oobCode from the emailed link is the proof
 * of authorization, verified against Identity Toolkit inside the service.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let oobCode: string;
  let newPassword: string;
  try {
    const parsed = resetPasswordSchema.parse(await request.json());
    oobCode = parsed.oobCode;
    newPassword = parsed.newPassword;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'validation', message: 'Enter a valid new password.', retryable: false },
      },
      { status: ERROR_HTTP_STATUS.validation },
    );
  }

  const result = await performResetPassword(resetPasswordServiceDeps(), {
    oobCode,
    newPassword,
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
