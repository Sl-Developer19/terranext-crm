import { NextResponse, type NextRequest } from 'next/server';

import { markOverdueInstallments } from '@/features/fees/jobs/mark-overdue';
import { buildFollowUpDigests } from '@/features/leads/jobs/follow-up-digest';
import { isAuthorisedJobRequest } from '@/lib/jobs/authorise';

/**
 * Daily maintenance jobs (Doc 19 §4): `markOverdueInstallments` (01:00 IST)
 * and `followUpDigest` (08:00 IST).
 *
 * Both run behind one endpoint selected by `?job=`, rather than one route per
 * job, because Cloud Scheduler configuration is the thing that differs — the
 * authorisation, error handling and reporting are identical.
 *
 * Each job is independent: one failing must not prevent the other from being
 * run by its own schedule, so they are never invoked together.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const JOBS = {
  'mark-overdue': markOverdueInstallments,
  'follow-up-digest': buildFollowUpDigests,
} as const;

type JobName = keyof typeof JOBS;

function isJobName(value: string | null): value is JobName {
  return value !== null && value in JOBS;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorisedJobRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }

  const job = request.nextUrl.searchParams.get('job');
  if (!isJobName(job)) {
    return NextResponse.json(
      { ok: false, error: `Unknown job. Expected one of: ${Object.keys(JOBS).join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const summary = await JOBS[job]();
    return NextResponse.json({ ok: true, job, data: summary }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'job failed';
    return NextResponse.json({ ok: false, job, error: message }, { status: 500 });
  }
}
