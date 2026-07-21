import type { Metadata } from 'next';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { AttendanceGrid, getAttendanceGrid } from '@/features/attendance';
import { getBatch, listSessions } from '@/features/batches';
import { isAttendanceWriteScoped } from '@/features/attendance/logic';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Mark attendance' };

/** S25 marking grid for one session (Doc 16). */
export default async function SessionAttendancePage({
  params,
}: {
  params: Promise<{ batchId: string; sessionId: string }>;
}) {
  const { batchId, sessionId } = await params;
  const session = await requirePermission('attendance:view');

  const batch = await getBatch(batchId);
  if (!batch) notFound();

  const sessions = await listSessions(batch.id);
  const current = sessions.find((s) => s.id === sessionId);
  if (!current) notFound();

  const rows = await getAttendanceGrid(batch.id, sessionId);

  // Mirrors the server action's own check so the UI does not offer an
  // affordance the action would then refuse (Doc 04 §4 layered checks).
  const canMark =
    (can(session.role, 'attendance:update') || can(session.role, 'attendance:create')) &&
    !isAttendanceWriteScoped(session.role, batch.trainerUid, session.uid);

  return (
    <div className="space-y-6">
      <PageHeader
        title={current.date ? format(new Date(current.date), 'PPPP') : 'Session'}
        description={`${batch.code} · ${batch.programmeName ?? 'Programme'}${current.topic ? ` · ${current.topic}` : ''}`}
      />
      <AttendanceGrid batchId={batch.id} sessionId={sessionId} rows={rows} canMark={canMark} />
    </div>
  );
}
