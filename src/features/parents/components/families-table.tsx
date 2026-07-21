'use client';

import { formatDistanceToNow } from 'date-fns';
import { UsersRound } from 'lucide-react';
import Link from 'next/link';

import { StatusBadge, type StatusKind } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { FamilySource, PaginatedFamilies, ParentConversionStatus } from '../schema';

export const FAMILY_SOURCE_LABELS: Record<FamilySource, string> = {
  participant_parent: 'Participant’s parent',
  direct_enquiry: 'Direct enquiry',
  referral: 'Referral',
  campaign: 'Campaign',
  event: 'Event',
};

export const CONVERSION_LABELS: Record<ParentConversionStatus, string> = {
  not_converted: 'Not converted',
  lead_created: 'Lead created',
  enrolled: 'Enrolled',
};

export const CONVERSION_BADGE: Record<ParentConversionStatus, StatusKind> = {
  not_converted: 'neutral',
  lead_created: 'progress',
  enrolled: 'success',
};

/** Family directory with pagination. */
export function FamiliesTable({ data, filtered }: { data: PaginatedFamilies; filtered: boolean }) {
  if (data.rows.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        headline={filtered ? 'No families match these filters' : 'No family records yet'}
        explanation={
          filtered
            ? 'Try a shorter search term, or clear the filters.'
            : 'Create a family record to counsel parents and track the household across siblings.'
        }
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Family</TableHead>
            <TableHead>Primary contact</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Participants</TableHead>
            <TableHead>Conversion</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((family) => (
            <TableRow key={family.id}>
              <TableCell>
                <Link href={`/parents/${family.id}`} className="font-medium hover:underline">
                  {family.familyName}
                </Link>
              </TableCell>
              <TableCell>
                <div className="text-sm">{family.primaryContactName}</div>
                <div className="text-xs text-muted-foreground">{family.primaryContactPhone}</div>
              </TableCell>
              <TableCell className="text-sm">{FAMILY_SOURCE_LABELS[family.source]}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {family.linkedParticipantCount}
              </TableCell>
              <TableCell>
                <StatusBadge
                  kind={CONVERSION_BADGE[family.conversionStatus]}
                  label={CONVERSION_LABELS[family.conversionStatus]}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {family.updatedAt
                  ? formatDistanceToNow(new Date(family.updatedAt), { addSuffix: true })
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={data.pageSize}
      />
    </>
  );
}
