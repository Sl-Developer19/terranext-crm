import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  BatchDialog,
  BatchesTable,
  batchFiltersSchema,
  listBatches,
  listTrainers,
} from '@/features/batches';
import { listProgrammeOptions } from '@/features/catalogue';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Batches' };

/** S23 — batch list with the BR-04 utilization bar (Doc 16). */
export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission('batches:view');
  const params = await searchParams;
  const single = (key: string): string =>
    typeof params[key] === 'string' ? (params[key] as string) : '';

  const parsed = batchFiltersSchema.safeParse({
    programmeId: single('programmeId') || undefined,
    status: single('status') || undefined,
    trainerUid: single('trainerUid') || undefined,
  });
  const filters = parsed.success ? parsed.data : {};

  const canManage = can(session.role, 'batches:create');
  const [batches, programmes, trainers] = await Promise.all([
    listBatches(filters),
    canManage ? listProgrammeOptions() : Promise.resolve([]),
    canManage ? listTrainers() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches"
        description="Scheduled cohorts with capacity, trainer assignment, and a generated session calendar."
        actions={
          canManage ? <BatchDialog programmes={programmes} trainers={trainers} /> : undefined
        }
      />
      <Card>
        <CardContent className="p-0">
          <BatchesTable batches={batches} filtered={Object.values(filters).some(Boolean)} />
        </CardContent>
      </Card>
    </div>
  );
}
