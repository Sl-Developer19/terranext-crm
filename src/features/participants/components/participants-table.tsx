'use client';

import { formatDistanceToNow } from 'date-fns';
import { Users } from 'lucide-react';
import Link from 'next/link';

import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ParticipantListItem } from '../schema';
import { PARTICIPANT_STATUS_BADGE, PARTICIPANT_STATUS_LABELS } from '../status-labels';

/** S20 directory (Doc 16). */
export function ParticipantsTable({
  participants,
  filtered,
}: {
  participants: ParticipantListItem[];
  filtered: boolean;
}) {
  if (participants.length === 0) {
    return filtered ? (
      <EmptyState
        icon={Users}
        headline="No participants match these filters"
        explanation="Try a shorter search term, or clear the filters to see the full directory."
      />
    ) : (
      <EmptyState
        icon={Users}
        headline="No participants yet"
        explanation="Participants appear here once they are admitted, or when you add one directly."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Participant</TableHead>
          <TableHead>ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Academy</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.map((participant) => (
          <TableRow key={participant.id}>
            <TableCell>
              <Link
                href={`/participants/${encodeURIComponent(participant.id)}`}
                className="font-medium hover:underline"
              >
                {participant.fullName}
              </Link>
              <div className="text-xs text-muted-foreground">{participant.phone}</div>
            </TableCell>
            <TableCell>
              <code className="font-mono text-xs text-muted-foreground">{participant.id}</code>
            </TableCell>
            <TableCell>
              <StatusBadge
                kind={PARTICIPANT_STATUS_BADGE[participant.status]}
                label={PARTICIPANT_STATUS_LABELS[participant.status]}
              />
            </TableCell>
            <TableCell className="text-sm">{participant.academyId ?? '—'}</TableCell>
            <TableCell className="text-sm">{participant.batchId ?? '—'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {participant.updatedAt
                ? formatDistanceToNow(new Date(participant.updatedAt), { addSuffix: true })
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
