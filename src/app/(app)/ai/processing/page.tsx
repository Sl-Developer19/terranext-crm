import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProcessingQueueView, listProcessingJobs } from '@/features/ai-intelligence';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'AI Intelligence — Processing Queue' };

export default async function AiProcessingQueuePage() {
  const session = await requirePermission('aiIntelligence:view');
  const canRetry = can(session.role, 'aiIntelligence:update');

  const jobs = await listProcessingJobs();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processing Queue"
        description="Every stage — upload, transcription, AI analysis, saving — runs automatically. This page refreshes on its own."
      />
      <Card>
        <CardContent>
          <ProcessingQueueView jobs={jobs} canRetry={canRetry} />
        </CardContent>
      </Card>
    </div>
  );
}
