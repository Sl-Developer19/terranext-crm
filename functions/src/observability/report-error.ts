import { ErrorReporting } from '@google-cloud/error-reporting';

/**
 * Cloud Error Reporting for Functions (Doc 23 §3 binding amendment, M1-E).
 *
 * GCF 2nd gen already auto-reports *uncaught* exceptions to Error Reporting,
 * but our dead-letter pattern (Doc 19 §5) deliberately catches failures so a
 * scheduled job can log to `systemEvents` and exit cleanly rather than
 * crash-looping. That catch would otherwise make the failure invisible to
 * Error Reporting — this call is what keeps it visible.
 */

let reporter: ErrorReporting | null = null;

function getReporter(): ErrorReporting {
  reporter ??= new ErrorReporting({ reportMode: 'always' });
  return reporter;
}

export function reportFunctionError(error: unknown, functionName: string): void {
  try {
    const normalized = error instanceof Error ? error : new Error(String(error));
    const event = getReporter().event();
    event.setMessage(`[${functionName}] ${normalized.stack ?? normalized.message}`);
    getReporter().report(event);
  } catch (reportingFailure) {
    console.error('Failed to report error to Cloud Error Reporting', {
      functionName,
      originalError: error instanceof Error ? error.message : String(error),
      reportingFailure,
    });
  }
}
