'use client';

import { formatDistanceToNow } from 'date-fns';
import { Briefcase } from 'lucide-react';
import Link from 'next/link';

import { StatusBadge, type StatusKind } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { CareerProfileListItem, EligibilityState } from '../schema';

export const ELIGIBILITY_LABELS: Record<EligibilityState, string> = {
  not_evaluated: 'Not evaluated',
  not_eligible: 'Not eligible',
  eligible: 'Eligible',
};

export const ELIGIBILITY_BADGE: Record<EligibilityState, StatusKind> = {
  not_evaluated: 'neutral',
  not_eligible: 'danger',
  eligible: 'success',
};

export function CareerProfilesTable({ rows }: { rows: CareerProfileListItem[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        headline="No career interest captured yet"
        explanation="Open a participant's record and add a career profile to track placement readiness."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Participant</TableHead>
          <TableHead>Job categories</TableHead>
          <TableHead>Readiness</TableHead>
          <TableHead>Eligibility</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.participantId}>
            <TableCell>
              <Link
                href={`/career/${encodeURIComponent(row.participantId)}`}
                className="font-medium hover:underline"
              >
                {row.participantName}
              </Link>
              <div className="text-xs text-muted-foreground">{row.participantId}</div>
            </TableCell>
            <TableCell className="text-sm">
              {row.jobCategories.length > 0 ? row.jobCategories.join(', ') : '—'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {row.readinessScore ?? '—'}
            </TableCell>
            <TableCell>
              <StatusBadge
                kind={ELIGIBILITY_BADGE[row.eligibility]}
                label={ELIGIBILITY_LABELS[row.eligibility]}
              />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {row.updatedAt
                ? formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
