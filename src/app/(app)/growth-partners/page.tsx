import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GrowthPartnersTable,
  RegisterGrowthPartnerDialog,
  listGrowthPartners,
} from '@/features/growth-partners';
import { LeaderboardTable, getRewardLeaderboard } from '@/features/rewards';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Growth Partners' };

/** Doc 25 §6 — org-wide Growth Partner directory + reward leaderboard. */
export default async function GrowthPartnersPage() {
  const session = await requirePermission('growthPartners:view');
  const canCreate = can(session.role, 'growthPartners:create');
  const canViewRewards = can(session.role, 'rewards:view');
  const [partners, leaderboard] = await Promise.all([
    listGrowthPartners(),
    canViewRewards ? getRewardLeaderboard() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Growth Partners"
        description="External referral partners — registration, approval, and status."
        actions={canCreate ? <RegisterGrowthPartnerDialog /> : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <GrowthPartnersTable partners={partners} />
        </CardContent>
      </Card>
      {canViewRewards ? (
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <LeaderboardTable entries={leaderboard} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
