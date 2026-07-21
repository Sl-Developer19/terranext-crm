import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { calculateAttendancePct } from './logic';
import type {
  AttendanceRecord,
  AttendanceStatus,
  ParticipantAttendanceEntry,
  SessionAttendanceSummary,
} from './schema';

/** Attendance data access (Doc 03 §1.5). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function findSessionAttendance(
  batchId: string,
  sessionId: string,
): Promise<AttendanceRecord[]> {
  const snap = await adminDb()
    .collection('batches')
    .doc(batchId)
    .collection('sessions')
    .doc(sessionId)
    .collection('attendance')
    .get();

  return snap.docs.map((doc) => ({
    participantId: doc.id,
    status: doc.get('status') as AttendanceStatus,
    markedBy: asString(doc.get('markedBy')),
    markedAt: toIso(doc.get('markedAt')) ?? '',
  }));
}

/** Per-session marked/present counts for the batch attendance overview. */
export async function findBatchAttendanceSummary(
  batchId: string,
  rosterSize: number,
): Promise<SessionAttendanceSummary[]> {
  const db = adminDb();
  const sessions = await db
    .collection('batches')
    .doc(batchId)
    .collection('sessions')
    .orderBy('date')
    .get();

  return Promise.all(
    sessions.docs.map(async (sessionDoc) => {
      const marks = await sessionDoc.ref.collection('attendance').get();
      const statuses = marks.docs.map((d) => d.get('status') as AttendanceStatus);
      return {
        sessionId: sessionDoc.id,
        date: asString(sessionDoc.get('date')),
        status: asString(sessionDoc.get('status')),
        marked: statuses.length,
        present: statuses.filter((s) => s === 'present' || s === 'late').length,
        absent: statuses.filter((s) => s === 'absent').length,
        rosterSize,
      };
    }),
  );
}

/**
 * A participant's attendance across every batch, via the collection-group
 * index on `participantId` (Doc 03 §3). This is what makes "one lifetime
 * record" answerable for attendance without walking every batch.
 */
export async function findParticipantAttendance(
  participantId: string,
): Promise<ParticipantAttendanceEntry[]> {
  const snap = await adminDb()
    .collectionGroup('attendance')
    .where('participantId', '==', participantId)
    .orderBy('markedAt', 'desc')
    .limit(500)
    .get();

  return snap.docs.map((doc) => ({
    batchId: asString(doc.get('batchId')),
    sessionId: doc.ref.parent.parent?.id ?? '',
    status: doc.get('status') as AttendanceStatus,
    markedAt: toIso(doc.get('markedAt')) ?? '',
  }));
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface AttendanceMark {
  participantId: string;
  status: AttendanceStatus;
}

/**
 * Writes a session's marks, then recomputes each affected participant's
 * `attendancePct` from their FULL attendance history for that batch.
 *
 * The recompute is deliberately not an increment (Doc 19 §3, condition C-2):
 * a full recompute is naturally idempotent, so a retried write, a corrected
 * mark, or a replayed trigger all converge on the same answer instead of
 * drifting. The cost is one collection-group read per participant per save,
 * which is cheap next to silently wrong certificate eligibility.
 */
export async function markSessionAttendance(
  batchId: string,
  sessionId: string,
  programmeId: string,
  marks: readonly AttendanceMark[],
  actorUid: string,
): Promise<void> {
  const db = adminDb();
  const attendanceRef = db
    .collection('batches')
    .doc(batchId)
    .collection('sessions')
    .doc(sessionId)
    .collection('attendance');

  const now = new Date();
  const batch = db.batch();
  for (const mark of marks) {
    // Participant-keyed: re-marking overwrites rather than appending, so a
    // corrected mark replaces the wrong one instead of coexisting with it.
    batch.set(
      attendanceRef.doc(mark.participantId),
      {
        schemaVersion: 1,
        participantId: mark.participantId,
        // Duplicated onto every mark so collection-group queries can filter
        // without loading the parent session and batch (Doc 03 §1.5).
        batchId,
        programmeId,
        status: mark.status,
        markedBy: actorUid,
        markedAt: now,
      },
      { merge: true },
    );
  }
  await batch.commit();

  await Promise.all(marks.map((mark) => recomputeEnrolmentAttendance(mark.participantId, batchId)));
}

/**
 * Recomputes `enrolments.attendancePct` for one participant in one batch
 * from raw attendance documents. Display-only by design (C-2): certificate
 * issuance recomputes from raw data in-transaction rather than trusting
 * this roll-up, so a stale value here can never let an ineligible
 * participant through.
 */
export async function recomputeEnrolmentAttendance(
  participantId: string,
  batchId: string,
): Promise<void> {
  const db = adminDb();

  const marks = await db
    .collectionGroup('attendance')
    .where('participantId', '==', participantId)
    .where('batchId', '==', batchId)
    .get();

  const pct = calculateAttendancePct(marks.docs.map((d) => d.get('status') as AttendanceStatus));

  const enrolments = await db
    .collection('participants')
    .doc(participantId)
    .collection('enrolments')
    .where('batchId', '==', batchId)
    .get();

  await Promise.all(
    enrolments.docs.map((doc) => doc.ref.update({ attendancePct: pct, updatedAt: new Date() })),
  );
}
