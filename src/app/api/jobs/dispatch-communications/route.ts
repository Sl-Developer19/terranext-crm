import { NextResponse, type NextRequest } from 'next/server';

import { dispatchQueuedCommunications } from '@/features/communications/dispatch';
import { isAuthorisedJobRequest } from '@/lib/jobs/authorise';

/**
 * Scheduled communications dispatch (Doc 19 §4). Cloud Scheduler POSTs here
 * every 5 minutes with the `JOBS_SECRET` bearer token.
 *
 * Idempotent by construction: it only ever moves `queued` rows forward, so a
 * duplicate invocation (Scheduler retries on non-2xx) finds nothing left due
 * and does nothing. That is why it returns 200 with a summary even when the
 * queue is empty.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorisedJobRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }

  try {
    const summary = await dispatchQueuedCommunications();
    return NextResponse.json({ ok: true, data: summary }, { status: 200 });
  } catch (error) {
    // A 500 tells Scheduler to retry, which is the behaviour we want for an
    // infrastructure blip. The queue is unchanged for anything not processed.
    const message = error instanceof Error ? error.message : 'dispatch failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
