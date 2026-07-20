import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
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
  info: 'border-transparent bg-status-info/15 text-status-info',
  progress: 'border-transparent bg-status-progress/15 text-status-progress',
  success: 'border-transparent bg-status-success/15 text-status-success',
  danger: 'border-transparent bg-status-danger/15 text-status-danger',
  neutral: 'border-transparent bg-status-neutral/15 text-status-neutral',
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
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusStyles[kind],
        className,
      )}
    >
      {label}
    </span>
  );
}

export { Badge, badgeVariants };
