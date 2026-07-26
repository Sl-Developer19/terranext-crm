import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { PayoutRequestsTable, listPayoutRequests } from '@/features/rewards';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Payouts' };

/** Doc 25 §9/§13 — Founder/Finance review and finalize partner payout requests. */
export default async function PayoutsPage() {
  const session = await requirePermission('rewards:view');
  const payouts = await listPayoutRequests();
  const canDecide = can(session.role, 'rewards:approve');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        description="Growth Partner payout requests awaiting decision or payment."
      />
      <Card>
        <CardContent className="p-0">
          <PayoutRequestsTable payouts={payouts} canDecide={canDecide} />
        </CardContent>
      </Card>
    </div>
  );
}
