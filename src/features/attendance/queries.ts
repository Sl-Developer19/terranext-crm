import 'server-only';

import { listRoster } from '@/features/batches/queries';

import {
  findBatchAttendanceSummary,
  findParticipantAttendance,
  findSessionAttendance,
} from './repository';
import type { AttendanceRow, ParticipantAttendanceEntry, SessionAttendanceSummary } from './schema';

/** Read models for the attendance grid (S25) and participant history. */

/**
 * The marking grid: every roster member, joined with any existing mark.
 * Roster-driven rather than mark-driven so an unmarked participant still
 * appears as a row to be marked, instead of silently missing.
 */
export async function getAttendanceGrid(
  batchId: string,
  sessionId: string,
): Promise<AttendanceRow[]> {
  const [roster, marks] = await Promise.all([
    listRoster(batchId),
    findSessionAttendance(batchId, sessionId),
  ]);

  const byParticipant = new Map(marks.map((mark) => [mark.participantId, mark.status]));
  return roster.map((entry) => ({
    participantId: entry.participantId,
    participantName: entry.participantName,
    phone: entry.phone,
    status: byParticipant.get(entry.participantId) ?? null,
  }));
}

export async function getBatchAttendanceSummary(
  batchId: string,
): Promise<SessionAttendanceSummary[]> {
  const roster = await listRoster(batchId);
  return findBatchAttendanceSummary(batchId, roster.length);
}

export async function getParticipantAttendance(
  participantId: string,
): Promise<ParticipantAttendanceEntry[]> {
  return findParticipantAttendance(participantId);
}
