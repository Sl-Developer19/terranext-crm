import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { exportAuditLogs, fetchAuditLogs } from '@/features/audit/actions/fetch-audit-logs';
import { AuditLogsTable, listAuditLogs } from '@/features/audit';
import type { AuditLogEntry, AuditLogFilters } from '@/features/audit';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = {
  title: 'Audit Logs',
  description: 'Filterable audit event stream (SOP 17.16 registers)',
};

const DEFAULT_FILTERS: AuditLogFilters = {
  action: '',
  entityType: '',
  actorUid: '',
  dateFrom: '',
  dateTo: '',
};

/**
 * S52 — Audit Logs (Doc 16 S52, SOP 17.16).
 * Filterable stream over auditLogs; virtualized beyond ~100 rows (Doc 11 §7).
 * Only system_admin and founder may view audit logs (Doc 04 §3).
 */
export default async function AuditLogsPage() {
  const session = await requirePermission('audit:view');
  const canExport = can(session.role, 'audit:export');

  const initialEntries: AuditLogEntry[] = await listAuditLogs(DEFAULT_FILTERS);

  /**
   * Adapter for client-initiated filter changes: validates permission
   * server-side again (server action re-checks — never trust UI hide alone).
   * Returns raw entries because the client component manages display state.
   */
  async function handleFilterChange(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
    'use server';
    const result = await fetchAuditLogs(filters);
    return result.ok ? result.data : [];
  }

  /**
   * Export goes through `exportAuditLogs`, not the already-loaded rows, so
   * the export event itself is written to the audit trail (BR-06/SOP 17.16)
   * rather than silently downloading a CSV client-side.
   */
  async function handleExport(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
    'use server';
    const result = await exportAuditLogs(filters);
    return result.ok ? result.data : [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Immutable event stream for all business mutations. Use register presets for SOP 17.16 review views."
      />
      <Card>
        <CardContent className="p-4">
          <AuditLogsTable
            initialEntries={initialEntries}
            initialFilters={DEFAULT_FILTERS}
            onFilterChange={handleFilterChange}
            onExport={handleExport}
            canExport={canExport}
          />
        </CardContent>
      </Card>
    </div>
  );
}
