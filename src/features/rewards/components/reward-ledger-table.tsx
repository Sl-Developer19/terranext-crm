import { formatDistanceToNow } from 'date-fns';
import { Percent } from 'lucide-react';

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

import type { RewardLedgerEntry } from '../schema';

/** Doc 25 §12/§13 — an immutable reward ledger; accrued -> paid only, driven by payouts (slice 5). */
export function RewardLedgerTable({ entries }: { entries: RewardLedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Percent}
        headline="No rewards yet"
        explanation="Rewards are generated automatically when a referred admission's payment succeeds."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Recorded</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-medium">{formatPaise(entry.amountPaise)}</TableCell>
            <TableCell>
              <StatusBadge
                kind={entry.status === 'paid' ? 'success' : 'progress'}
                label={entry.status === 'paid' ? 'Paid' : 'Accrued'}
              />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
