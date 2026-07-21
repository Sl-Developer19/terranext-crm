import { Info } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * KPI tile (Doc 17 §3 StatCard).
 *
 * Three visual states, because a dashboard that renders "unknown" and "zero"
 * identically is worse than no dashboard: `value` is the measured figure,
 * `caveat` marks a figure that is real but incomplete, and `unavailable`
 * marks one that cannot be measured at all. The unavailable state is
 * deliberately muted and dashed — it should read as absent, not as bad.
 */
export function StatCard({
  label,
  value,
  detail,
  caveat,
  unavailableReason,
  className,
}: {
  label: string;
  value: string;
  detail?: string | undefined;
  caveat?: string | undefined;
  unavailableReason?: string | undefined;
  className?: string;
}) {
  const unavailable = unavailableReason !== undefined;

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        unavailable ? 'border-dashed bg-muted/30' : 'bg-card shadow-sm',
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          unavailable && 'text-muted-foreground',
        )}
      >
        {value}
      </p>

      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}

      {caveat ? (
        <p className="mt-2 flex items-start gap-1 text-xs text-status-progress">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{caveat}</span>
        </p>
      ) : null}

      {unavailableReason ? (
        <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{unavailableReason}</span>
        </p>
      ) : null}
    </div>
  );
}
