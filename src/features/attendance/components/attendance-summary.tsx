'use client';

import { format } from 'date-fns';
import { CalendarCheck } from 'lucide-react';
import Link from 'next/link';

import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { isSessionFullyMarked } from '../logic';
import type { SessionAttendanceSummary } from '../schema';

/** Per-session marking progress for a batch (S25 overview). */
export function AttendanceSummary({
  batchId,
  sessions,
}: {
  batchId: string;
  sessions: SessionAttendanceSummary[];
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        headline="No sessions scheduled"
        explanation="Generate this batch's session calendar before marking attendance."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead>Marked</TableHead>
          <TableHead>Present</TableHead>
          <TableHead>Absent</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => {
          const complete = isSessionFullyMarked(session.marked, session.rosterSize);
          return (
            <TableRow key={session.sessionId}>
              <TableCell className="font-medium">
                {session.date ? format(new Date(session.date), 'PP') : '—'}
              </TableCell>
              <TableCell>
                <StatusBadge
                  kind={complete ? 'success' : session.marked > 0 ? 'progress' : 'neutral'}
                  label={`${session.marked}/${session.rosterSize}`}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{session.present}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{session.absent}</TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/attendance/${batchId}/${session.sessionId}`}
                  className="text-sm font-medium hover:underline"
                >
                  {complete ? 'Review' : 'Mark'}
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
