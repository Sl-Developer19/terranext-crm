import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  CommunicationsLog,
  LogCommunicationDialog,
  SendCommunicationDialog,
  listCommunications,
  listRecipientOptions,
} from '@/features/communications';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Communications' };

/** S41 — communications log (Doc 16, FR-10.3). */
export default async function CommunicationsPage() {
  const session = await requirePermission('communications:view');
  const canSend = can(session.role, 'communications:create');
  const canDelete = can(session.role, 'communications:delete');

  const [rows, recipients] = await Promise.all([
    listCommunications(),
    canSend ? listRecipientOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        description="Every message to a lead or participant is recorded here before it is sent (FR-10.3). Message bodies live with the provider; this log keeps a preview."
        actions={
          canSend ? (
            <div className="flex gap-2">
              <LogCommunicationDialog recipients={recipients} />
              <SendCommunicationDialog recipients={recipients} />
            </div>
          ) : undefined
        }
      />
      <Card>
        <CardContent>
          <CommunicationsLog rows={rows} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
