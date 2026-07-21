'use client';

import { CheckCircle2 } from 'lucide-react';
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
import { formatPaise } from '@/features/catalogue/logic';

import type { PendingFeeRow } from '../schema';

/** S40 pending-fee report. Overdue is derived from the due date, not stored. */
export function PendingFeesTable({ rows }: { rows: PendingFeeRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        headline="Nothing outstanding"
        explanation="Every fee account is fully settled."
      />
    );
  }

  const totalOutstanding = rows.reduce((sum, row) => sum + row.balancePaise, 0);

  return (
    <>
      <div className="border-b px-6 py-3 text-sm">
        <span className="text-muted-foreground">Total outstanding: </span>
        <span className="font-semibold">{formatPaise(totalOutstanding)}</span>
        <span className="text-muted-foreground"> across {rows.length} accounts</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participant</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Next due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.feeAccountId}>
              <TableCell>
                <Link href={`/fees/${row.feeAccountId}`} className="font-medium hover:underline">
                  {row.participantName || row.participantId}
                </Link>
                <div className="text-xs text-muted-foreground">{row.participantId}</div>
              </TableCell>
              <TableCell className="text-sm">{row.programmeName ?? '—'}</TableCell>
              <TableCell className="text-sm font-medium">{formatPaise(row.balancePaise)}</TableCell>
              <TableCell>
                {row.nextDueDate ? (
                  <StatusBadge
                    kind={row.overdue ? 'danger' : 'info'}
                    label={row.overdue ? `Overdue · ${row.nextDueDate}` : row.nextDueDate}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
