/**
 * Next.js instrumentation hook (stable in Next 15) — the single integration
 * point for SSR/route-handler/server-action errors reaching Cloud Error
 * Reporting (Doc 23 §3 binding amendment, M1-E: "observability cannot wait
 * for M8").
 *
 * This file is bundled for *every* runtime (nodejs and edge — middleware
 * runs on Edge, and its presence forces an edge compilation of this file
 * too). `@google-cloud/error-reporting` pulls in Node core modules
 * (net/tls/stream/http) that don't exist in Edge, so the node-only import
 * happens only inside `register()`, gated by `NEXT_RUNTIME` — the pattern
 * Next's own multi-runtime instrumentation docs use for exactly this
 * (OpenTelemetry/Sentry-style Node-only setup) — and its result is cached in
 * a module-level closure `onRequestError` reads. Edge never populates it, so
 * middleware errors are a no-op here (middleware.ts is intentionally thin —
 * cookie verification only — so this is an acceptable gap, not a blind spot
 * on anything business-critical).
 */
import type { reportServerError as ReportServerError } from '@/lib/observability/error-reporter';

let reportServerError: typeof ReportServerError | null = null;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const mod = await import('@/lib/observability/error-reporter');
    reportServerError = mod.reportServerError;
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string },
  context: {
    routeType: 'render' | 'route' | 'action' | 'middleware';
  },
): Promise<void> {
  if (!reportServerError || context.routeType === 'middleware') return;

  const source =
    context.routeType === 'render'
      ? 'ssr'
      : context.routeType === 'action'
        ? 'server_action'
        : 'route_handler';
  reportServerError(error, { source, url: request.path });
}
