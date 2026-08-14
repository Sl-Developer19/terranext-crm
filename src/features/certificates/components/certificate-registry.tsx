'use client';

import { format } from 'date-fns';
import { Download, FileBadge } from 'lucide-react';
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

import { issueCertificateDownloadUrl, revokeCertificate } from '../actions/manage-certificate';
import type { Certificate } from '../schema';

/** S27 certificate registry with revocation (Doc 16). */
export function CertificateRegistry({
  certificates,
  canRevoke,
}: {
  certificates: Certificate[];
  canRevoke: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<Certificate | null>(null);
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const handleDownload = async (certificateId: string) => {
    setDownloadingId(certificateId);
    try {
      const outcome = await issueCertificateDownloadUrl(certificateId);
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      window.open(outcome.data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  };

  const confirm = async () => {
    if (!target) return;
    setPending(true);
    try {
      const outcome = await revokeCertificate({ certificateId: target.id, reason });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Certificate revoked');
      setTarget(null);
      setReason('');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  if (certificates.length === 0) {
    return (
      <EmptyState
        icon={FileBadge}
        headline="No certificates issued yet"
        explanation="Certificates appear here once participants meet the BR-03 criteria and are issued."
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Certificate</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Evidence at issuance</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certificates.map((certificate) => (
            <TableRow key={certificate.id}>
              <TableCell>
                <code className="font-mono text-xs">{certificate.id}</code>
              </TableCell>
              <TableCell>
                <Link
                  href={`/participants/${encodeURIComponent(certificate.participantId)}`}
                  className="text-sm font-medium hover:underline"
                >
                  {certificate.participantName ?? certificate.participantId}
                </Link>
              </TableCell>
              <TableCell className="text-sm">{certificate.programmeName ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {certificate.criteria.attendancePct}% attendance (need{' '}
                {certificate.criteria.minAttendanceRequired}%) ·{' '}
                {certificate.criteria.assessmentAvgScore} score (need{' '}
                {certificate.criteria.minAssessmentRequired})
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {certificate.issuedAt ? format(new Date(certificate.issuedAt), 'PP') : '—'}
              </TableCell>
              <TableCell>
                <StatusBadge
                  kind={certificate.status === 'issued' ? 'success' : 'danger'}
                  label={certificate.status === 'issued' ? 'Issued' : 'Revoked'}
                />
                {certificate.revokedReason ? (
                  <div className="max-w-xs text-xs text-muted-foreground">
                    {certificate.revokedReason}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {certificate.pdfStoragePath ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={downloadingId === certificate.id}
                      onClick={() => handleDownload(certificate.id)}
                    >
                      <Download aria-hidden />
                      PDF
                    </Button>
                  ) : null}
                  {canRevoke && certificate.status === 'issued' ? (
                    <Button variant="outline" size="sm" onClick={() => setTarget(certificate)}>
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setReason('');
          }
        }}
        title="Revoke this certificate?"
        consequence={
          target
            ? `${target.id} will fail public verification from now on. The certificate record is kept — revocation is recorded, never deleted.`
            : ''
        }
        confirmLabel="Revoke certificate"
        variant="destructive"
        pending={pending}
        onConfirm={confirm}
      >
        <div className="space-y-2">
          <Label htmlFor="revoke-reason" required>
            Reason
          </Label>
          <Textarea
            id="revoke-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this certificate being revoked?"
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
