'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { decideGrowthPartner } from '../actions/decide-growth-partner';
import { setGrowthPartnerStatus } from '../actions/set-growth-partner-status';
import { canDecide, canToggleStatus } from '../logic';
import type { GrowthPartner } from '../schema';
import {
  LEADERSHIP_LEVEL_LABELS,
  PARTNER_STATUS_BADGE,
  PARTNER_STATUS_LABELS,
} from '../status-labels';

/** Doc 25 §4/§6 — profile + the decision/status actions gated by `canApprove`/`canManageStatus`. */
export function PartnerDetailView({
  partner,
  canApprove,
  canManageStatus,
}: {
  partner: GrowthPartner;
  canApprove: boolean;
  canManageStatus: boolean;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<'approve' | 'reject' | 'status' | null>(
    null,
  );
  const [confirmReject, setConfirmReject] = React.useState(false);

  const approve = async () => {
    setPendingAction('approve');
    try {
      const outcome = await decideGrowthPartner({ partnerId: partner.id, decision: 'approve' });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Partner approved — welcome email sent');
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  const reject = async () => {
    setPendingAction('reject');
    try {
      const outcome = await decideGrowthPartner({ partnerId: partner.id, decision: 'reject' });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Partner registration rejected');
      router.refresh();
    } finally {
      setPendingAction(null);
      setConfirmReject(false);
    }
  };

  const toggleStatus = async () => {
    const nextStatus = partner.status === 'active' ? 'suspended' : 'active';
    setPendingAction('status');
    try {
      const outcome = await setGrowthPartnerStatus({ partnerId: partner.id, status: nextStatus });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(nextStatus === 'active' ? 'Partner reactivated' : 'Partner suspended');
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{partner.displayName}</CardTitle>
          <StatusBadge
            kind={PARTNER_STATUS_BADGE[partner.status]}
            label={PARTNER_STATUS_LABELS[partner.status]}
          />
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Email</div>
            <div>{partner.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Phone</div>
            <div>{partner.phone}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Organisation</div>
            <div>{partner.organizationName ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Leadership level</div>
            <div>{LEADERSHIP_LEVEL_LABELS[partner.leadershipLevel]}</div>
          </div>
        </CardContent>
      </Card>

      {canApprove && canDecide(partner.status) ? (
        <div className="flex gap-2">
          <Button loading={pendingAction === 'approve'} onClick={approve}>
            Approve
          </Button>
          <Button variant="outline" onClick={() => setConfirmReject(true)}>
            Reject
          </Button>
        </div>
      ) : null}

      {canManageStatus && canToggleStatus(partner.status) ? (
        <Button
          variant={partner.status === 'active' ? 'destructive' : 'primary'}
          loading={pendingAction === 'status'}
          onClick={toggleStatus}
        >
          {partner.status === 'active' ? 'Suspend partner' : 'Reactivate partner'}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title="Reject this registration?"
        consequence="The partner will not be able to sign in. This can be reversed only by registering them again."
        confirmLabel="Reject"
        variant="destructive"
        pending={pendingAction === 'reject'}
        onConfirm={reject}
      />
    </div>
  );
}
