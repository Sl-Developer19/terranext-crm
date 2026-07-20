import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { InviteUserDialog, UserManagementTable, listStaffUsers } from '@/features/users';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Users' };

/** S50 — the screen that proves auth, RBAC, and audit end-to-end (Doc 16). */
export default async function UsersPage() {
  const session = await requirePermission('users:view');
  const users = await listStaffUsers();
  const canManage = can(session.role, 'users:create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Staff accounts and role assignments. There is no self-registration — every account is provisioned here."
        actions={canManage ? <InviteUserDialog /> : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <UserManagementTable users={users} currentUid={session.uid} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
