import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { REPORT_CATALOGUE, ReportsCentre } from '@/features/reports';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Reports' };

/** S42 — reports centre (Doc 16). */
export default async function ReportsPage() {
  const session = await requirePermission('reports:view');

  // A report is only offered when the caller can already see the module behind
  // it — the reports centre must not become a side door around module scoping.
  const available = REPORT_CATALOGUE.filter((report) => can(session.role, report.requires)).map(
    (report) => report.id,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="The reports the business rules call for. Figures are computed live from current records; exports are recorded in the audit trail."
      />
      <ReportsCentre available={available} canExport={can(session.role, 'reports:export')} />
    </div>
  );
}
