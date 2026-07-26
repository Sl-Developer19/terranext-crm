import { Check, Circle, Dot } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

import type { TimelineStep } from '../logic';

/** Doc 25 §5 — renders the derived lead status timeline. */
export function LeadTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
          {i < steps.length - 1 ? (
            <span
              aria-hidden
              className={cn(
                'absolute left-[9px] top-5 h-full w-px',
                step.status === 'complete' ? 'bg-status-success/40' : 'bg-border',
              )}
            />
          ) : null}
          <span
            aria-hidden
            className={cn(
              'z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full border',
              step.status === 'complete' &&
                'border-status-success bg-status-success/15 text-status-success',
              step.status === 'current' &&
                'border-status-progress bg-status-progress/15 text-status-progress',
              step.status === 'pending' && 'border-border bg-surface text-muted-foreground',
            )}
          >
            {step.status === 'complete' ? (
              <Check className="size-3" />
            ) : step.status === 'current' ? (
              <Dot className="size-4" />
            ) : (
              <Circle className="size-2" />
            )}
          </span>
          <span
            className={cn(
              'text-sm leading-[18px]',
              step.status === 'pending' ? 'text-muted-foreground' : 'font-medium text-foreground',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
