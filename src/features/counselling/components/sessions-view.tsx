'use client';

import { MessagesSquare, Pencil } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
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

import { EditSessionDialog } from './edit-session-dialog';
import { outcomeTone, partitionByHeld } from '../logic';
import { SESSION_MODE_LABELS, SESSION_OUTCOME_LABELS, type CounsellingSession } from '../schema';

interface ProgrammeOption {
  id: string;
  name: string;
}

function SessionTable({
  rows,
  emptyLine,
  programmes = [],
  canEdit = false,
}: {
  rows: CounsellingSession[];
  emptyLine: string;
  programmes?: ProgrammeOption[];
  canEdit?: boolean;
}) {
  const [editingSession, setEditingSession] = React.useState<CounsellingSession | null>(null);

  if (rows.length === 0) {
    return <EmptyState icon={MessagesSquare} headline="Nothing here" explanation={emptyLine} />;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Held at</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Recommendation</TableHead>
            <TableHead>Consultant</TableHead>
            {canEdit ? <TableHead className="text-right">Actions</TableHead> : null}
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
              {canEdit ? (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit counselling session for ${row.leadName}`}
                    onClick={() => setEditingSession(row)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editingSession ? (
        <EditSessionDialog
          session={editingSession}
          programmes={programmes}
          open={editingSession !== null}
          onOpenChange={(next) => {
            if (!next) setEditingSession(null);
          }}
        />
      ) : null}
    </>
  );
}

/** S12 — upcoming/held sessions (Doc 16). Edit is offered only on Held
 * sessions (Task requirement) — a session that hasn't happened yet has
 * nothing to correct. */
export function SessionsView({
  sessions,
  programmes = [],
  canEdit = false,
}: {
  sessions: CounsellingSession[];
  programmes?: ProgrammeOption[];
  canEdit?: boolean;
}) {
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
          programmes={programmes}
          canEdit={canEdit}
        />
      </TabsContent>
    </Tabs>
  );
}
