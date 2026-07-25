import type * as React from 'react';

import { Logo } from '@/components/ui/logo';
import { siteConfig } from '@/config/site';
import type { Session } from '@/lib/auth/session';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * Authenticated frame (Doc 06 §1, Doc 17 §1): fixed sidebar + topbar +
 * content. Only `session.role` (a plain string) crosses into the client
 * Sidebar — nav filtering happens there, since icon components from
 * NAV_GROUPS cannot be passed as props across the server/client boundary.
 *
 * `headerActions` is a slot (not an import) because `components/layout` may
 * not depend on `features` (Doc 02 §5) — the `app` layer supplies it.
 */
export function AppShell({
  session,
  headerActions,
  children,
}: {
  session: Session;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-premium-lg"
      >
        Skip to main content
      </a>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Logo size="sm" />
        </div>
        <div className="min-h-0 flex-1">
          <Sidebar role={session.role} />
        </div>
        <div className="shrink-0 border-t border-border p-3">
          <div className="card-sheen flex items-center gap-2.5 rounded-lg border border-gold/15 bg-gradient-to-br from-gold/[0.06] to-emerald/[0.06] px-3 py-2.5">
            <Logo size="sm" wordmark={false} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium text-foreground">{siteConfig.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                TerraNext Global Ventures
              </p>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar session={session} actions={headerActions} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
