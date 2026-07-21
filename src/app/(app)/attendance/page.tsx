import type { Metadata } from 'next';
import Link from 'next/link';
import { UsersRound } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listBatches } from '@/features/batches';
import { getSession } from '@/lib/auth/session';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Attendance' };

/**
 * S25 entry point — pick a batch, then a session. Trainers see only the
 * batches they run, so the first thing a trainer sees on a phone is their
 * own batch rather than a directory to filter (Doc 22 M4 speed target).
 */
export default async function AttendancePage() {
  await requirePermission('attendance:view');
  const session = await getSession();

  const batches = await listBatches(session?.role === 'trainer' ? { trainerUid: session.uid } : {});
  const active = batches.filter((b) => b.status === 'planned' || b.status === 'running');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Choose a batch to mark or review its session attendance."
      />
      <Card>
        <CardContent className={active.length === 0 ? undefined : 'p-0'}>
          {active.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              headline="No active batches"
              explanation={
                session?.role === 'trainer'
                  ? 'You are not assigned to any planned or running batches yet.'
                  : 'Attendance can be marked once a batch is planned or running.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Roster</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <Link
                        href={`/attendance/${batch.id}`}
                        className="font-medium hover:underline"
                      >
                        {batch.code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{batch.programmeName ?? '—'}</TableCell>
                    <TableCell className="text-sm uppercase text-muted-foreground">
                      {batch.schedule.days.join(' · ')} {batch.schedule.startTime}–
                      {batch.schedule.endTime}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {batch.enrolledCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
