import { Trophy } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPaise } from '@/features/catalogue/logic';

import type { LeaderboardEntry } from '../logic';

/** Doc 25 §6 — Top/Lowest Performing Partners; a single ranked list serves both. */
export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        headline="No ranked partners yet"
        explanation="Partners appear here once a referral earns its first reward."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">Rank</TableHead>
          <TableHead>Partner</TableHead>
          <TableHead>Total earned</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.partnerId}>
            <TableCell className="font-mono text-sm text-muted-foreground">#{entry.rank}</TableCell>
            <TableCell className="text-sm">{entry.partnerName}</TableCell>
            <TableCell className="font-medium">{formatPaise(entry.totalPaise)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
