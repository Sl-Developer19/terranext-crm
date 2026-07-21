'use client';

import { Banknote } from 'lucide-react';
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

import type { FeeAccount } from '../schema';

/** S40 fee accounts list. */
export function FeeAccountsTable({ accounts }: { accounts: FeeAccount[] }) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Banknote}
        headline="No fee accounts yet"
        explanation="A fee account is opened per enrolment from the programme's default fee plan."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Participant</TableHead>
          <TableHead>Programme</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Paid</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Next due</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id}>
            <TableCell>
              <Link href={`/fees/${account.id}`} className="font-medium hover:underline">
                {account.participantName ?? account.participantId}
              </Link>
              <div className="text-xs text-muted-foreground">{account.participantId}</div>
            </TableCell>
            <TableCell className="text-sm">{account.programmeName ?? '—'}</TableCell>
            <TableCell className="text-sm">
              {formatPaise(account.totalPaise)}
              {account.discountPaise > 0 ? (
                <div className="text-xs text-muted-foreground">
                  less {formatPaise(account.discountPaise)} discount
                </div>
              ) : null}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatPaise(account.paidPaise)}
            </TableCell>
            <TableCell>
              <StatusBadge
                kind={account.balancePaise === 0 ? 'success' : 'progress'}
                label={formatPaise(account.balancePaise)}
              />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {account.nextDueDate ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
