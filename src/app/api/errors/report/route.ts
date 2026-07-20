import { NextResponse, type NextRequest } from 'next/server';

import { clientErrorReportSchema } from '@/lib/observability/client-error-schema';
import { reportServerError } from '@/lib/observability/error-reporter';
import { getSession } from '@/lib/auth/session';
import { ERROR_HTTP_STATUS } from '@/lib/utils/result';

/**
 * Client-error relay (Doc 23 §3 binding amendment, M1-E). Browsers cannot
 * hold GCP credentials, so uncaught client exceptions are POSTed here and
 * reported to Cloud Error Reporting server-side. Deliberately unauthenticated
 * (an error can occur before/without a session, e.g. on the login screen)
 * — the schema length-caps every field against payload abuse.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = clientErrorReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation', message: 'Invalid report.', retryable: false } },
      { status: ERROR_HTTP_STATUS.validation },
    );
  }

  // Best-effort actor attribution — a missing/invalid session must not
  // block reporting (the error may be the reason the session looks odd).
  const session = await getSession().catch(() => null);
  const { message, stack, url } = parsed.data;

  reportServerError(new Error(stack ?? message), {
    source: 'client',
    ...(session?.uid ? { uid: session.uid } : {}),
    ...(url ? { url } : {}),
  });

  return NextResponse.json({ ok: true, data: { status: 'reported' } });
}
