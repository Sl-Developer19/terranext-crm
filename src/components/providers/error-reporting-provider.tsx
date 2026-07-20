'use client';

import * as React from 'react';

/**
 * Global uncaught-error/rejection relay (Doc 23 §3 binding amendment, M1-E).
 * Catches what React's own error boundaries (`app/error.tsx`,
 * `app/global-error.tsx`) don't: errors outside the render tree — async
 * callbacks, event handlers, rejected promises. Mounted once in the root
 * layout so it covers the whole app regardless of route.
 */
export function ErrorReportingProvider() {
  React.useEffect(() => {
    const report = (message: string, stack?: string) => {
      const body = JSON.stringify({ message, stack, url: window.location.href });
      // sendBeacon survives page unload (a crash is often followed by one);
      // fetch keepalive is the fallback where sendBeacon isn't available.
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/errors/report', new Blob([body], { type: 'application/json' }));
      } else {
        void fetch('/api/errors/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    };

    const handleError = (event: ErrorEvent) => {
      report(event.message, event.error instanceof Error ? event.error.stack : undefined);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report(
        reason instanceof Error ? reason.message : String(reason),
        reason instanceof Error ? reason.stack : undefined,
      );
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
