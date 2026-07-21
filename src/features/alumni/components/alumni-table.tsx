'use client';

import { GraduationCap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
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

import { recordEngagement, setConsent } from '../actions/manage-alumni';
import { consentLabel } from '../logic';
import type { AlumniRecord } from '../schema';

export function AlumniTable({ rows, canManage }: { rows: AlumniRecord[]; canManage: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        headline="No alumni yet"
        explanation="Alumni membership is granted automatically when a participant is certified (BR-05)."
      />
    );
  }

  const withPending = async (participantId: string, run: () => Promise<void>) => {
    setPendingId(participantId);
    try {
      await run();
    } finally {
      setPendingId(null);
    }
  };

  const onRecordEngagement = (participantId: string, field: 'referrals' | 'eventsAttended') =>
    withPending(participantId, async () => {
      const outcome = await recordEngagement({ participantId, field });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      router.refresh();
    });

  const onToggleConsent = (record: AlumniRecord) =>
    withPending(record.participantId, async () => {
      const outcome = await setConsent({
        participantId: record.participantId,
        consent: !record.consentForSuccessStory,
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Consent updated');
      router.refresh();
    });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Alumnus</TableHead>
          <TableHead>Member since</TableHead>
          <TableHead>Referrals</TableHead>
          <TableHead>Events attended</TableHead>
          <TableHead>Success-story consent</TableHead>
          {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((record) => (
          <TableRow key={record.participantId}>
            <TableCell>
              <div className="font-medium">{record.participantName}</div>
              <div className="text-xs text-muted-foreground">{record.participantId}</div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {record.memberSince ? new Date(record.memberSince).toLocaleDateString() : '—'}
            </TableCell>
            <TableCell className="text-sm">{record.engagement.referrals}</TableCell>
            <TableCell className="text-sm">{record.engagement.eventsAttended}</TableCell>
            <TableCell>
              <StatusBadge
                kind={record.consentForSuccessStory ? 'success' : 'neutral'}
                label={consentLabel(record.consentForSuccessStory)}
              />
            </TableCell>
            {canManage ? (
              <TableCell className="space-x-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === record.participantId}
                  onClick={() => onRecordEngagement(record.participantId, 'referrals')}
                >
                  +1 referral
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === record.participantId}
                  onClick={() => onRecordEngagement(record.participantId, 'eventsAttended')}
                >
                  +1 event
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId === record.participantId}
                  onClick={() => onToggleConsent(record)}
                >
                  {record.consentForSuccessStory ? 'Withdraw consent' : 'Record consent'}
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
