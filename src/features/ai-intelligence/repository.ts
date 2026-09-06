import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { isRecordingSourceKind } from './audio/device-classification';
import {
  aggregateDashboardStats,
  closeTrailingPauseEvent,
  computeSessionDurationSeconds,
  sessionChunkStoragePath,
  sumPausedSeconds,
  todayIsoDate,
  type DashboardStatsSessionInput,
  type PauseEventInput,
} from './logic';
import { CHANNEL_ROLES } from './schema';
import type {
  AiAnalyticsDay,
  AiDashboardStats,
  AiIntelligenceSettings,
  AiJobStage,
  AiProcessingJob,
  AiSession,
  AiSessionChunk,
  AiSessionStatus,
  AiSummary,
  AiTranscript,
  ChannelRole,
  ChannelRoleMapping,
  ChunkStatus,
  PauseEvent,
  RecordingSourceKind,
  TranscriptSegment,
} from './schema';

/** AI Intelligence Platform data access. Actions own permission + audit; the
 * processing pipeline (Cloud Function) writes jobs/transcripts/summaries. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}
function toIsoOrNull(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

/**
 * Firestore raises FAILED_PRECONDITION (gRPC code 9) when a query needs a
 * composite index that doesn't exist yet, or is still building after being
 * deployed — index builds are asynchronous and can take minutes on a
 * collection with existing documents. Detected by code rather than by
 * `instanceof` since the admin SDK doesn't guarantee a stable error class
 * across transports. Callers use this to degrade to an empty read instead of
 * a 500 while the index catches up.
 */
function isIndexBuildingError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (code === 9 || code === 'failed-precondition') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /requires an index/i.test(message);
}

/** Reads a stored `pauseHistory` array entry back into Date-based pure-logic
 * input — written with `new Date()` (not `serverTimestamp()`, which
 * Firestore rejects inside array elements), so these round-trip as
 * `Timestamp` on read like every other date field in this module. */
function toPauseEventInput(raw: unknown): PauseEventInput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const pausedAt = obj.pausedAt instanceof Timestamp ? obj.pausedAt.toDate() : new Date(0);
  const resumedAt = obj.resumedAt instanceof Timestamp ? obj.resumedAt.toDate() : null;
  const durationSeconds = typeof obj.durationSeconds === 'number' ? obj.durationSeconds : null;
  return { pausedAt, resumedAt, durationSeconds };
}

function toPauseHistory(raw: unknown): PauseEventInput[] {
  return Array.isArray(raw) ? raw.map(toPauseEventInput) : [];
}

function toPauseEventReadModel(event: PauseEventInput): PauseEvent {
  return {
    pausedAt: event.pausedAt.toISOString(),
    resumedAt: event.resumedAt ? event.resumedAt.toISOString() : null,
    durationSeconds: event.durationSeconds,
  };
}

interface Lookups {
  trainerNames: Map<string, string>;
  batchNames: Map<string, string>;
  programmeNames: Map<string, string>;
}

async function resolveMap(
  collection: string,
  ids: Iterable<string>,
  field: string,
): Promise<Map<string, string>> {
  const db = adminDb();
  const unique = [...new Set(ids)].filter((id) => id.length > 0);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const snap = await db.collection(collection).doc(id).get();
      map.set(id, asString(snap.get(field)));
    }),
  );
  return map;
}

async function loadLookups(
  docs: FirebaseFirestore.QueryDocumentSnapshot[] | FirebaseFirestore.DocumentSnapshot[],
): Promise<Lookups> {
  const trainerUids = docs.map((d) => asString(d.get('trainerUid')));
  const batchIds = docs.map((d) => asString(d.get('batchId')));
  const programmeIds = docs.map((d) => asString(d.get('programmeId')));

  const [trainerNames, batchNames, programmeNames] = await Promise.all([
    resolveMap('users', trainerUids, 'displayName'),
    resolveMap('batches', batchIds, 'code'),
    resolveMap('programmes', programmeIds, 'name'),
  ]);

  return { trainerNames, batchNames, programmeNames };
}

function toSession(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  lookups: Lookups,
): AiSession {
  const data = doc.data() ?? {};
  const trainerUid = asString(data.trainerUid);
  const batchId = asStringOrNull(data.batchId);
  const programmeId = asStringOrNull(data.programmeId);

  return {
    id: doc.id,
    title: asString(data.title),
    status: (asString(data.status) || 'draft') as AiSessionStatus,
    trainerUid,
    trainerName: lookups.trainerNames.get(trainerUid) ?? trainerUid,
    batchId,
    batchName: batchId ? (lookups.batchNames.get(batchId) ?? batchId) : null,
    programmeId,
    programmeName: programmeId ? (lookups.programmeNames.get(programmeId) ?? programmeId) : null,
    deviceLabel: asStringOrNull(data.deviceLabel),
    totalChunks: asNumberOrNull(data.totalChunks),
    durationSeconds: asNumberOrNull(data.durationSeconds),
    sessionDurationSeconds: asNumberOrNull(data.sessionDurationSeconds),
    pausedDurationSeconds: asNumberOrNull(data.pausedDurationSeconds) ?? 0,
    pauseCount: asNumberOrNull(data.pauseCount) ?? 0,
    pauseHistory: toPauseHistory(data.pauseHistory).map(toPauseEventReadModel),
    // Every session created before channel-preserving capture existed has
    // no such field — 1 (single mixed stream) is the accurate value for
    // every one of them, not just a fallback.
    capturedChannelCount: asNumberOrNull(data.capturedChannelCount) ?? 1,
    processingJobId: asStringOrNull(data.processingJobId),
    transcriptId: asStringOrNull(data.transcriptId),
    summaryId: asStringOrNull(data.summaryId),
    startedAt: toIsoOrNull(data.startedAt),
    endedAt: toIsoOrNull(data.endedAt),
    createdAt: toIso(data.createdAt),
    createdBy: asString(data.createdBy),
    updatedAt: toIso(data.updatedAt) || toIso(data.createdAt),
    updatedBy: asString(data.updatedBy) || asString(data.createdBy),
    deletedAt: toIsoOrNull(data.deletedAt),
  };
}

const SESSIONS_COLLECTION = 'aiSessions';
const CHUNKS_SUBCOLLECTION = 'chunks';
const JOBS_COLLECTION = 'aiProcessingJobs';
const TRANSCRIPTS_COLLECTION = 'aiTranscripts';
const SUMMARIES_COLLECTION = 'aiSummaries';
const ANALYTICS_COLLECTION = 'aiAnalytics';
const SETTINGS_DOC_PATH = 'aiIntelligenceSettings/config';

export async function findSessions(options?: { trainerUid?: string }): Promise<AiSession[]> {
  let query: FirebaseFirestore.Query = adminDb()
    .collection(SESSIONS_COLLECTION)
    .where('deletedAt', '==', null);
  if (options?.trainerUid) {
    query = query.where('trainerUid', '==', options.trainerUid);
  }

  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await query.orderBy('createdAt', 'desc').limit(500).get();
  } catch (error) {
    if (isIndexBuildingError(error)) {
      console.warn(
        '[ai-intelligence] aiSessions composite index is not ready yet — returning an empty session list until it finishes building.',
        error,
      );
      return [];
    }
    throw error;
  }

  const lookups = await loadLookups(snap.docs);
  return snap.docs.map((doc) => toSession(doc, lookups));
}

export async function findSessionById(sessionId: string): Promise<AiSession | null> {
  const snap = await adminDb().collection(SESSIONS_COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  const lookups = await loadLookups([snap]);
  return toSession(snap, lookups);
}

export interface SessionCreateModel {
  title: string;
  batchId: string | null;
  programmeId: string | null;
  deviceLabel: string | null;
}

export async function createSessionRecord(
  input: SessionCreateModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection(SESSIONS_COLLECTION).doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    title: input.title,
    status: 'draft' satisfies AiSessionStatus,
    trainerUid: actorUid,
    batchId: input.batchId,
    programmeId: input.programmeId,
    deviceLabel: input.deviceLabel,
    totalChunks: null,
    durationSeconds: null,
    sessionDurationSeconds: null,
    pausedDurationSeconds: 0,
    pauseCount: 0,
    pauseHistory: [],
    capturedChannelCount: 1,
    processingJobId: null,
    transcriptId: null,
    summaryId: null,
    startedAt: null,
    endedAt: null,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
    deletedAt: null,
  });
  return ref.id;
}

export async function findSessionMeta(
  sessionId: string,
): Promise<{ status: AiSessionStatus; trainerUid: string; title: string } | null> {
  const snap = await adminDb().collection(SESSIONS_COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  return {
    status: (asString(snap.get('status')) || 'draft') as AiSessionStatus,
    trainerUid: asString(snap.get('trainerUid')),
    title: asString(snap.get('title')) || 'Untitled session',
  };
}

/** `null` channelIndex (the single-mixed-stream case, every session today)
 * keeps the exact doc ID scheme this always used — `String(chunkIndex)` —
 * so nothing about an existing session's chunk documents changes. Only
 * channel-preserving capture (multiple chunks legitimately sharing one
 * `chunkIndex`, one per physical channel) ever produces the composite form. */
function chunkDocId(chunkIndex: number, channelIndex: number | null): string {
  return channelIndex === null ? String(chunkIndex) : `${chunkIndex}-${channelIndex}`;
}

function chunkDocRef(sessionId: string, chunkIndex: number, channelIndex: number | null = null) {
  return adminDb()
    .collection(SESSIONS_COLLECTION)
    .doc(sessionId)
    .collection(CHUNKS_SUBCOLLECTION)
    .doc(chunkDocId(chunkIndex, channelIndex));
}

function toChunk(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): AiSessionChunk {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    sessionId: asString(data.sessionId),
    chunkIndex: asNumberOrNull(data.chunkIndex) ?? 0,
    status: (asString(data.status) || 'uploading') as ChunkStatus,
    storagePath: asStringOrNull(data.storagePath),
    contentType: asStringOrNull(data.contentType),
    sizeBytes: asNumberOrNull(data.sizeBytes),
    startOffsetSec: asNumberOrNull(data.startOffsetSec) ?? 0,
    durationSeconds: asNumberOrNull(data.durationSeconds),
    attempts: asNumberOrNull(data.attempts) ?? 0,
    error: asStringOrNull(data.error),
    channelIndex: asNumberOrNull(data.channelIndex),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt) || toIso(data.createdAt),
  };
}

export type StartRecordingOutcome = 'started' | 'already-recording' | 'invalid';

/**
 * Atomically transitions a session `draft` -> `recording` the moment the
 * trainer's MediaRecorder actually starts capturing — deliberately
 * independent of chunk 0's upload, which may not complete for up to
 * `CHUNK_DURATION_SECONDS`. Pause/Resume require the server-side session to
 * already be `recording`, so that transition can no longer wait on the first
 * chunk finishing.
 *
 * Idempotent: a retried call that finds the session already `recording`
 * (e.g. a network retry of the same Start click whose first attempt actually
 * landed) is treated as success rather than rejected — same retry tolerance
 * `markSessionRecordingStarted` below already relies on. Any other status
 * (`paused`, `processing`, `completed`, `failed`, or a missing doc) is
 * `'invalid'`: Start was clicked on a session that was never a fresh draft.
 */
export async function markSessionRecordingStartedIfDraft(
  sessionId: string,
  actorUid: string,
): Promise<StartRecordingOutcome> {
  const ref = adminDb().collection(SESSIONS_COLLECTION).doc(sessionId);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'invalid';
    const status = snap.get('status') as AiSessionStatus;
    if (status === 'recording') return 'already-recording';
    if (status !== 'draft') return 'invalid';

    tx.update(ref, {
      status: 'recording' satisfies AiSessionStatus,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
    return 'started';
  });
}

/**
 * Marks the session `recording` and records when it started. Now only a
 * fallback for chunk 0's upload ticket ({@link markSessionRecordingStartedIfDraft}
 * is the primary path, called from `startSessionRecording` at the moment
 * recording begins): if a session somehow reaches chunk 0's ticket request
 * while still `draft` — e.g. the client's `startSessionRecording` call was
 * lost — this keeps the old behavior of flipping status here rather than
 * rejecting the upload outright. Unconditional update, not transactional, so
 * callers must already know the current status is `draft` before calling.
 */
export async function markSessionRecordingStarted(
  sessionId: string,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection(SESSIONS_COLLECTION)
    .doc(sessionId)
    .update({
      status: 'recording' satisfies AiSessionStatus,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
}

/**
 * Pauses an actively recording session — transactional so a double-click (or
 * a second browser tab) safely no-ops rather than double-counting a pause.
 * The client is expected to call `MediaRecorder.pause()` only after this
 * resolves `true`, keeping the server record authoritative even under a
 * network race. Returns `false` if the session wasn't `recording`.
 */
export async function markSessionPaused(sessionId: string, actorUid: string): Promise<boolean> {
  const ref = adminDb().collection(SESSIONS_COLLECTION).doc(sessionId);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('status') !== 'recording') return false;

    const history = toPauseHistory(snap.get('pauseHistory'));
    const now = new Date();
    const updated: PauseEventInput[] = [
      ...history,
      { pausedAt: now, resumedAt: null, durationSeconds: null },
    ];

    tx.update(ref, {
      status: 'paused' satisfies AiSessionStatus,
      pauseCount: updated.length,
      pausedDurationSeconds: sumPausedSeconds(updated),
      pauseHistory: updated,
      updatedAt: now,
      updatedBy: actorUid,
    });
    return true;
  });
}

/**
 * Resumes a paused session, closing the trailing open pause event and
 * folding its duration into `pausedDurationSeconds`. Same double-click/race
 * safety as `markSessionPaused`. Returns `false` if the session wasn't
 * `paused`.
 */
export async function markSessionResumed(sessionId: string, actorUid: string): Promise<boolean> {
  const ref = adminDb().collection(SESSIONS_COLLECTION).doc(sessionId);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('status') !== 'paused') return false;

    const history = toPauseHistory(snap.get('pauseHistory'));
    const now = new Date();
    const { history: closed } = closeTrailingPauseEvent(history, now);

    tx.update(ref, {
      status: 'recording' satisfies AiSessionStatus,
      pauseCount: closed.length,
      pausedDurationSeconds: sumPausedSeconds(closed),
      pauseHistory: closed,
      updatedAt: now,
      updatedBy: actorUid,
    });
    return true;
  });
}

/** Creates (or re-issues, on a retried upload) the chunk's storage path
 * before the signed URL is minted. `channelIndex` is `null` for the
 * single-mixed-stream case — every session today. */
export async function reserveChunkUploadPath(
  sessionId: string,
  chunkIndex: number,
  contentType: string,
  sizeBytes: number,
  startOffsetSec: number,
  actorUid: string,
  channelIndex: number | null = null,
): Promise<string> {
  const storagePath = sessionChunkStoragePath(sessionId, chunkIndex, contentType, channelIndex);
  const now = new Date();
  await chunkDocRef(sessionId, chunkIndex, channelIndex).set(
    {
      schemaVersion: 1,
      sessionId,
      chunkIndex,
      channelIndex,
      status: 'uploading' satisfies ChunkStatus,
      storagePath,
      contentType,
      sizeBytes,
      startOffsetSec,
      durationSeconds: null,
      attempts: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
      updatedBy: actorUid,
    },
    { merge: true },
  );
  return storagePath;
}

export async function findChunkMeta(
  sessionId: string,
  chunkIndex: number,
  channelIndex: number | null = null,
): Promise<{
  status: ChunkStatus;
  storagePath: string | null;
  contentType: string | null;
  expectedSizeBytes: number | null;
} | null> {
  const snap = await chunkDocRef(sessionId, chunkIndex, channelIndex).get();
  if (!snap.exists) return null;
  return {
    status: (asString(snap.get('status')) || 'uploading') as ChunkStatus,
    storagePath: asStringOrNull(snap.get('storagePath')),
    contentType: asStringOrNull(snap.get('contentType')),
    expectedSizeBytes: asNumberOrNull(snap.get('sizeBytes')),
  };
}

export async function markChunkUploaded(
  sessionId: string,
  chunkIndex: number,
  durationSeconds: number,
  actorUid: string,
  channelIndex: number | null = null,
): Promise<void> {
  await chunkDocRef(sessionId, chunkIndex, channelIndex).update({
    status: 'uploaded' satisfies ChunkStatus,
    durationSeconds,
    updatedAt: new Date(),
    updatedBy: actorUid,
  });
}

export async function markChunkUploadFailed(
  sessionId: string,
  chunkIndex: number,
  actorUid: string,
  channelIndex: number | null = null,
): Promise<void> {
  await chunkDocRef(sessionId, chunkIndex, channelIndex).update({
    status: 'failed' satisfies ChunkStatus,
    updatedAt: new Date(),
    updatedBy: actorUid,
  });
}

/** Ordered by chunkIndex — used by `finalizeSessionRecording` to verify every chunk actually landed. */
export async function findSessionChunks(sessionId: string): Promise<AiSessionChunk[]> {
  const snap = await adminDb()
    .collection(SESSIONS_COLLECTION)
    .doc(sessionId)
    .collection(CHUNKS_SUBCOLLECTION)
    .orderBy('chunkIndex', 'asc')
    .get();
  return snap.docs.map(toChunk);
}

/**
 * Reconstructs how much of a recording actually reached Storage, purely from
 * confirmed chunk documents — the admin "stop this session" recovery path
 * (`adminStopStalledSession`) for when the tab that was recording is gone and
 * nothing client-side remains to report `totalChunks`/`totalDurationSeconds`
 * the way `finalizeSessionRecording` normally expects.
 *
 * Chunk indices are contiguous by construction (see `startNextChunkRecorder`
 * in `SessionRecorder`), so the first index whose expected channels aren't
 * all `uploaded` — a rollover that never finished because the tab died mid
 * chunk — marks the end of what can be trusted; anything from that index on
 * is dropped rather than guessed at. Returns `null` when not even chunk 0
 * finished uploading, i.e. there is nothing yet to save.
 */
export async function computeUploadedRecordingExtent(sessionId: string): Promise<{
  totalChunks: number;
  totalDurationSeconds: number;
  capturedChannelCount: number;
} | null> {
  const chunks = await findSessionChunks(sessionId);
  if (chunks.length === 0) return null;

  const byChunkIndex = new Map<number, AiSessionChunk[]>();
  let maxChunkIndex = 0;
  for (const chunk of chunks) {
    maxChunkIndex = Math.max(maxChunkIndex, chunk.chunkIndex);
    const group = byChunkIndex.get(chunk.chunkIndex) ?? [];
    group.push(chunk);
    byChunkIndex.set(chunk.chunkIndex, group);
  }

  const chunk0Group = byChunkIndex.get(0) ?? [];
  const capturedChannelCount = chunk0Group.some((chunk) => chunk.channelIndex !== null)
    ? new Set(chunk0Group.map((chunk) => chunk.channelIndex)).size
    : 1;

  let totalChunks = 0;
  let totalDurationSeconds = 0;
  for (let index = 0; index <= maxChunkIndex; index++) {
    const uploaded = (byChunkIndex.get(index) ?? []).filter((chunk) => chunk.status === 'uploaded');
    if (uploaded.length !== capturedChannelCount) break;
    totalChunks = index + 1;
    for (const chunk of uploaded) {
      const end = chunk.startOffsetSec + (chunk.durationSeconds ?? 0);
      if (end > totalDurationSeconds) totalDurationSeconds = end;
    }
  }

  if (totalChunks === 0) return null;
  return { totalChunks, totalDurationSeconds, capturedChannelCount };
}

/**
 * Confirms every expected chunk uploaded and enqueues processing — the
 * automatic pipeline's entry point. Also closes out a trailing open pause
 * event (the trainer clicked Stop while paused, never Resume) so
 * `pausedDurationSeconds`/`sessionDurationSeconds` are correct even in that
 * case, without requiring the client to resume first.
 */
export async function finalizeSessionAndEnqueue(
  sessionId: string,
  sessionTitle: string,
  totalChunks: number,
  totalDurationSeconds: number,
  actorUid: string,
  capturedChannelCount: number = 1,
): Promise<string> {
  const db = adminDb();
  const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
  const jobRef = db.collection(JOBS_COLLECTION).doc();
  const now = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    const history = toPauseHistory(snap.get('pauseHistory'));
    const { history: closed } = closeTrailingPauseEvent(history, now);
    const pausedDurationSeconds = sumPausedSeconds(closed);

    tx.update(sessionRef, {
      status: 'processing' satisfies AiSessionStatus,
      totalChunks,
      capturedChannelCount,
      durationSeconds: totalDurationSeconds,
      pauseHistory: closed,
      pauseCount: closed.length,
      pausedDurationSeconds,
      sessionDurationSeconds: computeSessionDurationSeconds(
        totalDurationSeconds,
        pausedDurationSeconds,
      ),
      endedAt: FieldValue.serverTimestamp(),
      processingJobId: jobRef.id,
      updatedAt: now,
      updatedBy: actorUid,
    });
    tx.set(jobRef, {
      schemaVersion: 1,
      sessionId,
      sessionTitle,
      stage: 'queued' satisfies AiJobStage,
      progressPercent: 0,
      chunksCompleted: 0,
      chunksTotal: totalChunks,
      attempts: 0,
      error: null,
      speechProvider: null,
      summaryProvider: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return jobRef.id;
}

export async function softDeleteSession(sessionId: string, actorUid: string): Promise<void> {
  await adminDb().collection(SESSIONS_COLLECTION).doc(sessionId).update({
    deletedAt: new Date(),
    updatedAt: new Date(),
    updatedBy: actorUid,
  });
}

function toJob(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): AiProcessingJob {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    sessionId: asString(data.sessionId),
    sessionTitle: asString(data.sessionTitle),
    stage: (asString(data.stage) || 'queued') as AiJobStage,
    progressPercent: asNumberOrNull(data.progressPercent) ?? 0,
    chunksCompleted: asNumberOrNull(data.chunksCompleted),
    chunksTotal: asNumberOrNull(data.chunksTotal),
    attempts: asNumberOrNull(data.attempts) ?? 0,
    error: asStringOrNull(data.error),
    failedAtStage: asStringOrNull(data.failedAtStage) as AiJobStage | null,
    speechProvider: asStringOrNull(data.speechProvider),
    summaryProvider: asStringOrNull(data.summaryProvider),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt) || toIso(data.createdAt),
  };
}

export async function findProcessingJobs(): Promise<AiProcessingJob[]> {
  const snap = await adminDb()
    .collection(JOBS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  return snap.docs.map(toJob);
}

export async function findProcessingJobById(jobId: string): Promise<AiProcessingJob | null> {
  const snap = await adminDb().collection(JOBS_COLLECTION).doc(jobId).get();
  return snap.exists ? toJob(snap) : null;
}

/**
 * Re-queues a failed job — conditionally, inside a transaction, so two
 * concurrent retry clicks (or two browser tabs) can't both win: the second
 * transaction re-reads the doc and finds `stage` is no longer `'failed'`,
 * so it's a no-op rather than a second `'queued'` write that would double-
 * trigger the pipeline. Returns whether this call actually performed the
 * retry.
 */
export async function retryProcessingJobRecord(jobId: string): Promise<boolean> {
  const ref = adminDb().collection(JOBS_COLLECTION).doc(jobId);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('stage') !== 'failed') return false;
    tx.update(ref, {
      stage: 'queued' satisfies AiJobStage,
      error: null,
      failedAtStage: null,
      attempts: FieldValue.increment(1),
      updatedAt: new Date(),
    });
    return true;
  });
}

const SPEAKER_ROLE_VALUES = new Set(['trainer', 'student', 'unknown']);

/** Defensive read, not a raw cast: a transcript written before
 * `attributionSource`/`channelIndex` existed has neither field, and must
 * read back as `'heuristic'`/`null` — the honest default — rather than
 * `undefined` leaking into UI code that assumes the enum is always set. */
function toTranscriptSegment(raw: unknown): TranscriptSegment {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const speaker = asString(obj.speaker);
  const attributionSource = asString(obj.attributionSource);
  return {
    speaker: (SPEAKER_ROLE_VALUES.has(speaker)
      ? speaker
      : 'unknown') as TranscriptSegment['speaker'],
    speakerLabel: asString(obj.speakerLabel) || 'Unknown speaker',
    text: asString(obj.text),
    startSec: asNumberOrNull(obj.startSec) ?? 0,
    endSec: asNumberOrNull(obj.endSec) ?? 0,
    attributionSource: attributionSource === 'channel' ? 'channel' : 'heuristic',
    channelIndex: asNumberOrNull(obj.channelIndex),
  };
}

export async function findTranscriptBySessionId(sessionId: string): Promise<AiTranscript | null> {
  const snap = await adminDb().collection(TRANSCRIPTS_COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const segments = Array.isArray(data.segments) ? data.segments.map(toTranscriptSegment) : [];
  return {
    id: snap.id,
    sessionId: asString(data.sessionId),
    language: asString(data.language) || 'en',
    fullText: asString(data.fullText),
    segments,
    createdAt: toIso(data.createdAt),
  };
}

export async function findSummaryBySessionId(sessionId: string): Promise<AiSummary | null> {
  const snap = await adminDb().collection(SUMMARIES_COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const asStringArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  return {
    id: snap.id,
    sessionId: asString(data.sessionId),
    executiveSummary: asString(data.executiveSummary),
    keyLearningPoints: asStringArray(data.keyLearningPoints),
    importantQuestions: asStringArray(data.importantQuestions),
    actionItems: asStringArray(data.actionItems),
    // Added in schemaVersion 2 — a summary written before this change has
    // none of these fields; the empty-string/array defaults below are what
    // makes that a correct "not extracted" read rather than a crash.
    trainerDiscussion: asString(data.trainerDiscussion),
    studentParticipation: asString(data.studentParticipation),
    importantObservations: asStringArray(data.importantObservations),
    followUpRequired: asStringArray(data.followUpRequired),
    participantInsights: asStringArray(data.participantInsights),
    createdAt: toIso(data.createdAt),
  };
}

export async function findRecentAnalytics(days: number): Promise<AiAnalyticsDay[]> {
  const snap = await adminDb()
    .collection(ANALYTICS_COLLECTION)
    .orderBy('date', 'desc')
    .limit(days)
    .get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        date: asString(data.date) || doc.id,
        sessionsCompleted: asNumberOrNull(data.sessionsCompleted) ?? 0,
        sessionsFailed: asNumberOrNull(data.sessionsFailed) ?? 0,
        recordingSeconds: asNumberOrNull(data.recordingSeconds) ?? 0,
        wordsTranscribed: asNumberOrNull(data.wordsTranscribed) ?? 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Counts and sums only — deliberately bypasses `findSessions()`/`toSession()`
 * so computing four numbers doesn't also resolve a trainer/batch/programme
 * name for every session in the collection (that N+1 lookup only earns its
 * cost when the UI actually renders those names).
 */
export async function findDashboardStats(): Promise<AiDashboardStats> {
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await adminDb()
      .collection(SESSIONS_COLLECTION)
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();
  } catch (error) {
    if (isIndexBuildingError(error)) {
      console.warn(
        '[ai-intelligence] aiSessions composite index is not ready yet — returning empty dashboard stats until it finishes building.',
        error,
      );
      return aggregateDashboardStats([], todayIsoDate());
    }
    throw error;
  }

  const summaries: DashboardStatsSessionInput[] = snap.docs.map((doc) => ({
    status: (asString(doc.get('status')) || 'draft') as AiSessionStatus,
    createdAtIso: toIso(doc.get('createdAt')),
    durationSeconds: asNumberOrNull(doc.get('durationSeconds')),
    pausedDurationSeconds: asNumberOrNull(doc.get('pausedDurationSeconds')),
    pauseCount: asNumberOrNull(doc.get('pauseCount')),
  }));

  return aggregateDashboardStats(summaries, todayIsoDate());
}

const DEFAULT_SETTINGS: AiIntelligenceSettings = {
  autoClassifySpeakers: true,
  notifyTrainerOnCompletion: true,
  audioRetentionDays: 365,
  defaultRecordingSource: 'laptop_microphone',
  channelRoleMap: [],
  activeSpeechProvider: 'mock',
  activeSummaryProvider: 'mock',
  updatedAt: '',
  updatedBy: '',
};

function toChannelRoleMap(raw: unknown): ChannelRoleMapping[] {
  if (!Array.isArray(raw)) return [];
  const roles = new Set<string>(CHANNEL_ROLES);
  const result: ChannelRoleMapping[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const channelIndex = asNumberOrNull(row.channelIndex);
    const role = asString(row.role);
    if (channelIndex === null || !roles.has(role)) continue;
    result.push({
      channelIndex,
      role: role as ChannelRole,
      label: asString(row.label) || role,
    });
  }
  return result;
}

export async function findAiSettings(): Promise<AiIntelligenceSettings> {
  const snap = await adminDb().doc(SETTINGS_DOC_PATH).get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  const data = snap.data() ?? {};
  const storedSource = asString(data.defaultRecordingSource);
  return {
    autoClassifySpeakers: data.autoClassifySpeakers !== false,
    notifyTrainerOnCompletion: data.notifyTrainerOnCompletion !== false,
    audioRetentionDays: asNumberOrNull(data.audioRetentionDays) ?? 365,
    defaultRecordingSource: isRecordingSourceKind(storedSource)
      ? storedSource
      : 'laptop_microphone',
    channelRoleMap: toChannelRoleMap(data.channelRoleMap),
    activeSpeechProvider: asString(data.activeSpeechProvider) || 'mock',
    activeSummaryProvider: asString(data.activeSummaryProvider) || 'mock',
    updatedAt: toIso(data.updatedAt),
    updatedBy: asString(data.updatedBy),
  };
}

export async function saveAiSettings(
  input: {
    autoClassifySpeakers: boolean;
    notifyTrainerOnCompletion: boolean;
    audioRetentionDays: number;
    defaultRecordingSource: RecordingSourceKind;
    channelRoleMap: ChannelRoleMapping[];
  },
  actorUid: string,
): Promise<void> {
  await adminDb().doc(SETTINGS_DOC_PATH).set(
    {
      schemaVersion: 2,
      autoClassifySpeakers: input.autoClassifySpeakers,
      notifyTrainerOnCompletion: input.notifyTrainerOnCompletion,
      audioRetentionDays: input.audioRetentionDays,
      defaultRecordingSource: input.defaultRecordingSource,
      channelRoleMap: input.channelRoleMap,
      updatedAt: new Date(),
      updatedBy: actorUid,
    },
    { merge: true },
  );
}

export async function batchExists(batchId: string): Promise<boolean> {
  const snap = await adminDb().collection('batches').doc(batchId).get();
  return snap.exists;
}

export async function programmeExists(programmeId: string): Promise<boolean> {
  const snap = await adminDb().collection('programmes').doc(programmeId).get();
  return snap.exists;
}
