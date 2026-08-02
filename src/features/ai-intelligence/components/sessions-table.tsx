'use client';

import { format } from 'date-fns';
import { Mic, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge, type StatusKind } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { deleteSession } from '../actions/delete-session';
import { formatDuration, SESSION_STATUS_LABELS } from '../logic';
import type { AiSession, AiSessionStatus } from '../schema';

const STATUS_KIND: Record<AiSessionStatus, StatusKind> = {
  draft: 'neutral',
  recording: 'progress',
  recorded: 'progress',
  processing: 'progress',
  completed: 'success',
  failed: 'danger',
};

export function SessionsTable({
  sessions,
  canDelete,
}: {
  sessions: AiSession[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleDelete = async (sessionId: string) => {
    setPending(true);
    const outcome = await deleteSession({ sessionId });
    setPending(false);
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      return;
    }
    toast.success('Session removed');
    setDeletingId(null);
    router.refresh();
  };

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Mic}
        headline="No sessions yet"
        explanation="Create a session, then start recording — transcription and AI analysis begin automatically once you stop."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead>Trainer</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="font-medium">
              <Link href={`/ai/session/${session.id}`} className="hover:text-gold hover:underline">
                {session.title}
              </Link>
            </TableCell>
            <TableCell className="text-sm">{session.trainerName}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {session.batchName ?? '—'}
            </TableCell>
            <TableCell>
              <StatusBadge
                kind={STATUS_KIND[session.status]}
                label={SESSION_STATUS_LABELS[session.status]}
              />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {session.durationSeconds !== null ? formatDuration(session.durationSeconds) : '—'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {session.createdAt ? format(new Date(session.createdAt), 'PP') : '—'}
            </TableCell>
            <TableCell className="text-right">
              {canDelete ? (
                <Button variant="ghost" size="sm" onClick={() => setDeletingId(session.id)}>
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        title="Remove session"
        consequence="This hides the session from the list. Its recording and any generated transcript or summary are kept."
        confirmLabel="Remove"
        variant="destructive"
        pending={pending}
        onConfirm={() => {
          if (deletingId) void handleDelete(deletingId);
        }}
      />
    </Table>
  );
}
