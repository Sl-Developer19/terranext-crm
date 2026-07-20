'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

/**
 * Segment-level error boundary (Doc 23 §3 binding amendment, M1-E) — catches
 * render errors anywhere under the root layout without losing the app
 * chrome. Reports to Cloud Error Reporting via the same relay endpoint
 * `ErrorReportingProvider` uses, then offers recovery (Next's `reset`
 * re-renders the segment) without a full page reload.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    void fetch('/api/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        The issue has been recorded. You can try again, or come back to this later.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
