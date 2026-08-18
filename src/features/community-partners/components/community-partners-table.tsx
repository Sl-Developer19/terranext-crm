'use client';

import { formatDistanceToNow } from 'date-fns';
import { Building2 } from 'lucide-react';
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

import type { CommunityPartner } from '../schema';
import {
  BUSINESS_CATEGORY_LABELS,
  PARTNER_STATUS_BADGE,
  PARTNER_STATUS_LABELS,
} from '../status-labels';

/**
 * Growth Community Business — org-wide directory of TCGN business
 * submissions (mirrors `growth-partners-table.tsx` exactly). This table
 * reads exclusively from `listCommunityPartners()` (the `communityPartners`
 * collection) — it is structurally impossible for a Growth Partner website
 * submission to appear here, since that pipeline writes to a completely
 * separate collection (`growthPartners`) via a completely separate action
 * and endpoint (Task 3/4 audit).
 */
export function CommunityPartnersTable({ partners }: { partners: CommunityPartner[] }) {
  if (partners.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        headline="No Community Business submissions yet"
        explanation="Businesses registered through the Community Growth Network will show up here, pending approval."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Business</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Mobile</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Partner ID</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((partner) => (
          <TableRow key={partner.id}>
            <TableCell>
              <Link
                href={`/growth-community-business/${partner.id}`}
                className="font-medium hover:underline"
              >
                {partner.orgName}
              </Link>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {BUSINESS_CATEGORY_LABELS[partner.businessCategory]}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{partner.contactName}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{partner.phone}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{partner.email}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {partner.humanPartnerId ?? '—'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              Growth Community Business
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(partner.createdAt), { addSuffix: true })}
            </TableCell>
            <TableCell>
              <StatusBadge
                kind={PARTNER_STATUS_BADGE[partner.status]}
                label={PARTNER_STATUS_LABELS[partner.status]}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
