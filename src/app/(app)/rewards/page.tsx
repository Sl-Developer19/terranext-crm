import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { listProgrammeOptions } from '@/features/catalogue';
import { CreateRewardRuleDialog, RewardRulesTable, listRewardRules } from '@/features/rewards';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Reward Rules' };

/** Doc 25 §3 — configurable reward rules; System Admin only edits. */
export default async function RewardsPage() {
  const session = await requirePermission('rewards:view');
  const canConfigure = can(session.role, 'rewards:configure');
  const [rules, programmes] = await Promise.all([
    listRewardRules(),
    canConfigure ? listProgrammeOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reward Rules"
        description="Configurable rewards Growth Partners earn per programme — never hardcoded."
        actions={canConfigure ? <CreateRewardRuleDialog programmes={programmes} /> : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <RewardRulesTable rules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}
