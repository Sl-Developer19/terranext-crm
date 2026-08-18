'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { decideCommunityPartner } from '../actions/decide-community-partner';
import { resendCommunityPartnerAccessEmail } from '../actions/resend-access-email';
import { setCommunityPartnerStatus } from '../actions/set-community-partner-status';
import { canDecide, canToggleStatus } from '../logic';
import type { CommunityPartner } from '../schema';
import {
  BUSINESS_CATEGORY_LABELS,
  PARTNER_STATUS_BADGE,
  PARTNER_STATUS_LABELS,
} from '../status-labels';

/** Growth Community Business — profile + the decision/status actions gated
 * by `canApprove`/`canManageStatus` (mirrors `PartnerDetailView` exactly). */
export function CommunityPartnerDetailView({
  partner,
  canApprove,
  canManageStatus,
}: {
  partner: CommunityPartner;
  canApprove: boolean;
  canManageStatus: boolean;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<
    'approve' | 'reject' | 'status' | 'resend' | null
  >(null);
  const [confirmReject, setConfirmReject] = React.useState(false);

  const approve = async () => {
    setPendingAction('approve');
    try {
      const outcome = await decideCommunityPartner({ partnerId: partner.id, decision: 'approve' });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Community Partner approved — welcome email sent');
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  const reject = async () => {
    setPendingAction('reject');
    try {
      const outcome = await decideCommunityPartner({ partnerId: partner.id, decision: 'reject' });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Community Partner registration rejected');
      router.refresh();
    } finally {
      setPendingAction(null);
      setConfirmReject(false);
    }
  };

  const resendAccessEmail = async () => {
    setPendingAction('resend');
    try {
      const outcome = await resendCommunityPartnerAccessEmail(partner.id);
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Access email sent');
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  const toggleStatus = async () => {
    const nextStatus = partner.status === 'active' ? 'suspended' : 'active';
    setPendingAction('status');
    try {
      const outcome = await setCommunityPartnerStatus({
        partnerId: partner.id,
        status: nextStatus,
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(nextStatus === 'active' ? 'Business reactivated' : 'Business suspended');
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{partner.orgName}</CardTitle>
          <StatusBadge
            kind={PARTNER_STATUS_BADGE[partner.status]}
            label={PARTNER_STATUS_LABELS[partner.status]}
          />
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Partner ID</div>
            <div>{partner.humanPartnerId ?? 'Not yet assigned (minted on approval)'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Business category</div>
            <div>{BUSINESS_CATEGORY_LABELS[partner.businessCategory]}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Contact person</div>
            <div>{partner.contactName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Email</div>
            <div>{partner.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Phone</div>
            <div>{partner.phone}</div>
          </div>
          {partner.applicationNotes ? (
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground">
                Application notes (from website registration)
              </div>
              <div className="whitespace-pre-wrap">{partner.applicationNotes}</div>
            </div>
          ) : null}
          {partner.emailStatus ? (
            <div>
              <div className="text-xs text-muted-foreground">Welcome email</div>
              <div>
                {partner.emailStatus === 'sent'
                  ? 'Sent'
                  : partner.emailStatus === 'skipped'
                    ? 'Not sent (no reset link available)'
                    : `Failed${partner.emailError ? ` — ${partner.emailError}` : ''}`}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {partner.humanPartnerId ? (
        <Card>
          <CardHeader>
            <CardTitle>QR code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered PNG behind a session-authenticated route, not an optimizable static asset */}
            <img
              src={`/api/community-partners/${partner.id}/qr?format=png`}
              alt={`QR code for ${partner.orgName}`}
              width={160}
              height={160}
              className="rounded-md border border-border"
            />
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <a href={`/api/community-partners/${partner.id}/qr?format=png`} download>
                  Download PNG
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`/api/community-partners/${partner.id}/qr?format=svg`} download>
                  Download SVG
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
          {partner.status === 'active' ? 'Suspend business' : 'Reactivate business'}
        </Button>
      ) : null}

      {canApprove && partner.status === 'active' && partner.authUid ? (
        <div className="flex items-center gap-2">
          <StatusBadge kind="success" label="Portal account: Active" />
          <Button
            variant="outline"
            loading={pendingAction === 'resend'}
            onClick={resendAccessEmail}
          >
            Resend Access Email
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title="Reject this registration?"
        consequence="The business will not be able to sign in. This can be reversed only by registering them again."
        confirmLabel="Reject"
        variant="destructive"
        pending={pendingAction === 'reject'}
        onConfirm={reject}
      />
    </div>
  );
}
