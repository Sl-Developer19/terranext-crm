'use client';

import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

import { markAttendance } from '../actions/mark-attendance';
import { ATTENDANCE_STATUSES, type AttendanceRow, type AttendanceStatus } from '../schema';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

const STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  late: 'L',
  excused: 'E',
};

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-status-success text-white',
  absent: 'bg-status-danger text-white',
  late: 'bg-status-progress text-white',
  excused: 'bg-status-neutral text-white',
};

/**
 * S25 marking grid. Optimised for the Doc 22 M4 acceptance target — a
 * 30-person roster marked on a phone in under two minutes:
 *
 * - one tap per participant, no dropdowns or dialogs in the hot path
 * - "Mark all present" seeds the common case so only exceptions are touched
 * - buttons are ≥44px touch targets and the whole grid saves in one write
 * - marks are held locally until Save, so a slow connection never blocks
 *   the next tap
 */
export function AttendanceGrid({
  batchId,
  sessionId,
  rows,
  canMark,
}: {
  batchId: string;
  sessionId: string;
  rows: AttendanceRow[];
  canMark: boolean;
}) {
  const router = useRouter();
  const [marks, setMarks] = React.useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(
      rows.filter((row) => row.status !== null).map((row) => [row.participantId, row.status!]),
    ),
  );
  const [saving, setSaving] = React.useState(false);

  const setMark = (participantId: string, status: AttendanceStatus) => {
    setMarks((current) => ({ ...current, [participantId]: status }));
  };

  const markAllPresent = () => {
    setMarks(Object.fromEntries(rows.map((row) => [row.participantId, 'present' as const])));
  };

  const markedCount = Object.keys(marks).length;
  const unmarked = rows.length - markedCount;

  const save = async () => {
    const payload = Object.entries(marks).map(([participantId, status]) => ({
      participantId,
      status,
    }));
    if (payload.length === 0) {
      toast.error('Mark at least one participant before saving.');
      return;
    }

    setSaving(true);
    try {
      const outcome = await markAttendance({ batchId, sessionId, marks: payload });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`Attendance saved for ${outcome.data.marked} participants`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        headline="No participants on this roster"
        explanation="Allocate participants to this batch before marking attendance."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>
          Attendance
          <span className="ml-2 font-normal text-muted-foreground">
            {markedCount}/{rows.length} marked
            {unmarked > 0 ? ` · ${unmarked} remaining` : ''}
          </span>
        </CardTitle>
        {canMark ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllPresent} disabled={saving}>
              Mark all present
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              Save attendance
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => {
          const current = marks[row.participantId];
          return (
            <div
              key={row.participantId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{row.participantName}</div>
                <div className="text-xs text-muted-foreground">{row.participantId}</div>
              </div>
              <div className="flex gap-1.5">
                {ATTENDANCE_STATUSES.map((status) => {
                  const active = current === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={!canMark || saving}
                      onClick={() => setMark(row.participantId, status)}
                      aria-pressed={active}
                      aria-label={`${STATUS_LABELS[status]} — ${row.participantName}`}
                      title={STATUS_LABELS[status]}
                      className={[
                        'size-11 rounded-md border text-sm font-semibold transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        active ? STATUS_STYLE[status] : 'bg-background hover:bg-accent',
                      ].join(' ')}
                    >
                      {STATUS_SHORT[status]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
