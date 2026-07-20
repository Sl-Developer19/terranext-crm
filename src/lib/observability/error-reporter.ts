import 'server-only';

import { ErrorReporting } from '@google-cloud/error-reporting';

/**
 * Cloud Error Reporting wiring (Doc 23 §3 binding amendment, M1-E).
 * "Observability cannot wait for M8" — every server-side error path (SSR,
 * route handlers, server actions, middleware, and client errors relayed via
 * /api/errors/report) funnels through this one reporter.
 *
 * Auto-authenticates via Application Default Credentials — the same
 * mechanism `firebase-admin` already uses (Doc 10 §5: no service-account
 * keys in the repo).
 */

let reporter: ErrorReporting | null = null;

function getReporter(): ErrorReporting {
  reporter ??= new ErrorReporting({
    reportMode: process.env.NODE_ENV === 'production' ? 'production' : 'always',
    serviceContext: {
      service: 'terranext-crm',
      ...(process.env.npm_package_version ? { version: process.env.npm_package_version } : {}),
    },
  });
  return reporter;
}

export interface ErrorReportContext {
  /** Where the error originated — prefixed onto the reported message. */
  source: 'ssr' | 'route_handler' | 'server_action' | 'middleware' | 'client';
  uid?: string;
  url?: string;
}

/**
 * Reports an error to Cloud Error Reporting. Never throws — a reporting
 * failure must not become a second, worse failure on top of the original one.
 */
export function reportServerError(error: unknown, context: ErrorReportContext): void {
  try {
    const normalized = error instanceof Error ? error : new Error(String(error));
    const event = getReporter().event();
    event.setMessage(`[${context.source}] ${normalized.stack ?? normalized.message}`);
    if (context.uid) event.setUser(context.uid);
    if (context.url) event.setUrl(context.url);
    getReporter().report(event);
  } catch (reportingFailure) {
    // Last resort: structured stderr log so Cloud Logging still has it,
    // even if Error Reporting itself is unreachable.
    console.error('Failed to report error to Cloud Error Reporting', {
      originalError: error instanceof Error ? error.message : String(error),
      reportingFailure,
      context,
    });
  }
}
