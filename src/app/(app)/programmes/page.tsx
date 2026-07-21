import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { CatalogueView, listAcademies, listProgrammes } from '@/features/catalogue';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Programmes' };

/** S22 — programme and academy catalogue (Doc 16). */
export default async function ProgrammesPage() {
  const session = await requirePermission('programmes:view');
  const [academies, programmes] = await Promise.all([listAcademies(), listProgrammes()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes"
        description="The catalogue every enrolment, batch, and certificate references. Certificate thresholds and default fee plans are configured per programme."
      />
      <CatalogueView
        academies={academies}
        programmes={programmes}
        canManage={can(session.role, 'programmes:update')}
      />
    </div>
  );
}
