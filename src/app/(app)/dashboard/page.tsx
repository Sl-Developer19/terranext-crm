import type { Metadata } from 'next';
import { format } from 'date-fns';

import { PageHeader } from '@/components/layout/page-header';
import { DashboardSections, getDashboard } from '@/features/dashboard';
import { STAFF_ROLE_LABELS } from '@/lib/rbac/role-labels';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * S03 — the role-scoped CRM dashboard (SOP 15.9), and for the founder the
 * full SOP 18.10 KPI set.
 *
 * Figures are computed per request rather than cached: the SOP asks for
 * "real-time operational insights", and the aggregate reads are cheap enough
 * (Firestore `count()`) that caching would trade correctness for very little.
 */
export default async function DashboardPage() {
  const session = await requirePermission('dashboard:view');
  const dashboard = await getDashboard(session.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${STAFF_ROLE_LABELS[session.role]} · figures as at ${format(
          new Date(dashboard.generatedAt),
          'PPp',
        )}`}
      />
      <DashboardSections sections={dashboard.sections} />
    </div>
  );
}
