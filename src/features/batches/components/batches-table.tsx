'use client';

import { format } from 'date-fns';
import { UsersRound } from 'lucide-react';
import Link from 'next/link';

import { StatusBadge, type StatusKind } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { seatsRemaining, utilizationPct } from '../logic';
import type { Batch, BatchStatus } from '../schema';

const STATUS_LABELS: Record<BatchStatus, string> = {
  planned: 'Planned',
  running: 'Running',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BADGE: Record<BatchStatus, StatusKind> = {
  planned: 'info',
  running: 'progress',
  completed: 'success',
  cancelled: 'neutral',
};

/** S23 batch list with the BR-04 utilization bar. */
export function BatchesTable({ batches, filtered }: { batches: Batch[]; filtered: boolean }) {
  if (batches.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        headline={filtered ? 'No batches match these filters' : 'No batches yet'}
        explanation={
          filtered
            ? 'Clear the filters to see every batch.'
            : 'Create a batch to schedule sessions and allocate participants.'
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead>Programme</TableHead>
          <TableHead>Runs</TableHead>
          <TableHead>Trainer</TableHead>
          <TableHead>Utilization</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((batch) => {
          const pct = utilizationPct(batch.enrolledCount, batch.capacity);
          const remaining = seatsRemaining(batch.enrolledCount, batch.capacity);
          return (
            <TableRow key={batch.id}>
              <TableCell>
                <Link href={`/batches/${batch.id}`} className="font-medium hover:underline">
                  {batch.code}
                </Link>
                <div className="text-xs uppercase text-muted-foreground">
                  {batch.schedule.days.join(' · ')} {batch.schedule.startTime}–
                  {batch.schedule.endTime}
                </div>
              </TableCell>
              <TableCell className="text-sm">{batch.programmeName ?? '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {batch.startDate ? format(new Date(batch.startDate), 'PP') : '—'} →{' '}
                {batch.endDate ? format(new Date(batch.endDate), 'PP') : '—'}
              </TableCell>
              <TableCell className="text-sm">{batch.trainerName ?? 'Unassigned'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-24 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${batch.enrolledCount} of ${batch.capacity} seats taken`}
                  >
                    <div
                      className={
                        pct >= 100 ? 'h-full bg-status-danger' : 'h-full bg-status-success'
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {batch.enrolledCount}/{batch.capacity}
                    {remaining === 0 ? ' · full' : ''}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge
                  kind={STATUS_BADGE[batch.status]}
                  label={STATUS_LABELS[batch.status]}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export { STATUS_LABELS as BATCH_STATUS_LABELS, STATUS_BADGE as BATCH_STATUS_BADGE };
