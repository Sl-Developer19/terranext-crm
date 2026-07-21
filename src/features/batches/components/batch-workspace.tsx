'use client';

import { format } from 'date-fns';
import { CalendarCheck, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { regenerateSessions, setSessionStatus } from '../actions/manage-sessions';
import { setBatchStatus } from '../actions/manage-batch';
import { seatsRemaining, utilizationPct } from '../logic';
import {
  BATCH_STATUSES,
  SESSION_STATUSES,
  type Batch,
  type BatchSession,
  type BatchStatus,
  type RosterEntry,
  type SessionStatus,
} from '../schema';
import { BATCH_STATUS_BADGE, BATCH_STATUS_LABELS } from './batches-table';

const SESSION_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Scheduled',
  held: 'Held',
  cancelled: 'Cancelled',
};

/** S24 batch workspace: roster, sessions, status (Doc 16). */
export function BatchWorkspace({
  batch,
  sessions,
  roster,
  canUpdate,
}: {
  batch: Batch;
  sessions: BatchSession[];
  roster: RosterEntry[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const pct = utilizationPct(batch.enrolledCount, batch.capacity);
  const remaining = seatsRemaining(batch.enrolledCount, batch.capacity);

  const changeStatus = async (status: BatchStatus) => {
    if (status === batch.status) return;
    setPending(true);
    try {
      const outcome = await setBatchStatus({ batchId: batch.id, status });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`Batch marked ${BATCH_STATUS_LABELS[status].toLowerCase()}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const changeSessionStatus = async (sessionId: string, status: SessionStatus) => {
    const outcome = await setSessionStatus({ batchId: batch.id, sessionId, status });
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      return;
    }
    router.refresh();
  };

  const regenerate = async () => {
    setPending(true);
    try {
      const outcome = await regenerateSessions(batch.id);
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(
        outcome.data.created === 0
          ? 'The session calendar is already complete'
          : `${outcome.data.created} session${outcome.data.created === 1 ? '' : 's'} added`,
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <StatusBadge
          kind={BATCH_STATUS_BADGE[batch.status]}
          label={BATCH_STATUS_LABELS[batch.status]}
        />
        {canUpdate ? (
          <Select
            value={batch.status}
            disabled={pending}
            onValueChange={(v) => changeStatus(v as BatchStatus)}
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BATCH_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {BATCH_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-32 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${batch.enrolledCount} of ${batch.capacity} seats taken`}
          >
            <div
              className={pct >= 100 ? 'h-full bg-status-danger' : 'h-full bg-status-success'}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {batch.enrolledCount}/{batch.capacity} seats
            {remaining === 0 ? ' · full (BR-04)' : ` · ${remaining} free`}
          </span>
        </div>
      </div>

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="roster">
          <Card>
            <CardHeader>
              <CardTitle>Roster</CardTitle>
            </CardHeader>
            <CardContent className={roster.length === 0 ? undefined : 'p-0'}>
              {roster.length === 0 ? (
                <EmptyState
                  icon={Users}
                  headline="No participants allocated"
                  explanation="Allocate participants to this batch from their enrolment on the participant profile."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Enrolment status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((entry) => (
                      <TableRow key={entry.enrolmentId}>
                        <TableCell>
                          <Link
                            href={`/participants/${encodeURIComponent(entry.participantId)}`}
                            className="font-medium hover:underline"
                          >
                            {entry.participantName}
                          </Link>
                          <div className="text-xs text-muted-foreground">{entry.phone}</div>
                        </TableCell>
                        <TableCell>
                          <code className="font-mono text-xs text-muted-foreground">
                            {entry.participantId}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {entry.enrolmentStatus.replace('_', ' ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Sessions</CardTitle>
              {canUpdate ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={regenerate}>
                  <RefreshCw aria-hidden />
                  Generate missing
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className={sessions.length === 0 ? undefined : 'p-0'}>
              {sessions.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  headline="No sessions scheduled"
                  explanation="Generate the session calendar from this batch's weekly schedule."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          {format(new Date(session.date), 'PP')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {session.topic ?? '—'}
                        </TableCell>
                        <TableCell>
                          {canUpdate ? (
                            <Select
                              value={session.status}
                              onValueChange={(v) =>
                                changeSessionStatus(session.id, v as SessionStatus)
                              }
                            >
                              <SelectTrigger className="h-8 w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SESSION_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {SESSION_LABELS[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm">{SESSION_LABELS[session.status]}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Batch details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Programme</div>
                <div>{batch.programmeName ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Trainer</div>
                <div>{batch.trainerName ?? 'Unassigned'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Runs</div>
                <div>
                  {batch.startDate ? format(new Date(batch.startDate), 'PP') : '—'} →{' '}
                  {batch.endDate ? format(new Date(batch.endDate), 'PP') : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Schedule</div>
                <div className="uppercase">
                  {batch.schedule.days.join(' · ')} {batch.schedule.startTime}–
                  {batch.schedule.endTime}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
