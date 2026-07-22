'use client';

import { Check, ClipboardCheck, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { AdmissionCandidate } from '../schema';

/** The BR-02 checklist, rendered so a blocked row explains itself in place. */
function ChecklistCell({ candidate }: { candidate: AdmissionCandidate }) {
  const { checklist } = candidate;
  const items = [
    { label: 'Counselling session recorded', done: checklist.hasSession },
    { label: 'Latest outcome recommends', done: checklist.latestOutcomeRecommended },
    { label: 'Programme named', done: checklist.hasProgrammeRecommendation },
  ];

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          {item.done ? (
            <Check className="size-3.5 text-status-success" aria-hidden />
          ) : (
            <X className="size-3.5 text-status-danger" aria-hidden />
          )}
          <span className={item.done ? 'text-muted-foreground' : 'text-foreground'}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** S13 — admissions queue with a per-lead BR-02 checklist (Doc 16). */
export function AdmissionsQueue({
  candidates,
  canConvert,
}: {
  candidates: AdmissionCandidate[];
  canConvert: boolean;
}) {
  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        headline="No leads awaiting admission"
        explanation="Leads appear here once they reach the hot or counselling-attended stage."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Recommended programme</TableHead>
          <TableHead>BR-02 checklist</TableHead>
          <TableHead>Assigned to</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((candidate) => (
          <TableRow key={candidate.leadId}>
            <TableCell>
              <div className="font-medium">{candidate.name}</div>
              <div className="text-xs text-muted-foreground">{candidate.phone}</div>
            </TableCell>
            <TableCell className="text-sm">
              {candidate.recommendedProgrammeName ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <ChecklistCell candidate={candidate} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {candidate.assignedToName ?? 'Unassigned'}
            </TableCell>
            <TableCell className="text-right">
              {candidate.checklist.satisfied ? (
                canConvert ? (
                  <Button size="sm" asChild>
                    <Link href={`/admissions/convert/${candidate.leadId}`}>Convert</Link>
                  </Button>
                ) : (
                  <StatusBadge kind="success" label="Ready" />
                )
              ) : (
                // Disabled with the reason attached — a disabled button that
                // does not say why is a dead end for the operator.
                <div className="flex flex-col items-end gap-1">
                  <Button size="sm" disabled>
                    Convert
                  </Button>
                  <span className="max-w-56 text-right text-xs text-muted-foreground">
                    {candidate.checklist.blocker}
                  </span>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
