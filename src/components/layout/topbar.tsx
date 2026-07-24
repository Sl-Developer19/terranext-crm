import type * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { STAFF_ROLE_LABELS } from '@/lib/rbac/role-labels';
import type { Session } from '@/lib/auth/session';

import { MobileSidebar } from './mobile-sidebar';

function initialsOf(session: Session): string {
  const source = session.email ?? session.uid;
  const local = source.split('@')[0] ?? source;
  const parts = local.split(/[.\-_\s]+/).filter(Boolean);
  const letters = parts.length >= 2 ? [parts[0]![0], parts[1]![0]] : [local.slice(0, 2)];
  return letters.join('').toUpperCase().slice(0, 2);
}

export function Topbar({ session, actions }: { session: Session; actions?: React.ReactNode }) {
  return (
    <header className="glass sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
      <MobileSidebar role={session.role} />
      <div className="ml-auto flex items-center gap-3">
        {actions}
        <div className="hidden items-center gap-2.5 sm:flex">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-foreground">{session.email ?? session.uid}</p>
            <Badge variant="gold" className="mt-0.5">
              {STAFF_ROLE_LABELS[session.role]}
            </Badge>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gradient-to-br from-gold/25 to-emerald/20 font-mono text-xs font-semibold text-gold-hover">
            {initialsOf(session)}
          </span>
        </div>
      </div>
    </header>
  );
}
