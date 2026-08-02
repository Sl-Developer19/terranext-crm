import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { listAllocatableBatches } from '@/features/batches';
import { listProgrammeOptions } from '@/features/catalogue';
import { CreateSessionDialog, SessionsTable, listSessions } from '@/features/ai-intelligence';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'AI Intelligence — Sessions' };

export default async function AiSessionsPage() {
  const authSession = await requirePermission('aiIntelligence:view');
  const canCreate = can(authSession.role, 'aiIntelligence:create');
  const canDelete = can(authSession.role, 'aiIntelligence:delete');

  const [sessions, batches, programmes] = await Promise.all([
    listSessions(),
    canCreate ? listAllocatableBatches() : Promise.resolve([]),
    canCreate ? listProgrammeOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        description="Create a session, then record — upload, transcription, and AI analysis run automatically once you stop."
        actions={
          canCreate ? (
            <CreateSessionDialog
              batches={batches.map((b) => ({ id: b.id, label: b.code }))}
              programmes={programmes.map((p) => ({ id: p.id, label: p.name }))}
            />
          ) : undefined
        }
      />
      <Card>
        <CardContent>
          <SessionsTable sessions={sessions} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
