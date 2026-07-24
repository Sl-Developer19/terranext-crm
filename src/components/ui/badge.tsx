import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        gold: 'border-gold/30 bg-gold/15 text-gold-hover',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/**
 * Semantic status rendering (Doc 07 §1): color is never the sole signal —
 * the label is always present; kinds map to the fixed status palette.
 */
export type StatusKind = 'info' | 'progress' | 'success' | 'danger' | 'neutral';

const statusStyles: Record<StatusKind, string> = {
  info: 'border-status-info/25 bg-status-info/15 text-status-info',
  progress: 'border-status-progress/25 bg-status-progress/15 text-status-progress',
  success: 'border-status-success/25 bg-status-success/15 text-status-success',
  danger: 'border-status-danger/25 bg-status-danger/15 text-status-danger',
  neutral: 'border-status-neutral/25 bg-status-neutral/10 text-status-neutral',
};

const statusDot: Record<StatusKind, string> = {
  info: 'bg-status-info',
  progress: 'bg-status-progress',
  success: 'bg-status-success',
  danger: 'bg-status-danger',
  neutral: 'bg-status-neutral',
};

export function StatusBadge({
  kind,
  label,
  className,
}: {
  kind: StatusKind;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide',
        statusStyles[kind],
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', statusDot[kind])} aria-hidden />
      {label}
    </span>
  );
}

export { Badge, badgeVariants };
