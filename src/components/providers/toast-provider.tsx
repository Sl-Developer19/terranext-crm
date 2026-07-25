'use client';

import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

export function ToastProvider() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group rounded-xl border border-border bg-card text-card-foreground shadow-premium-lg',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
          actionButton: '!bg-gold !text-primary-foreground',
          cancelButton: '!bg-muted !text-muted-foreground',
          closeButton: '!border-border !bg-card !text-muted-foreground hover:!text-gold',
          success: '!border-status-success/30',
          error: '!border-status-danger/30',
          warning: '!border-status-progress/30',
          info: '!border-status-info/30',
        },
      }}
    />
  );
}
