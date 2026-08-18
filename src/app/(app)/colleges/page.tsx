import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CollegeDialog, CollegesTable, listColleges } from '@/features/colleges';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Colleges' };

/** S15 — college master (Doc 16). */
export default async function CollegesPage() {
  const session = await requirePermission('colleges:view');
  const colleges = await listColleges();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colleges"
        description="Colleges that refer leads, ranked by how many they send. Archiving keeps the history — a college is never deleted."
        actions={can(session.role, 'colleges:create') ? <CollegeDialog /> : undefined}
      />
      <Card>
        <CardContent>
          {/* College-master edit/archive is create-level (ops_manager/founder) —
              consultant's `colleges:update` grant is leaders-only (Doc 04/18);
              matches the same restriction enforced server-side in
              `updateCollege`/`setCollegeStatus` (features/colleges/actions). */}
          <CollegesTable colleges={colleges} canManage={can(session.role, 'colleges:create')} />
        </CardContent>
      </Card>
    </div>
  );
}
