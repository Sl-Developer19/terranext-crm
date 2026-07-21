import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AssessmentDialog, AssessmentsTable, listAssessments } from '@/features/assessments';
import { listBatches } from '@/features/batches';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Assessments' };

/** S26 — assessments and score entry (Doc 16). */
export default async function AssessmentsPage() {
  const session = await requirePermission('assessments:view');
  const auth = await getSession();
  const canCreate = can(session.role, 'assessments:create');

  const [assessments, batches] = await Promise.all([
    listAssessments(),
    canCreate
      ? listBatches(auth?.role === 'trainer' ? { trainerUid: auth.uid } : {})
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Scores feed the BR-03 certificate gate — pass/fail is derived server-side from each assessment's pass mark."
        actions={
          canCreate ? (
            <AssessmentDialog
              batches={batches
                .filter((b) => b.status === 'planned' || b.status === 'running')
                .map((b) => ({ id: b.id, code: b.code, programmeName: b.programmeName }))}
            />
          ) : undefined
        }
      />
      <Card>
        <CardContent className={assessments.length === 0 ? undefined : 'p-0'}>
          <AssessmentsTable assessments={assessments} />
        </CardContent>
      </Card>
    </div>
  );
}
