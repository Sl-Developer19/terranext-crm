'use client';

import { MessagesSquare } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { outcomeTone, partitionByHeld } from '../logic';
import { SESSION_MODE_LABELS, SESSION_OUTCOME_LABELS, type CounsellingSession } from '../schema';

function SessionTable({ rows, emptyLine }: { rows: CounsellingSession[]; emptyLine: string }) {
  if (rows.length === 0) {
    return <EmptyState icon={MessagesSquare} headline="Nothing here" explanation={emptyLine} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Held at</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead>Recommendation</TableHead>
          <TableHead>Consultant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium">{row.leadName}</div>
              <div className="max-w-xs truncate text-xs text-muted-foreground">{row.notes}</div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {row.heldAt ? new Date(row.heldAt).toLocaleString() : '—'}
            </TableCell>
            <TableCell className="text-sm">{SESSION_MODE_LABELS[row.mode]}</TableCell>
            <TableCell>
              <StatusBadge
                kind={outcomeTone(row.outcome)}
                label={SESSION_OUTCOME_LABELS[row.outcome]}
              />
            </TableCell>
            <TableCell className="text-sm">
              {row.recommendation ? (
                <>
                  <div>{row.recommendation.programmeName}</div>
                  {row.recommendation.remarks ? (
                    <div className="text-xs text-muted-foreground">
                      {row.recommendation.remarks}
                    </div>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{row.consultantName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** S12 — upcoming/held sessions (Doc 16). */
export function SessionsView({ sessions }: { sessions: CounsellingSession[] }) {
  // Recomputed per render so the split follows the clock, not the server's
  // render time — a session scheduled for later today should move to "held"
  // once it passes without needing a reload.
  const { upcoming, held } = React.useMemo(() => partitionByHeld(sessions), [sessions]);

  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="held">Held ({held.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming">
        <SessionTable
          rows={upcoming}
          emptyLine="No sessions are scheduled ahead of now. Record one when it is booked."
        />
      </TabsContent>
      <TabsContent value="held">
        <SessionTable
          rows={held}
          emptyLine="No sessions have been held yet. A recorded session is what makes a lead admissible (BR-02)."
        />
      </TabsContent>
    </Tabs>
  );
}
