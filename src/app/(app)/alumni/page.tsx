import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { AlumniOverrideDialog, AlumniTable, listAlumniRecords } from '@/features/alumni';
import { Card, CardContent } from '@/components/ui/card';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Alumni' };

/** S33 — alumni registry (Doc 16, BR-05). */
export default async function AlumniPage() {
  const session = await requirePermission('alumni:view');
  const rows = await listAlumniRecords();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumni"
        description="Membership is granted automatically on certification (BR-05) — this registry tracks ongoing engagement and success-story consent."
        actions={can(session.role, 'alumni:configure') ? <AlumniOverrideDialog /> : undefined}
      />
      <Card>
        <CardContent className={rows.length === 0 ? undefined : 'p-0'}>
          <AlumniTable rows={rows} canManage={can(session.role, 'alumni:update')} />
        </CardContent>
      </Card>
    </div>
  );
}
