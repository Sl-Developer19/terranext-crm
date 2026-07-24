import * as React from 'react';

import { cn } from '@/lib/utils/cn';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm shadow-sm transition-colors',
      'placeholder:text-muted-foreground',
      'hover:border-gold/40',
      'focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/40',
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
