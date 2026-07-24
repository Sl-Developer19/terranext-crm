'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import * as React from 'react';

import { Logo } from '@/components/ui/logo';
import type { StaffRole } from '@/types/common';

import { Sidebar } from './sidebar';

/**
 * Off-canvas nav for narrow viewports (Doc 06 layout is desktop-first; the
 * fixed `<aside>` in AppShell is `hidden` below `md`, which previously left
 * mobile users with no navigation at all). Built on the same Radix Dialog
 * primitive as every other overlay in the system, styled as a slide-in panel
 * instead of a centered modal. Reuses `Sidebar` verbatim, so nav visibility
 * and RBAC filtering stay identical to desktop — this only changes where the
 * same nav renders.
 */
export function MobileSidebar({ role }: { role: StaffRole }) {
  const [open, setOpen] = React.useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="flex size-9 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-accent hover:text-gold md:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface shadow-premium-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <Logo size="sm" />
            <DialogPrimitive.Close
              aria-label="Close navigation"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-gold"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1" onClick={() => setOpen(false)}>
            <Sidebar role={role} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
