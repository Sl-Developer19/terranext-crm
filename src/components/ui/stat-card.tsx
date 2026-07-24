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
  // Left accent: emerald for a clean measured figure, gold where the figure
  // carries a caveat (Doc 17 §3's "real but incomplete" state), nothing for
  // unavailable — an accent there would overstate a number that isn't real.
  const accent = unavailable ? null : caveat ? 'before:bg-gold' : 'before:bg-emerald';

  return (
    <div
      className={cn(
        'card-sheen relative overflow-hidden rounded-xl border p-4 pl-5 transition-colors',
        'before:absolute before:inset-y-0 before:left-0 before:w-1',
        unavailable ? 'border-dashed bg-muted/20' : 'bg-card shadow-premium hover:border-gold/30',
        accent,
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-mono text-2xl font-semibold tabular-nums',
          unavailable && 'text-muted-foreground',
        )}
      >
        {value}
      </p>

      {detail ? <p className="mt-1 text-xs text-foreground-secondary">{detail}</p> : null}

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
