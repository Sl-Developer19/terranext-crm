import { formatDistanceToNow } from 'date-fns';
import { Banknote } from 'lucide-react';

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
import { formatPaise } from '@/features/catalogue/logic';

import type { PayoutRequest, PayoutStatus } from '../schema';

const STATUS_LABEL: Record<PayoutStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  processing: 'Processing',
  paid: 'Paid',
};

const STATUS_BADGE: Record<PayoutStatus, StatusKind> = {
  requested: 'progress',
  approved: 'info',
  rejected: 'danger',
  processing: 'progress',
  paid: 'success',
};

/** Doc 25 §13 — a partner's own payout history. */
export function PartnerPayoutHistory({ payouts }: { payouts: PayoutRequest[] }) {
  if (payouts.length === 0) {
    return (
      <EmptyState
        icon={Banknote}
        headline="No payout requests yet"
        explanation="Request a payout once you have an available balance."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Requested</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payouts.map((payout) => (
          <TableRow key={payout.id}>
            <TableCell className="font-medium">{formatPaise(payout.amountPaise)}</TableCell>
            <TableCell>
              <StatusBadge kind={STATUS_BADGE[payout.status]} label={STATUS_LABEL[payout.status]} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(payout.requestedAt), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
