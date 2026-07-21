import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AttendanceSummary, getBatchAttendanceSummary } from '@/features/attendance';
import { getBatch } from '@/features/batches';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Batch attendance' };

/** S25 — per-session marking progress for one batch. */
export default async function BatchAttendancePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  await requirePermission('attendance:view');

  const batch = await getBatch(batchId);
  if (!batch) notFound();

  const sessions = await getBatchAttendanceSummary(batch.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${batch.code} attendance`}
        description={`${batch.programmeName ?? 'Programme'} · ${batch.enrolledCount} participants`}
      />
      <Card>
        <CardContent className={sessions.length === 0 ? undefined : 'p-0'}>
          <AttendanceSummary batchId={batch.id} sessions={sessions} />
        </CardContent>
      </Card>
    </div>
  );
}
