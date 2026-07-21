import type { Metadata } from 'next';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { ScoreGrid, getAssessment, getScoreGrid } from '@/features/assessments';
import { isAttendanceWriteScoped } from '@/features/attendance/logic';
import { getBatch } from '@/features/batches';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Assessment' };

/** S26 score-entry screen (Doc 16). */
export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const session = await requirePermission('assessments:view');

  const assessment = await getAssessment(assessmentId);
  if (!assessment) notFound();

  const [rows, batch] = await Promise.all([getScoreGrid(assessment), getBatch(assessment.batchId)]);

  // Mirrors the action's own scope check so the UI never offers an
  // affordance the server would refuse (Doc 04 §4 layered checks).
  const canEnter =
    (can(session.role, 'assessments:update') || can(session.role, 'assessments:create')) &&
    !isAttendanceWriteScoped(session.role, batch?.trainerUid ?? null, session.uid);

  return (
    <div className="space-y-6">
      <PageHeader
        title={assessment.name}
        description={`${assessment.batchCode ?? 'Batch'} · held ${
          assessment.heldAt ? format(new Date(assessment.heldAt), 'PP') : '—'
        }`}
      />
      <ScoreGrid assessment={assessment} rows={rows} canEnter={canEnter} />
    </div>
  );
}
