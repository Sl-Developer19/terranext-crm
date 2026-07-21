'use client';

import { format } from 'date-fns';
import { BadgeCheck } from 'lucide-react';
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

import type { Assessment } from '../schema';

/** S26 assessment list. */
export function AssessmentsTable({ assessments }: { assessments: Assessment[] }) {
  if (assessments.length === 0) {
    return (
      <EmptyState
        icon={BadgeCheck}
        headline="No assessments yet"
        explanation="Create an assessment against a batch, then enter scores for its roster."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Assessment</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Held</TableHead>
          <TableHead>Pass mark</TableHead>
          <TableHead>Scores</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assessments.map((assessment) => (
          <TableRow key={assessment.id}>
            <TableCell>
              <Link href={`/assessments/${assessment.id}`} className="font-medium hover:underline">
                {assessment.name}
              </Link>
            </TableCell>
            <TableCell className="text-sm">{assessment.batchCode ?? '—'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {assessment.heldAt ? format(new Date(assessment.heldAt), 'PP') : '—'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {assessment.passScore}/{assessment.maxScore}
            </TableCell>
            <TableCell>
              <StatusBadge
                kind={assessment.scoredCount > 0 ? 'success' : 'neutral'}
                label={`${assessment.scoredCount} entered`}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
