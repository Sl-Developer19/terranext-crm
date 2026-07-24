'use client';

import * as React from 'react';

/**
 * Root-layout error boundary (Doc 23 §3 binding amendment, M1-E) — only
 * fires when the root layout itself throws (rare; `app/error.tsx` handles
 * everything else). Next.js requires this file to render its own
 * `<html>`/`<body>` since it replaces the root layout entirely.
 */
export default function GlobalError({
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
    <html lang="en">
      <body style={{ margin: 0, background: '#050505', color: '#fff' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '2rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#b8b8b8', maxWidth: '24rem', margin: 0, fontSize: '0.875rem' }}>
            The issue has been recorded. Please refresh the page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '0.5rem',
              background: '#C9A227',
              color: '#050505',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
