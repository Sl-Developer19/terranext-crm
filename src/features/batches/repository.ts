import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { acceptsAllocations, hasCapacity } from './logic';
import type {
  Batch,
  BatchFilters,
  BatchSession,
  BatchStatus,
  RosterEntry,
  SessionStatus,
  Weekday,
} from './schema';

/** Batch data access (Doc 03 §1.2/§1.5). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toBatch(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  programmeName: string | null,
  trainerName: string | null,
): Batch {
  const data = doc.data() ?? {};
  const schedule = (data.schedule ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    programmeId: asString(data.programmeId),
    programmeName,
    academyId: asString(data.academyId),
    code: asString(data.code),
    startDate: asString(data.startDate),
    endDate: asString(data.endDate),
    capacity: asNumber(data.capacity),
    enrolledCount: asNumber(data.enrolledCount),
    trainerUid: asStringOrNull(data.trainerUid),
    trainerName,
    schedule: {
      days: Array.isArray(schedule.days) ? (schedule.days as Weekday[]) : [],
      startTime: asString(schedule.startTime),
      endTime: asString(schedule.endTime),
    },
    status: (data.status as BatchStatus) ?? 'planned',
  };
}

async function nameMaps(): Promise<{
  programmes: Map<string, string>;
  trainers: Map<string, string>;
}> {
  const db = adminDb();
  const [programmes, users] = await Promise.all([
    db.collection('programmes').get(),
    db.collection('users').get(),
  ]);
  return {
    programmes: new Map(programmes.docs.map((d) => [d.id, asString(d.get('name'))])),
    trainers: new Map(users.docs.map((d) => [d.id, asString(d.get('displayName'))])),
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function findBatches(filters: BatchFilters): Promise<Batch[]> {
  let query: Query = adminDb().collection('batches').where('deletedAt', '==', null);
  if (filters.programmeId) query = query.where('programmeId', '==', filters.programmeId);
  if (filters.status) query = query.where('status', '==', filters.status);
  if (filters.trainerUid) query = query.where('trainerUid', '==', filters.trainerUid);

  const [snap, names] = await Promise.all([
    query.orderBy('startDate', 'desc').limit(200).get(),
    nameMaps(),
  ]);
  return snap.docs.map((doc) =>
    toBatch(
      doc,
      names.programmes.get(asString(doc.get('programmeId'))) ?? null,
      names.trainers.get(asString(doc.get('trainerUid'))) ?? null,
    ),
  );
}

export async function findBatchById(batchId: string): Promise<Batch | null> {
  const snap = await adminDb().collection('batches').doc(batchId).get();
  if (!snap.exists || snap.get('deletedAt') !== null) return null;
  const names = await nameMaps();
  return toBatch(
    snap,
    names.programmes.get(asString(snap.get('programmeId'))) ?? null,
    names.trainers.get(asString(snap.get('trainerUid'))) ?? null,
  );
}

export async function isBatchCodeTaken(code: string, exceptId?: string): Promise<boolean> {
  const snap = await adminDb().collection('batches').where('code', '==', code).limit(2).get();
  return snap.docs.some((doc) => doc.id !== exceptId);
}

/** Other batches this trainer runs — the double-booking check reads these. */
export async function findTrainerBatches(trainerUid: string, exceptId?: string): Promise<Batch[]> {
  const snap = await adminDb()
    .collection('batches')
    .where('trainerUid', '==', trainerUid)
    .where('status', 'in', ['planned', 'running'])
    .get();
  return snap.docs.filter((doc) => doc.id !== exceptId).map((doc) => toBatch(doc, null, null));
}

export async function findSessions(batchId: string): Promise<BatchSession[]> {
  const snap = await adminDb()
    .collection('batches')
    .doc(batchId)
    .collection('sessions')
    .orderBy('date')
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      date: asString(data.date),
      topic: asStringOrNull(data.topic),
      trainerUid: asStringOrNull(data.trainerUid),
      status: (data.status as SessionStatus) ?? 'scheduled',
      heldAt: toIso(data.heldAt),
    };
  });
}

/**
 * Batch roster via a collection-group query on `enrolments` (Doc 03 §3 CG
 * index: batchId, status). The participant id is the enrolment's grandparent
 * document, so no extra lookup is needed to identify who is on the roster.
 *
 * Batch, attendance, and assessment detail pages all read the roster through
 * this one function — if the required collection-group index on `batchId`
 * is ever missing or still building, Firestore rejects the query outright
 * (`FAILED_PRECONDITION`), and without this guard that exception would
 * propagate up through every one of those pages' `Promise.all` and crash the
 * whole Server Component render. An empty roster is the correct degraded
 * state here (the page already renders "no participants allocated" for that
 * case) — the error is still logged, not swallowed silently.
 */
export async function findRoster(batchId: string): Promise<RosterEntry[]> {
  const db = adminDb();

  let snap;
  try {
    snap = await db.collectionGroup('enrolments').where('batchId', '==', batchId).get();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('findRoster: enrolments query failed, returning an empty roster', {
      batchId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const entries = await Promise.all(
    snap.docs.map(async (doc) => {
      const participantRef = doc.ref.parent.parent;
      if (!participantRef) return null;
      const participant = await participantRef.get();
      const personal = (participant.get('personal') ?? {}) as Record<string, unknown>;
      return {
        participantId: participant.id,
        participantName: asString(personal.fullName),
        phone: asString(personal.phone),
        enrolmentId: doc.id,
        enrolmentStatus: asString(doc.get('status')),
      };
    }),
  );

  return entries
    .filter((entry): entry is RosterEntry => entry !== null)
    .sort((a, b) => a.participantName.localeCompare(b.participantName));
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface BatchWriteModel {
  programmeId: string;
  academyId: string;
  code: string;
  startDate: string;
  endDate: string;
  capacity: number;
  trainerUid: string | null;
  days: Weekday[];
  startTime: string;
  endTime: string;
}

function batchFields(input: BatchWriteModel) {
  return {
    programmeId: input.programmeId,
    academyId: input.academyId,
    code: input.code,
    startDate: input.startDate,
    endDate: input.endDate,
    capacity: input.capacity,
    trainerUid: input.trainerUid,
    schedule: { days: input.days, startTime: input.startTime, endTime: input.endTime },
  };
}

export async function createBatchRecord(
  input: BatchWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('batches').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    ...batchFields(input),
    // Seeded at zero and only ever moved by the allocation transaction —
    // never written directly from a form (BR-04).
    enrolledCount: 0,
    status: 'planned',
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
    deletedAt: null,
    deletedBy: null,
  });
  return ref.id;
}

export async function updateBatchRecord(
  batchId: string,
  input: BatchWriteModel,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('batches')
    .doc(batchId)
    .update({ ...batchFields(input), updatedAt: new Date(), updatedBy: actorUid });
}

export async function setBatchStatusRecord(
  batchId: string,
  status: BatchStatus,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('batches')
    .doc(batchId)
    .update({ status, updatedAt: new Date(), updatedBy: actorUid });
}

export type AllocationOutcome =
  'allocated' | 'batch_full' | 'batch_missing' | 'already_allocated' | 'batch_not_accepting';

/**
 * BR-04 capacity allocation — the whole point of this module.
 *
 * The capacity check and the counter increment happen inside ONE transaction:
 * two coordinators allocating the last seat concurrently cannot both succeed,
 * because the second transaction re-reads the incremented count and retries.
 * Doing the check outside the transaction (read, decide, then write) is the
 * classic overbooking bug this design exists to prevent.
 */
export async function allocateToBatch(
  batchId: string,
  participantId: string,
  enrolmentId: string,
  actorUid: string,
): Promise<AllocationOutcome> {
  const db = adminDb();
  const batchRef = db.collection('batches').doc(batchId);
  const enrolmentRef = db
    .collection('participants')
    .doc(participantId)
    .collection('enrolments')
    .doc(enrolmentId);

  return db.runTransaction(async (tx) => {
    const [batchSnap, enrolmentSnap] = await Promise.all([tx.get(batchRef), tx.get(enrolmentRef)]);
    if (!batchSnap.exists || !enrolmentSnap.exists) return 'batch_missing';

    // Re-allocating to the same batch is a no-op, not a second seat.
    if (asString(enrolmentSnap.get('batchId')) === batchId) return 'already_allocated';

    // BR-04's capacity check is transactional (below); status must be
    // re-checked here too, not just in the action's pre-check — otherwise a
    // batch that transitions to completed/cancelled between the pre-check
    // and this transaction's commit could still receive an allocation.
    if (!acceptsAllocations(batchSnap.get('status') as BatchStatus)) {
      return 'batch_not_accepting';
    }

    const capacity = asNumber(batchSnap.get('capacity'));
    const enrolledCount = asNumber(batchSnap.get('enrolledCount'));
    if (!hasCapacity(enrolledCount, capacity)) return 'batch_full';

    const now = new Date();
    const previousBatchId = asStringOrNull(enrolmentSnap.get('batchId'));

    tx.update(batchRef, {
      enrolledCount: FieldValue.increment(1),
      updatedAt: now,
      updatedBy: actorUid,
    });
    tx.update(enrolmentRef, { batchId, updatedAt: now, updatedBy: actorUid });
    tx.update(db.collection('participants').doc(participantId), {
      currentBatchId: batchId,
      updatedAt: now,
      updatedBy: actorUid,
    });

    // Moving between batches must free the seat in the old one, or capacity
    // leaks one seat per transfer until the batch appears full while empty.
    if (previousBatchId) {
      tx.update(db.collection('batches').doc(previousBatchId), {
        enrolledCount: FieldValue.increment(-1),
        updatedAt: now,
        updatedBy: actorUid,
      });
    }

    tx.set(db.collection('participants').doc(participantId).collection('timeline').doc(), {
      type: 'batch_allocated',
      refPath: `batches/${batchId}`,
      summary: `Allocated to batch ${asString(batchSnap.get('code'))}`,
      at: now,
      byUid: actorUid,
    });

    return 'allocated';
  });
}

export async function createSessionRecord(
  batchId: string,
  input: { date: string; topic: string | null; trainerUid: string | null },
  actorUid: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('batches').doc(batchId).collection('sessions').doc();
  await ref.set({
    schemaVersion: 1,
    date: input.date,
    topic: input.topic,
    trainerUid: input.trainerUid,
    status: 'scheduled',
    heldAt: null,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return ref.id;
}

/** Bulk-creates the sessions implied by the batch schedule. */
export async function createSessionsForDates(
  batchId: string,
  dates: readonly string[],
  trainerUid: string | null,
  actorUid: string,
): Promise<number> {
  const db = adminDb();
  const sessionsRef = db.collection('batches').doc(batchId).collection('sessions');
  const existing = await sessionsRef.get();
  const taken = new Set(existing.docs.map((doc) => asString(doc.get('date'))));

  const now = new Date();
  const batch = db.batch();
  let created = 0;
  for (const date of dates) {
    // Idempotent by date: regenerating a schedule tops up missing sessions
    // rather than duplicating the ones already there.
    if (taken.has(date)) continue;
    batch.set(sessionsRef.doc(), {
      schemaVersion: 1,
      date,
      topic: null,
      trainerUid,
      status: 'scheduled',
      heldAt: null,
      createdAt: now,
      createdBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
    });
    created += 1;
  }
  if (created > 0) await batch.commit();
  return created;
}

/** Returns the session's prior status, for accurate before/after audit entries. */
export async function setSessionStatusRecord(
  batchId: string,
  sessionId: string,
  status: SessionStatus,
  actorUid: string,
): Promise<SessionStatus | null> {
  const now = new Date();
  const ref = adminDb().collection('batches').doc(batchId).collection('sessions').doc(sessionId);
  const snap = await ref.get();
  const previousStatus = (snap.get('status') as SessionStatus | undefined) ?? null;

  await ref.update({
    status,
    ...(status === 'held' ? { heldAt: now } : {}),
    updatedAt: now,
    updatedBy: actorUid,
  });

  return previousStatus;
}
