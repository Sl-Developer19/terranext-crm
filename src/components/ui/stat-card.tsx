import { Info } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils/cn';

import { AnimatedNumber, type NumberFormat } from './animated-number';

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
  numericValue,
  format,
  detail,
  caveat,
  unavailableReason,
  className,
}: {
  label: string;
  value: string;
  /** When provided with `format`, the figure counts up on mount/change instead of rendering `value` statically. */
  numericValue?: number | undefined;
  format?: NumberFormat | undefined;
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
  const showRing = !unavailable && format === 'percent' && numericValue !== undefined;

  return (
    <div
      className={cn(
        'card-sheen group relative overflow-hidden rounded-xl border p-4 pl-5 transition-all duration-200',
        'before:absolute before:inset-y-0 before:left-0 before:w-1',
        unavailable
          ? 'border-dashed bg-muted/20'
          : 'bg-card shadow-premium hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-premium-lg',
        accent,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              'mt-1.5 font-mono text-2xl font-semibold tabular-nums',
              unavailable && 'text-muted-foreground',
            )}
          >
            {!unavailable && numericValue !== undefined && format ? (
              <AnimatedNumber value={numericValue} format={format} />
            ) : (
              value
            )}
          </p>
        </div>
        {showRing ? <ProgressRing pct={numericValue} /> : null}
      </div>

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

/** Small radial fill — the "at a glance" read for a percent metric next to its number. */
function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="hsl(var(--gold))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}
