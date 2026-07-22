import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { listProgrammeOptions } from '@/features/catalogue';
import {
  SessionFormDialog,
  SessionsView,
  listCounsellableLeads,
  listSessions,
} from '@/features/counselling';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Counselling' };

/** S12 — counselling sessions (Doc 16, BR-02). */
export default async function CounsellingPage() {
  const session = await requirePermission('counselling:view');
  const canRecord = can(session.role, 'counselling:create');

  const [sessions, leads, programmes] = await Promise.all([
    listSessions(),
    canRecord ? listCounsellableLeads() : Promise.resolve([]),
    canRecord ? listProgrammeOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Counselling"
        description="Sessions are the evidence an admission rests on — a lead cannot be converted without one that recommended them and named a programme (BR-02)."
        actions={
          canRecord ? (
            <SessionFormDialog
              leads={leads}
              programmes={programmes.map((p) => ({ id: p.id, name: p.name }))}
            />
          ) : undefined
        }
      />
      <Card>
        <CardContent>
          <SessionsView sessions={sessions} />
        </CardContent>
      </Card>
    </div>
  );
}
