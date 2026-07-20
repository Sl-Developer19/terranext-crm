import type * as React from 'react';

import type { Session } from '@/lib/auth/session';
import { siteConfig } from '@/config/site';

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
      <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
        <div className="flex h-14 items-center border-b px-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            {siteConfig.name}
          </span>
        </div>
        <Sidebar role={session.role} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar session={session} actions={headerActions} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
