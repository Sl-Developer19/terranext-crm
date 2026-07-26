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

/** Doc 25 §4 — a partner's own referrals only; never another partner's. */
export function PartnerLeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        headline="No referrals yet"
        explanation="Leads you submit will show up here with their current status."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell>
              <Link href={`/partner/leads/${lead.id}`} className="font-medium hover:underline">
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
            <TableCell className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
