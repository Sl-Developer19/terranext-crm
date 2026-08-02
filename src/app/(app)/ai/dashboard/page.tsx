import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { DashboardView, getDashboardStats, listSessions } from '@/features/ai-intelligence';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'AI Intelligence — Dashboard' };

export default async function AiDashboardPage() {
  await requirePermission('aiIntelligence:view');

  const [stats, sessions] = await Promise.all([getDashboardStats(), listSessions()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Intelligence Platform"
        description="Automatic session recording, transcription, and AI knowledge capture for the classroom."
      />
      <DashboardView stats={stats} recentSessions={sessions} />
    </div>
  );
}
