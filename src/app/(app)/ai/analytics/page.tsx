import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { AnalyticsView, getRecentAnalytics } from '@/features/ai-intelligence';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'AI Intelligence — Analytics' };

export default async function AiAnalyticsPage() {
  await requirePermission('aiIntelligence:view');

  const days = await getRecentAnalytics(30);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Daily rollups of sessions processed, recording volume, and words transcribed."
      />
      <AnalyticsView days={days} />
    </div>
  );
}
