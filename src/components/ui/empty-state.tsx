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
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <Icon className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{headline}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{explanation}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
