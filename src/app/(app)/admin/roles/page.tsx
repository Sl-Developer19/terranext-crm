import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { buildRoleMatrix, permissionsMapVersion, RolesMatrix } from '@/features/roles';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = {
  title: 'Roles & Permissions',
  description: 'Read-only view of the role permission matrix (ADR-011).',
};

/**
 * S51 — Roles & Permissions (Doc 16 S51).
 * Read-only render of lib/rbac/permissions.ts.
 * Changes to the permission map require a PR — this screen makes the current
 * state inspectable by system_admin and founder without touching code.
 */
export default async function RolesPage() {
  await requirePermission('roles:view');

  const rows = buildRoleMatrix();
  const version = permissionsMapVersion();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Read-only view of the role permission matrix. Modifying permissions requires a code change to lib/rbac/permissions.ts and a reviewed PR (ADR-011)."
      />
      <Card>
        <CardContent className="p-4">
          <RolesMatrix rows={rows} version={version} />
        </CardContent>
      </Card>
    </div>
  );
}
