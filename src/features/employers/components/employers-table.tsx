'use client';

import { Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { setEmployerStatus } from '../actions/manage-employer';
import { archiveWarning, employerStatusLabel, formatContactSummary } from '../logic';
import type { Employer } from '../schema';
import { EmployerDialog } from './employer-dialog';

export function EmployersTable({ rows, canManage }: { rows: Employer[]; canManage: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<Employer | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        headline="No employers yet"
        explanation="Add an employer to start recording placements against them."
      />
    );
  }

  const performStatusChange = async (employer: Employer, nextStatus: Employer['status']) => {
    setPendingId(employer.id);
    try {
      const outcome = await setEmployerStatus({ employerId: employer.id, status: nextStatus });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(nextStatus === 'archived' ? 'Employer archived' : 'Employer restored');
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const toggleStatus = (employer: Employer) => {
    const nextStatus = employer.status === 'active' ? 'archived' : 'active';
    if (nextStatus === 'archived' && archiveWarning(employer)) {
      setConfirmTarget(employer);
      return;
    }
    void performStatusChange(employer, nextStatus);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employer</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Placements</TableHead>
            <TableHead>Status</TableHead>
            {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((employer) => (
            <TableRow key={employer.id}>
              <TableCell>
                <div className="font-medium">{employer.name}</div>
                {employer.agreementNote ? (
                  <div className="max-w-md truncate text-xs text-muted-foreground">
                    {employer.agreementNote}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">{employer.country}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {employer.industry ?? '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatContactSummary(employer.contact)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {employer.placementCount}
              </TableCell>
              <TableCell>
                <StatusBadge
                  kind={employer.status === 'active' ? 'success' : 'neutral'}
                  label={employerStatusLabel(employer.status)}
                />
              </TableCell>
              {canManage ? (
                <TableCell className="space-x-2 text-right">
                  <EmployerDialog employer={employer} />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendingId === employer.id}
                    onClick={() => toggleStatus(employer)}
                  >
                    {employer.status === 'active' ? 'Archive' : 'Restore'}
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {confirmTarget ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmTarget(null);
          }}
          title="Archive employer"
          consequence={archiveWarning(confirmTarget) ?? 'Archive this employer?'}
          confirmLabel="Archive anyway"
          variant="destructive"
          pending={pendingId === confirmTarget.id}
          onConfirm={async () => {
            const target = confirmTarget;
            setConfirmTarget(null);
            await performStatusChange(target, 'archived');
          }}
        />
      ) : null}
    </>
  );
}
