import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  CreateParticipantDialog,
  ParticipantFilters,
  ParticipantsTable,
  listParticipants,
  participantFiltersSchema,
} from '@/features/participants';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Participants' };

/** S20 — participant directory with search and filters (Doc 16). */
export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission('participants:view');
  const params = await searchParams;

  const single = (key: string): string =>
    typeof params[key] === 'string' ? (params[key] as string) : '';

  // Unrecognized filter values are dropped rather than 400-ing the page —
  // a hand-edited URL should degrade to a broader list, not an error screen.
  const filters = participantFiltersSchema.safeParse({
    q: single('q') || undefined,
    status: single('status') || undefined,
    academyId: single('academyId') || undefined,
    batchId: single('batchId') || undefined,
  });
  const applied = filters.success ? filters.data : {};
  const participants = await listParticipants(applied);
  const canCreate = can(session.role, 'participants:create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Participants"
        description="The lifetime record for every person in the academy network — one participant, one record."
        actions={canCreate ? <CreateParticipantDialog /> : undefined}
      />

      <ParticipantFilters
        initialQuery={single('q')}
        initialStatus={single('status')}
        initialAcademyId={single('academyId')}
        initialBatchId={single('batchId')}
      />

      <Card>
        <CardContent className="p-0">
          <ParticipantsTable
            participants={participants}
            filtered={Object.values(applied).some(Boolean)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
