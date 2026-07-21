import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { listEmployerOptions } from '@/features/employers';
import { CreatePlacementDialog, PlacementsBoard, listPlacements } from '@/features/placements';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Placements' };

/** S31 — placements pipeline board (Doc 16, BR-08, BR-09). */
export default async function PlacementsPage() {
  const session = await requirePermission('placements:view');
  const [placements, employerOptions] = await Promise.all([
    listPlacements(),
    listEmployerOptions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placements"
        description="The selective placement pipeline — only career-eligible participants (BR-09), and TerraNext never charges the student a placement fee (BR-08)."
        actions={
          can(session.role, 'placements:create') ? (
            <CreatePlacementDialog employers={employerOptions} />
          ) : undefined
        }
      />
      <PlacementsBoard
        placements={placements}
        canAdvance={can(session.role, 'placements:update')}
      />
    </div>
  );
}
