import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSession } from '@/lib/auth/session';
import { visibleModules } from '@/lib/rbac/permissions';
import { STAFF_ROLE_LABELS } from '@/lib/rbac/role-labels';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Minimal role-aware landing (Doc 16 S03). Becomes the composed
 * role-specific KPI dashboard (SOP 18.10) once feature modules exist to
 * export widgets — the (app) layout already guarantees a session here.
 */
export default async function DashboardPage() {
  const session = await getSession();
  const modules = session ? visibleModules(session.role) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={session ? `Signed in as ${STAFF_ROLE_LABELS[session.role]}` : undefined}
      />
      <Card>
        <CardHeader>
          <CardTitle>Your modules</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Scoped to your role per the Doc 04 permission matrix. Role-specific KPI widgets (SOP
            18.10) land as each feature module ships.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {modules.map((m) => (
              <li key={m} className="rounded-md bg-muted px-3 py-2 capitalize">
                {m}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
