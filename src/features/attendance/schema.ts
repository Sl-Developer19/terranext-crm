import { z } from 'zod';

/**
 * Session attendance (Doc 03 §1.5, Doc 14 §7). Stored at
 * `batches/{batchId}/sessions/{sessionId}/attendance/{participantId}` —
 * participant-keyed so marking is idempotent: re-marking overwrites the same
 * document rather than appending a second opinion.
 */

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const attendanceMarkSchema = z
  .object({
    participantId: z.string().min(1),
    status: z.enum(ATTENDANCE_STATUSES),
  })
  .strict();

export const markAttendanceSchema = z
  .object({
    batchId: z.string().min(1),
    sessionId: z.string().min(1),
    marks: z.array(attendanceMarkSchema).min(1, 'Mark at least one participant').max(500),
  })
  .strict();

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface AttendanceRecord {
  participantId: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
}

/** One row of the marking grid: roster entry joined with any existing mark. */
export interface AttendanceRow {
  participantId: string;
  participantName: string;
  phone: string;
  status: AttendanceStatus | null;
}

export interface SessionAttendanceSummary {
  sessionId: string;
  date: string;
  status: string;
  marked: number;
  present: number;
  absent: number;
  rosterSize: number;
}

/** Per-participant lifetime attendance across batches (collection-group read). */
export interface ParticipantAttendanceEntry {
  batchId: string;
  sessionId: string;
  status: AttendanceStatus;
  markedAt: string;
}
