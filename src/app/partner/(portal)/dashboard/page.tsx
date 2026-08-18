import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPaise } from '@/features/catalogue/logic';
import {
  PARTNER_STATUS_BADGE as COMMUNITY_STATUS_BADGE,
  PARTNER_STATUS_LABELS as COMMUNITY_STATUS_LABELS,
  getCommunityPartner,
} from '@/features/community-partners';
import {
  PARTNER_STATUS_BADGE,
  PARTNER_STATUS_LABELS,
  getGrowthPartner,
} from '@/features/growth-partners';
import { findLeadershipLevelBySlug } from '@/features/leadership-levels';
import { listPartnerLeads } from '@/features/leads';
import { getRewardLeaderboard, getWallet, listPartnerRewardLedger } from '@/features/rewards';
import { listPartnerNotifications } from '@/lib/notifications/partner-notifications';
import { requirePartnerSession } from '@/lib/rbac/require-partner';
import type { PartnerSession } from '@/lib/auth/partner-session';

export const metadata: Metadata = { title: 'Partner Dashboard' };

const PENDING_STAGES = new Set(['new', 'contacted', 'follow_up']);
const COUNSELLING_STAGES = new Set(['counselling_booked', 'counselling_attended']);

async function sharedTiles(session: PartnerSession) {
  const [leads, wallet, ledger, notifications, leaderboard] = await Promise.all([
    listPartnerLeads(session.partnerId),
    getWallet(session.partnerId),
    listPartnerRewardLedger(session.partnerId),
    listPartnerNotifications(session.partnerId),
    getRewardLeaderboard(),
  ]);

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

  return tiles;
}

/** Doc 25 §3 — the full Growth Partner Dashboard KPI set. Also serves
 * Community Partners (branched on `session.partnerType`, same as
 * `/partner/qr-code`) — they share the same leads/rewards/wallet engine, but
 * have no `leadershipLevel` concept, so that card is Growth-Partner-only. */
export default async function PartnerDashboardPage() {
  const session = await requirePartnerSession();

  if (session.partnerType === 'community_business') {
    const [partner, tiles] = await Promise.all([
      getCommunityPartner(session.partnerId),
      sharedTiles(session),
    ]);
    if (!partner) return null;

    const allTiles = [
      { label: 'QR scans', value: String(partner.scanCount) },
      { label: 'Referred leads', value: String(partner.referralCount) },
      ...tiles,
    ];

    return (
      <div className="space-y-6">
        <PageHeader title={`Welcome, ${partner.orgName}`} description={partner.email} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBadge
                kind={COMMUNITY_STATUS_BADGE[partner.status]}
                label={COMMUNITY_STATUS_LABELS[partner.status]}
              />
            </CardContent>
          </Card>
          {allTiles.map((tile) => (
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

  const [partner, tiles] = await Promise.all([
    getGrowthPartner(session.partnerId),
    sharedTiles(session),
  ]);
  if (!partner) return null;

  const leadershipLevel = partner.leadershipLevel
    ? await findLeadershipLevelBySlug(partner.leadershipLevel)
    : null;

  const allTiles = [
    { label: 'QR scans', value: String(partner.scanCount) },
    { label: 'Referred leads', value: String(partner.referralCount) },
    ...tiles,
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
          <CardContent className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            {leadershipLevel?.badgeColor ? (
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: leadershipLevel.badgeColor }}
              />
            ) : null}
            {leadershipLevel?.name ?? 'Not set'}
          </CardContent>
        </Card>
        {allTiles.map((tile) => (
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
