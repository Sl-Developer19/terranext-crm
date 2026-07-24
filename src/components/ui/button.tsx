import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-gold text-primary-foreground shadow-premium hover:bg-gold-hover hover:shadow-glow-gold',
        secondary: 'bg-emerald text-secondary-foreground shadow-premium hover:bg-emerald-hover',
        outline:
          'border border-input bg-transparent hover:border-gold/50 hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground-secondary hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-11 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Renders a spinner and disables the button (Doc 06 §2 submission states). */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled ?? loading}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {/* With `asChild`, `Comp` is Radix `Slot`, which needs to know which of
            its children is the element to merge onto. The spinner is a sibling,
            so `children` must be marked as the slot target with `Slottable` —
            otherwise Slot sees two children and cannot slot (it throws
            "Expected a single React element child or `Slottable`"), which breaks
            prerendering of any static page that renders an asChild Button
            (e.g. /_not-found). `Slottable` is transparent when Comp is a plain
            <button>, so non-asChild rendering is unchanged. */}
        <Slottable>{children}</Slottable>
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
