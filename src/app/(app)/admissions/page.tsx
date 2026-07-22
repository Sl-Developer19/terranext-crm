import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AdmissionsQueue, listAdmissionCandidates, readyCount } from '@/features/admissions';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Admissions' };

/** S13 — admissions queue (Doc 16, BR-02). */
export default async function AdmissionsPage() {
  const session = await requirePermission('admissions:view');
  const candidates = await listAdmissionCandidates();
  const ready = readyCount(candidates);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions"
        description={`${ready} of ${candidates.length} lead${candidates.length === 1 ? '' : 's'} in the queue satisfy BR-02 and can be converted.`}
      />
      <Card>
        <CardContent className={candidates.length === 0 ? undefined : 'p-0'}>
          <AdmissionsQueue
            candidates={candidates}
            canConvert={can(session.role, 'admissions:create')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
