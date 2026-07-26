import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPaise } from '@/features/catalogue/logic';
import {
  LEADERSHIP_LEVEL_LABELS,
  PARTNER_STATUS_BADGE,
  PARTNER_STATUS_LABELS,
  getGrowthPartner,
} from '@/features/growth-partners';
import { listPartnerLeads } from '@/features/leads';
import { getRewardLeaderboard, getWallet, listPartnerRewardLedger } from '@/features/rewards';
import { listPartnerNotifications } from '@/lib/notifications/partner-notifications';
import { requirePartnerSession } from '@/lib/rbac/require-partner';

export const metadata: Metadata = { title: 'Partner Dashboard' };

const PENDING_STAGES = new Set(['new', 'contacted', 'follow_up']);
const COUNSELLING_STAGES = new Set(['counselling_booked', 'counselling_attended']);

/** Doc 25 §3 — the full Growth Partner Dashboard KPI set. */
export default async function PartnerDashboardPage() {
  const session = await requirePartnerSession();
  const [partner, leads, wallet, ledger, notifications, leaderboard] = await Promise.all([
    getGrowthPartner(session.partnerId),
    listPartnerLeads(session.partnerId),
    getWallet(session.partnerId),
    listPartnerRewardLedger(session.partnerId),
    listPartnerNotifications(session.partnerId),
    getRewardLeaderboard(),
  ]);
  if (!partner) return null;

  const pendingLeads = leads.filter((l) => PENDING_STAGES.has(l.stage)).length;
  const counselling = leads.filter((l) => COUNSELLING_STAGES.has(l.stage)).length;
  const successfulLeads = leads.filter((l) => l.participantId !== null).length;
  const rewardsAccruedPaise = ledger
    .filter((e) => e.status === 'accrued')
    .reduce((sum, e) => sum + e.amountPaise, 0);
  const rewardsPaidPaise = ledger
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.amountPaise, 0);
  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const ownRank = leaderboard.find((e) => e.partnerId === session.partnerId)?.rank ?? null;

  const tiles: Array<{ label: string; value: string }> = [
    { label: 'Total leads', value: String(leads.length) },
    { label: 'Pending leads', value: String(pendingLeads) },
    { label: 'Counselling', value: String(counselling) },
    { label: 'Successful leads', value: String(successfulLeads) },
    { label: 'Rewards earned', value: formatPaise(rewardsAccruedPaise + rewardsPaidPaise) },
    { label: 'Rewards paid', value: formatPaise(rewardsPaidPaise) },
    { label: 'Pending rewards', value: formatPaise(rewardsAccruedPaise) },
    { label: 'Wallet balance', value: formatPaise(wallet.balancePaise) },
    { label: 'Notifications', value: String(unreadNotifications) },
    { label: 'Leaderboard rank', value: ownRank ? `#${ownRank}` : 'Not yet ranked' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${partner.displayName}`} description={partner.email} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge
              kind={PARTNER_STATUS_BADGE[partner.status]}
              label={PARTNER_STATUS_LABELS[partner.status]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leadership level
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {LEADERSHIP_LEVEL_LABELS[partner.leadershipLevel]}
          </CardContent>
        </Card>
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {tile.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-foreground">
              {tile.value}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
