'use client';

import { formatDistanceToNow } from 'date-fns';
import { Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge, type StatusKind } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

import { decidePayout, markPayoutPaid } from '../actions/decide-payout';
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

/** Doc 25 §9/§13 — Founder/Finance decide and finalize payout requests. */
export function PayoutRequestsTable({
  payouts,
  canDecide,
}: {
  payouts: PayoutRequest[];
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  if (payouts.length === 0) {
    return (
      <EmptyState
        icon={Banknote}
        headline="No payout requests yet"
        explanation="Partners can request a payout once they have an available balance."
      />
    );
  }

  const approve = async (payoutId: string) => {
    setPendingId(payoutId);
    try {
      const outcome = await decidePayout({ payoutId, decision: 'approve' });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Payout approved');
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const reject = async (payoutId: string) => {
    setPendingId(payoutId);
    try {
      const outcome = await decidePayout({ payoutId, decision: 'reject' });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Payout rejected');
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const markPaid = async (payoutId: string) => {
    setPendingId(payoutId);
    try {
      const outcome = await markPayoutPaid({ payoutId });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Payout marked as paid');
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Partner</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Requested</TableHead>
          {canDecide ? <TableHead className="text-right">Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payouts.map((payout) => (
          <TableRow key={payout.id}>
            <TableCell className="text-sm">{payout.partnerName ?? payout.partnerId}</TableCell>
            <TableCell className="font-medium">{formatPaise(payout.amountPaise)}</TableCell>
            <TableCell>
              <StatusBadge kind={STATUS_BADGE[payout.status]} label={STATUS_LABEL[payout.status]} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(payout.requestedAt), { addSuffix: true })}
            </TableCell>
            {canDecide ? (
              <TableCell className="text-right">
                {payout.status === 'requested' ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      disabled={pendingId === payout.id}
                      onClick={() => approve(payout.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId === payout.id}
                      onClick={() => reject(payout.id)}
                    >
                      Reject
                    </Button>
                  </div>
                ) : payout.status === 'approved' ? (
                  <Button
                    size="sm"
                    disabled={pendingId === payout.id}
                    onClick={() => markPaid(payout.id)}
                  >
                    Mark paid
                  </Button>
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
