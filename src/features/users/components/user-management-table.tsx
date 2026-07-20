'use client';

import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { STAFF_ROLE_LABELS } from '@/lib/rbac/role-labels';
import { STAFF_ROLES, type StaffRole } from '@/types/common';
import { Users } from 'lucide-react';

import { setUserRole } from '../actions/set-user-role';
import { setUserStatus } from '../actions/set-user-status';
import type { StaffUser } from '../schema';

/**
 * S50 directory + row actions (Doc 16). Server actions are the only mutation
 * path; every change is re-verified server-side (Doc 04 §4) regardless of
 * what this client renders — `canManage` only toggles affordances.
 */
export function UserManagementTable({
  users,
  currentUid,
  canManage,
}: {
  users: StaffUser[];
  currentUid: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pendingUid, setPendingUid] = React.useState<string | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<StaffUser | null>(null);

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        headline="No staff accounts yet"
        explanation="Invite your first staff member to give them access to the CRM."
      />
    );
  }

  const handleRoleChange = async (user: StaffUser, role: StaffRole) => {
    if (role === user.role) return;
    setPendingUid(user.uid);
    try {
      const outcome = await setUserRole({
        uid: user.uid,
        role,
        assignedBatchIds: user.assignedBatchIds,
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`${user.displayName}'s role updated to ${STAFF_ROLE_LABELS[role]}`);
      router.refresh();
    } finally {
      setPendingUid(null);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === 'active' ? 'disabled' : 'active';
    setPendingUid(statusTarget.uid);
    try {
      const outcome = await setUserStatus({ uid: statusTarget.uid, status: nextStatus });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(
        nextStatus === 'disabled'
          ? `${statusTarget.displayName} has been disabled`
          : `${statusTarget.displayName} has been re-enabled`,
      );
      router.refresh();
    } finally {
      setPendingUid(null);
      setStatusTarget(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isSelf = user.uid === currentUid;
            const rowPending = pendingUid === user.uid;
            return (
              <TableRow key={user.uid}>
                <TableCell>
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>
                  {canManage && !isSelf ? (
                    <Select
                      value={user.role}
                      disabled={rowPending}
                      onValueChange={(value) => handleRoleChange(user, value as StaffRole)}
                    >
                      <SelectTrigger className="h-8 w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAFF_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {STAFF_ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm">{STAFF_ROLE_LABELS[user.role]}</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    kind={user.status === 'active' ? 'success' : 'neutral'}
                    label={user.status === 'active' ? 'Active' : 'Disabled'}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.lastLoginAt
                    ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                    : 'Never'}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">This is you</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rowPending}
                        onClick={() => setStatusTarget(user)}
                      >
                        {user.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={statusTarget !== null}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={
          statusTarget?.status === 'active' ? 'Disable this account?' : 'Re-enable this account?'
        }
        consequence={
          statusTarget?.status === 'active'
            ? `${statusTarget?.displayName} will be signed out immediately and unable to sign back in until re-enabled.`
            : `${statusTarget?.displayName} will be able to sign in again.`
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Disable account' : 'Enable account'}
        variant={statusTarget?.status === 'active' ? 'destructive' : 'primary'}
        pending={pendingUid === statusTarget?.uid}
        onConfirm={confirmStatusChange}
      />
    </>
  );
}
