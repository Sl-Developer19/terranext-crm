import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { listBatches } from '@/features/batches';
import { listAcademies } from '@/features/catalogue';
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
  const [participants, academies, batches] = await Promise.all([
    listParticipants(applied),
    listAcademies(),
    listBatches({}),
  ]);
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
        academyOptions={academies.map((a) => ({ id: a.id, name: a.name }))}
        batchOptions={batches.map((b) => ({ id: b.id, name: b.code }))}
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
