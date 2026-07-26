'use client';

import { formatDistanceToNow } from 'date-fns';
import { UsersRound } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

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

import type { GrowthPartner } from '../schema';
import { PARTNER_STATUS_BADGE, PARTNER_STATUS_LABELS } from '../status-labels';

/** Doc 25 §6 — org-wide partner directory, no row-level scope for staff. */
export function GrowthPartnersTable({ partners }: { partners: GrowthPartner[] }) {
  if (partners.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        headline="No Growth Partners yet"
        explanation="Registered partners will show up here, pending approval."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Organisation</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Registered</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((partner) => (
          <TableRow key={partner.id}>
            <TableCell>
              <Link href={`/growth-partners/${partner.id}`} className="font-medium hover:underline">
                {partner.displayName}
              </Link>
              <div className="text-xs text-muted-foreground">{partner.email}</div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {partner.organizationName ?? '—'}
            </TableCell>
            <TableCell>
              <StatusBadge
                kind={PARTNER_STATUS_BADGE[partner.status]}
                label={PARTNER_STATUS_LABELS[partner.status]}
              />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(partner.createdAt), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
