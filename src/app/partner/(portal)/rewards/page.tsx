import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPaise } from '@/features/catalogue/logic';
import {
  PartnerPayoutHistory,
  RequestPayoutButton,
  RewardLedgerTable,
  getWallet,
  listPartnerPayoutRequests,
  listPartnerRewardLedger,
} from '@/features/rewards';
import { requirePartnerSession } from '@/lib/rbac/require-partner';

export const metadata: Metadata = { title: 'My Rewards' };

/** Doc 25 §12/§13 — a partner's own wallet balance, reward ledger, and payout requests. */
export default async function PartnerRewardsPage() {
  const session = await requirePartnerSession();
  const [wallet, ledger, payouts] = await Promise.all([
    getWallet(session.partnerId),
    listPartnerRewardLedger(session.partnerId),
    listPartnerPayoutRequests(session.partnerId),
  ]);

  const pendingPaise = ledger
    .filter((e) => e.status === 'accrued')
    .reduce((sum, e) => sum + e.amountPaise, 0);

  const hasOpenPayout = payouts.some((p) =>
    ['requested', 'approved', 'processing'].includes(p.status),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Rewards"
        description="Wallet balance, reward history, and payouts."
        actions={<RequestPayoutButton disabled={wallet.balancePaise <= 0 || hasOpenPayout} />}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wallet balance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatPaise(wallet.balancePaise)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatPaise(pendingPaise)}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reward ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <RewardLedgerTable entries={ledger} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Payout history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PartnerPayoutHistory payouts={payouts} />
        </CardContent>
      </Card>
    </div>
  );
}
