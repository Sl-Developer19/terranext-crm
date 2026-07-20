'use server';

import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import { permissionError, type Result, ok } from '@/lib/utils/result';
import { writeAudit } from '@/lib/audit/write';

import { listAuditLogs } from '@/features/audit/queries';
import type { AuditLogEntry, AuditLogFilters } from '@/features/audit/schema';

/**
 * Server action: re-fetches audit logs with new filter dimensions.
 * Called by the client-side AuditLogsTable when filters change.
 * Only system_admin and founder may call this (audit:view).
 */
export async function fetchAuditLogs(filters: AuditLogFilters): Promise<Result<AuditLogEntry[]>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'audit:view')) return permissionError();

  const entries = await listAuditLogs(filters);
  return ok(entries);
}

/**
 * Server action: records an export event and returns the entries for download.
 * Only system_admin may export (audit:export — Doc 04 §3).
 */
export async function exportAuditLogs(filters: AuditLogFilters): Promise<Result<AuditLogEntry[]>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'audit:export')) return permissionError();

  const entries = await listAuditLogs(filters);

  // BR-06: the export action itself is audited (SOP 17.16 System Access Log)
  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'export',
    entityType: 'user', // audit logs export uses 'user' as a proxy entity type
    entityId: 'auditLogs',
    entityPath: 'auditLogs',
    changes: {
      filters: { before: null, after: filters },
      rowCount: { before: null, after: entries.length },
    },
    context: { feature: 'audit' },
  });

  return ok(entries);
}
