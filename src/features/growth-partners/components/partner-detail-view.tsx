'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LeadershipLevelDefinition } from '@/features/leadership-levels';

import { decideGrowthPartner } from '../actions/decide-growth-partner';
import { resendGrowthPartnerAccessEmail } from '../actions/resend-access-email';
import { setGrowthPartnerLeadershipLevel } from '../actions/set-growth-partner-leadership-level';
import { setGrowthPartnerStatus } from '../actions/set-growth-partner-status';
import { canDecide, canToggleStatus } from '../logic';
import type { GrowthPartner } from '../schema';
import { PARTNER_STATUS_BADGE, PARTNER_STATUS_LABELS } from '../status-labels';

/** Doc 25 §4/§6 — profile + the decision/status actions gated by
 * `canApprove`/`canManageStatus`/`canManageLevel`. `leadershipLevels` is the
 * full Settings §3 list (any status) so an already-assigned-but-since-archived
 * level still displays correctly, even though only active ones are offered
 * as a new choice. */
export function PartnerDetailView({
  partner,
  canApprove,
  canManageStatus,
  canManageLevel,
  leadershipLevels,
}: {
  partner: GrowthPartner;
  canApprove: boolean;
  canManageStatus: boolean;
  canManageLevel: boolean;
  leadershipLevels: LeadershipLevelDefinition[];
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<
    'approve' | 'reject' | 'status' | 'level' | 'resend' | null
  >(null);
  const [confirmReject, setConfirmReject] = React.useState(false);

  const currentLevel = leadershipLevels.find((level) => level.slug === partner.leadershipLevel);
  const activeLevels = leadershipLevels.filter(
    (level) => level.status === 'active' || level.slug === partner.leadershipLevel,
  );

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

  const resendAccessEmail = async () => {
    setPendingAction('resend');
    try {
      const outcome = await resendGrowthPartnerAccessEmail(partner.id);
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

  const changeLevel = async (levelSlug: string) => {
    setPendingAction('level');
    try {
      const outcome = await setGrowthPartnerLeadershipLevel({ partnerId: partner.id, levelSlug });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Leadership level updated');
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
            <div className="text-xs text-muted-foreground">Partner ID</div>
            <div>{partner.humanPartnerId ?? '—'}</div>
          </div>
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
            {canManageLevel ? (
              <Select
                {...(partner.leadershipLevel ? { defaultValue: partner.leadershipLevel } : {})}
                onValueChange={changeLevel}
                disabled={pendingAction === 'level'}
              >
                <SelectTrigger className="mt-0.5 h-8">
                  <SelectValue placeholder="Not set">
                    {currentLevel?.name ?? (partner.leadershipLevel || 'Not set')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeLevels.map((level) => (
                    <SelectItem key={level.slug} value={level.slug}>
                      {level.name}
                      {level.status === 'archived' ? ' (archived)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                {currentLevel?.badgeColor ? (
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: currentLevel.badgeColor }}
                  />
                ) : null}
                {currentLevel?.name ?? partner.leadershipLevel ?? '—'}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">QR scans</div>
            <div>{partner.scanCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Referred leads</div>
            <div>{partner.referralCount}</div>
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
              src={`/api/growth-partners/${partner.id}/qr?format=png`}
              alt={`QR code for ${partner.displayName}`}
              width={160}
              height={160}
              className="rounded-md border border-border"
            />
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <a href={`/api/growth-partners/${partner.id}/qr?format=png`} download>
                  Download PNG
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`/api/growth-partners/${partner.id}/qr?format=svg`} download>
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
          {partner.status === 'active' ? 'Suspend partner' : 'Reactivate partner'}
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
        consequence="The partner will not be able to sign in. This can be reversed only by registering them again."
        confirmLabel="Reject"
        variant="destructive"
        pending={pendingAction === 'reject'}
        onConfirm={reject}
      />
    </div>
  );
}
