import type * as React from 'react';

import { STAFF_ROLE_LABELS } from '@/lib/rbac/role-labels';
import type { Session } from '@/lib/auth/session';

export function Topbar({ session, actions }: { session: Session; actions?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium">{session.email ?? session.uid}</p>
          <p className="text-xs text-muted-foreground">{STAFF_ROLE_LABELS[session.role]}</p>
        </div>
        {actions}
      </div>
    </header>
  );
}
