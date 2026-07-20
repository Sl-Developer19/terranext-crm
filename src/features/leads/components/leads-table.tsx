'use client';

import { formatDistanceToNow } from 'date-fns';
import { Sparkles } from 'lucide-react';
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

import type { Lead } from '../schema';
import { LEAD_STAGE_BADGE, LEAD_STAGE_LABELS } from '../stage-labels';

/** S10 list/board (Doc 16) — table view; board/kanban is a fast-follow. */
export function LeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        headline="No leads yet"
        explanation="Leads created here, or arriving from the website, will show up in this list."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Assigned to</TableHead>
          <TableHead>Next follow-up</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell>
              <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                {lead.name}
              </Link>
              <div className="text-xs text-muted-foreground">{lead.phone}</div>
            </TableCell>
            <TableCell>
              <StatusBadge
                kind={LEAD_STAGE_BADGE[lead.stage]}
                label={LEAD_STAGE_LABELS[lead.stage]}
              />
            </TableCell>
            <TableCell className="text-sm capitalize text-muted-foreground">
              {lead.source}
            </TableCell>
            <TableCell className="text-sm">{lead.assignedToName ?? 'Unassigned'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {lead.nextFollowUpAt
                ? formatDistanceToNow(new Date(lead.nextFollowUpAt), { addSuffix: true })
                : '—'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
