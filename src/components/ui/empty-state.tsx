import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Standard no-data presentation (Doc 06 §5): icon · headline · explanation ·
 * optional action. Copy is instructional, never apologetic.
 */
export function EmptyState({
  icon: Icon,
  headline,
  explanation,
  action,
  className,
}: {
  icon: LucideIcon;
  headline: string;
  explanation: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-gold/25 bg-gold/10">
        <Icon className="size-5 text-gold" aria-hidden />
      </span>
      <p className="font-heading text-sm font-semibold">{headline}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{explanation}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
