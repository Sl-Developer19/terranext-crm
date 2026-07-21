'use client';

import { Users } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

import { pipelineCounts } from '../logic';
import { PLACEMENT_STAGE_ORDER, type Placement } from '../schema';
import { PlacementCard, STATUS_LABELS } from './placement-card';

/** S31 — status-column pipeline board `under_review → placed`, plus a dropped column. */
export function PlacementsBoard({
  placements,
  canAdvance,
}: {
  placements: Placement[];
  canAdvance: boolean;
}) {
  if (placements.length === 0) {
    return (
      <EmptyState
        icon={Users}
        headline="No placements yet"
        explanation="Open a career-eligible participant's profile and create a placement to start the pipeline."
      />
    );
  }

  const counts = pipelineCounts(placements.map((p) => p.status));
  const columns = [...PLACEMENT_STAGE_ORDER, 'dropped'] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {columns.map((status) => (
          <span key={status}>
            {STATUS_LABELS[status]}:{' '}
            <span className="font-medium text-foreground">{counts[status]}</span>
          </span>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-6">
        {columns.map((status) => (
          <div key={status} className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {STATUS_LABELS[status]} ({counts[status]})
            </div>
            <div className="space-y-3">
              {placements
                .filter((p) => p.status === status)
                .map((placement) => (
                  <PlacementCard key={placement.id} placement={placement} canAdvance={canAdvance} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
