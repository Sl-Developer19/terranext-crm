'use client';

import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

import { deleteCommunication } from '../actions/delete-communication';
import { channelLabel, filterCommunications, statusLabel, statusTone } from '../logic';
import {
  CHANNELS,
  COMM_STATUSES,
  type Channel,
  type CommStatus,
  type Communication,
} from '../schema';

const ALL = 'all';

/**
 * S41 global log with channel/status/text filters (Doc 16). `canDelete` only
 * toggles the affordance — `deleteCommunication` re-checks
 * `communications:delete` server-side regardless of what this renders.
 */
export function CommunicationsLog({
  rows,
  canDelete = false,
}: {
  rows: Communication[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [channel, setChannel] = React.useState<Channel | typeof ALL>(ALL);
  const [status, setStatus] = React.useState<CommStatus | typeof ALL>(ALL);
  const [deleteTarget, setDeleteTarget] = React.useState<Communication | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    try {
      const outcome = await deleteCommunication({ communicationId: deleteTarget.id });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Message deleted');
      router.refresh();
    } finally {
      setPendingId(null);
      setDeleteTarget(null);
    }
  };

  const visible = React.useMemo(
    () =>
      filterCommunications(rows, {
        search,
        channel: channel === ALL ? undefined : channel,
        status: status === ALL ? undefined : status,
      }),
    [rows, search, channel, status],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="comm-search">Search</Label>
          <Input
            id="comm-search"
            placeholder="Name, subject or message"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comm-filter-channel">Channel</Label>
          <Select
            value={channel}
            onValueChange={(value) => setChannel(value as Channel | typeof ALL)}
          >
            <SelectTrigger id="comm-filter-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All channels</SelectItem>
              {CHANNELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {channelLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="comm-filter-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as CommStatus | typeof ALL)}
          >
            <SelectTrigger id="comm-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {COMM_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {statusLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          headline={rows.length === 0 ? 'No messages yet' : 'No messages match these filters'}
          explanation={
            rows.length === 0
              ? 'Every message sent or received is recorded here before it leaves the system.'
              : 'Try clearing the search or widening the channel and status filters.'
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>About</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
              {canDelete ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.refName}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.refType === 'lead' ? 'Lead' : 'Participant'} ·{' '}
                    {row.direction === 'inbound' ? 'Received' : 'Sent'}
                  </div>
                  {row.refEmail || row.refPhone ? (
                    <div className="text-xs text-muted-foreground">
                      {[row.refEmail, row.refPhone].filter(Boolean).join(' · ')}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">{channelLabel(row.channel)}</TableCell>
                <TableCell className="max-w-md">
                  {row.subject ? <div className="text-sm font-medium">{row.subject}</div> : null}
                  <div className="truncate text-xs text-muted-foreground">{row.bodyPreview}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge kind={statusTone(row.status)} label={statusLabel(row.status)} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                </TableCell>
                {canDelete ? (
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingId === row.id}
                      onClick={() => setDeleteTarget(row)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this message?"
        consequence="Are you sure you want to delete this record? This action can only be performed by the Founder."
        confirmLabel="Delete"
        variant="destructive"
        pending={pendingId === deleteTarget?.id}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
