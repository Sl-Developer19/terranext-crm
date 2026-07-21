import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { BatchWorkspace, getBatch, listRoster, listSessions } from '@/features/batches';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Batch' };

/** S24 — batch workspace: roster, sessions, status (Doc 16). */
export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const session = await requirePermission('batches:view');

  const batch = await getBatch(batchId);
  if (!batch) notFound();

  const [sessions, roster] = await Promise.all([listSessions(batch.id), listRoster(batch.id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.code}
        description={`${batch.programmeName ?? 'Programme'} · ${batch.schedule.days.join(', ')} ${batch.schedule.startTime}–${batch.schedule.endTime}`}
      />
      <BatchWorkspace
        batch={batch}
        sessions={sessions}
        roster={roster}
        canUpdate={can(session.role, 'batches:update')}
      />
    </div>
  );
}
