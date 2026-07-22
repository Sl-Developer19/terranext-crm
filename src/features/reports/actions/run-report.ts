'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import { toCsv } from '@/lib/utils/csv';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { runReport } from '../queries';
import {
  exportReportSchema,
  findReport,
  runReportSchema,
  type ExportReportInput,
  type ReportResult,
  type RunReportInput,
} from '../schema';

/**
 * Report execution and export (S42). Running a report is a read; exporting one
 * takes data out of the system, so it is audited on its own (SOP 17.16 — the
 * export register is itself a report).
 */

async function authorise(reportId: string) {
  const session = await getSession();
  if (!session) return { error: permissionError('Sign in required.') } as const;
  if (!can(session.role, 'reports:view')) return { error: permissionError() } as const;

  const definition = findReport(reportId);
  if (!definition) return { error: notFoundError('Report not found.') } as const;

  // A report may not become a side door into a module the caller cannot see.
  if (!can(session.role, definition.requires)) {
    return {
      error: permissionError('Your role cannot view the data behind this report.'),
    } as const;
  }

  return { session, definition } as const;
}

export async function runReportAction(input: RunReportInput): Promise<Result<ReportResult>> {
  const parsed = runReportSchema.safeParse(input);
  if (!parsed.success) return validationError({ reportId: 'Unknown report.' });

  const auth = await authorise(parsed.data.reportId);
  if ('error' in auth) return auth.error;

  try {
    return ok(await runReport(parsed.data.reportId));
  } catch {
    return internalError('Could not run the report. Please try again.');
  }
}

export async function exportReportAction(
  input: ExportReportInput,
): Promise<Result<{ csv: string; reportId: string }>> {
  const parsed = exportReportSchema.safeParse(input);
  if (!parsed.success) return validationError({ reportId: 'Unknown report.' });

  const auth = await authorise(parsed.data.reportId);
  if ('error' in auth) return auth.error;
  const { session, definition } = auth;

  if (!can(session.role, 'reports:export')) {
    return permissionError('Your role cannot export reports.');
  }

  try {
    const result = await runReport(definition.id);
    const csv = toCsv(definition.columns, result.rows);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'export',
      entityType: 'report',
      entityId: definition.id,
      entityPath: `reports/${definition.id}`,
      changes: { rowCount: { before: null, after: result.rows.length } },
      context: { feature: 'reports' },
    });

    return ok({ csv, reportId: definition.id });
  } catch {
    return internalError('Could not export the report. Please try again.');
  }
}
