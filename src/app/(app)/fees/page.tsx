import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FeeAccountsTable,
  PendingFeesTable,
  listFeeAccounts,
  listPendingFees,
} from '@/features/fees';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Fees & Collections' };

/** S40 — fee accounts and the pending-fee report (Doc 16). */
export default async function FeesPage() {
  await requirePermission('fees:view');
  const [accounts, pending] = await Promise.all([listFeeAccounts(), listPendingFees()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees & Collections"
        description="Amounts are stored as integer paise and the payment ledger is append-only — corrections are reversing entries, never edits."
      />
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending fees</TabsTrigger>
          <TabsTrigger value="accounts">All accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardContent className={pending.length === 0 ? undefined : 'p-0'}>
              <PendingFeesTable rows={pending} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="accounts">
          <Card>
            <CardContent className={accounts.length === 0 ? undefined : 'p-0'}>
              <FeeAccountsTable accounts={accounts} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
