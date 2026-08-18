import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPaise } from '@/features/catalogue/logic';
import { PartnerDetailView, getGrowthPartner } from '@/features/growth-partners';
import { findLeadershipLevels } from '@/features/leadership-levels';
import { RewardLedgerTable, getWallet, listPartnerRewardLedger } from '@/features/rewards';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Growth Partner' };

/** Doc 25 §4/§6/§7 — partner profile, approve/reject/status actions, and
 * (for oversight roles) their wallet + reward ledger. */
export default async function GrowthPartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  const session = await requirePermission('growthPartners:view');
  const partner = await getGrowthPartner(partnerId);
  if (!partner) notFound();

  const canApprove = can(session.role, 'growthPartners:approve');
  const canManageStatus = can(session.role, 'growthPartners:update');
  const canViewRewards = can(session.role, 'rewards:view');
  const [wallet, ledger, leadershipLevels] = await Promise.all([
    canViewRewards ? getWallet(partnerId) : Promise.resolve(null),
    canViewRewards ? listPartnerRewardLedger(partnerId) : Promise.resolve(null),
    findLeadershipLevels(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={partner.displayName} description={partner.email} />
      <PartnerDetailView
        partner={partner}
        canApprove={canApprove}
        canManageStatus={canManageStatus}
        canManageLevel={canManageStatus}
        leadershipLevels={leadershipLevels}
      />
      {wallet && ledger ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Reward ledger</span>
              <span className="text-base font-normal text-muted-foreground">
                Wallet: {formatPaise(wallet.balancePaise)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RewardLedgerTable entries={ledger} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
