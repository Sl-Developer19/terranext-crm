'use client';

import { FileBadge } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { issueCertificateAction } from '../actions/manage-certificate';
import type { EligibilityRow } from '../schema';

/**
 * S27 eligibility queue. Ineligible rows show exactly which criterion is
 * short rather than a bare "not eligible" — a coordinator needs to know
 * whether to chase attendance or an assessment.
 */
export function EligibilityQueue({
  rows,
  canIssue,
  canOverride,
}: {
  rows: EligibilityRow[];
  canIssue: boolean;
  canOverride: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = React.useState<EligibilityRow | null>(null);
  const [reason, setReason] = React.useState('');

  const issue = async (row: EligibilityRow, override: boolean) => {
    setPending(row.enrolmentId);
    try {
      const outcome = await issueCertificateAction({
        participantId: row.participantId,
        enrolmentId: row.enrolmentId,
        override,
        ...(override ? { overrideReason: reason } : {}),
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`Certificate ${outcome.data.certificateId} issued`);
      setOverrideTarget(null);
      setReason('');
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileBadge}
        headline="Nothing awaiting certification"
        explanation="Enrolments appear here once they are in progress or completed."
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participant</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Attendance</TableHead>
            <TableHead>Assessment</TableHead>
            <TableHead>BR-03</TableHead>
            {canIssue ? <TableHead className="text-right">Action</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.participantId}-${row.enrolmentId}`}>
              <TableCell>
                <Link
                  href={`/participants/${encodeURIComponent(row.participantId)}`}
                  className="font-medium hover:underline"
                >
                  {row.participantName}
                </Link>
                <div className="text-xs text-muted-foreground">{row.participantId}</div>
              </TableCell>
              <TableCell className="text-sm">{row.programmeName ?? '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.attendancePct}% / {row.minAttendanceRequired}%
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.assessmentAvgScore} / {row.minAssessmentRequired}
              </TableCell>
              <TableCell>
                {row.existingCertificateId ? (
                  <StatusBadge kind="success" label={`Issued · ${row.existingCertificateId}`} />
                ) : row.eligible ? (
                  <StatusBadge kind="success" label="Eligible" />
                ) : (
                  <div className="space-y-1">
                    <StatusBadge kind="danger" label="Not eligible" />
                    <ul className="max-w-xs text-xs text-muted-foreground">
                      {row.blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </TableCell>
              {canIssue ? (
                <TableCell className="text-right">
                  {row.existingCertificateId ? null : row.eligible ? (
                    <Button
                      size="sm"
                      disabled={pending === row.enrolmentId}
                      onClick={() => issue(row, false)}
                    >
                      Issue
                    </Button>
                  ) : canOverride ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending === row.enrolmentId}
                      onClick={() => setOverrideTarget(row)}
                    >
                      Override
                    </Button>
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={overrideTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideTarget(null);
            setReason('');
          }
        }}
        title="Issue despite failing BR-03?"
        consequence={
          overrideTarget
            ? `${overrideTarget.participantName} does not meet the certificate criteria. This issuance will be recorded as an override against your account, with your reason.`
            : ''
        }
        confirmLabel="Issue with override"
        variant="destructive"
        pending={pending === overrideTarget?.enrolmentId}
        onConfirm={() => overrideTarget && issue(overrideTarget, true)}
      >
        <div className="space-y-2">
          <Label htmlFor="override-reason" required>
            Reason
          </Label>
          <Textarea
            id="override-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this certificate being issued despite the criteria?"
          />
          {reason.trim().length > 0 && reason.trim().length < 10 ? (
            <p className="text-xs text-destructive">
              Please give at least 10 characters of explanation.
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
