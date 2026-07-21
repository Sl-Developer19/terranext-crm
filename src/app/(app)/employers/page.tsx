import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmployerDialog, EmployersTable, listEmployers } from '@/features/employers';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Employers' };

/** S32 — employer directory (Doc 16). */
export default async function EmployersPage() {
  const session = await requirePermission('employers:view');
  const rows = await listEmployers();
  const canManage = can(session.role, 'employers:update');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employers"
        description="Employers who receive candidates through the placements pipeline. TerraNext charges no placement fee to the student or family (BR-08)."
        actions={can(session.role, 'employers:create') ? <EmployerDialog /> : undefined}
      />
      <Card>
        <CardContent className={rows.length === 0 ? undefined : 'p-0'}>
          <EmployersTable rows={rows} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
