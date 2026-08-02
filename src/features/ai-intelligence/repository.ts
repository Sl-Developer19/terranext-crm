import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { sessionAudioStoragePath } from './logic';
import type {
  AiAnalyticsDay,
  AiDashboardStats,
  AiIntelligenceSettings,
  AiJobStage,
  AiProcessingJob,
  AiSession,
  AiSessionStatus,
  AiSummary,
  AiTranscript,
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
    audioStoragePath: asStringOrNull(data.audioStoragePath),
    audioContentType: asStringOrNull(data.audioContentType),
    durationSeconds: asNumberOrNull(data.durationSeconds),
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
  const snap = await query.orderBy('createdAt', 'desc').limit(500).get();
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
    audioStoragePath: null,
    audioContentType: null,
    durationSeconds: null,
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
): Promise<{ status: AiSessionStatus; trainerUid: string } | null> {
  const snap = await adminDb().collection(SESSIONS_COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  return {
    status: (asString(snap.get('status')) || 'draft') as AiSessionStatus,
    trainerUid: asString(snap.get('trainerUid')),
  };
}

export async function findSessionUploadMeta(
  sessionId: string,
): Promise<{ status: AiSessionStatus; storagePath: string | null; title: string } | null> {
  const snap = await adminDb().collection(SESSIONS_COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  return {
    status: (asString(snap.get('status')) || 'draft') as AiSessionStatus,
    storagePath: asStringOrNull(snap.get('audioStoragePath')),
    title: asString(snap.get('title')) || 'Untitled session',
  };
}

/** Reserves the audio path against the session before the signed upload URL is issued. */
export async function reserveSessionAudioPath(
  sessionId: string,
  contentType: string,
  actorUid: string,
): Promise<string> {
  const storagePath = sessionAudioStoragePath(sessionId, contentType);
  await adminDb()
    .collection(SESSIONS_COLLECTION)
    .doc(sessionId)
    .update({
      status: 'recording' satisfies AiSessionStatus,
      audioStoragePath: storagePath,
      audioContentType: contentType,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
  return storagePath;
}

/** Confirms the recording landed and enqueues processing — the automatic pipeline's entry point. */
export async function markSessionRecordedAndEnqueue(
  sessionId: string,
  sessionTitle: string,
  durationSeconds: number,
  actorUid: string,
): Promise<string> {
  const db = adminDb();
  const jobRef = db.collection(JOBS_COLLECTION).doc();
  const now = new Date();

  await db.runTransaction(async (tx) => {
    tx.update(db.collection(SESSIONS_COLLECTION).doc(sessionId), {
      status: 'processing' satisfies AiSessionStatus,
      durationSeconds,
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

export async function markSessionUploadFailed(sessionId: string, actorUid: string): Promise<void> {
  await adminDb()
    .collection(SESSIONS_COLLECTION)
    .doc(sessionId)
    .update({
      status: 'failed' satisfies AiSessionStatus,
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
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
    attempts: asNumberOrNull(data.attempts) ?? 0,
    error: asStringOrNull(data.error),
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

export async function findProcessingJobBySessionId(
  sessionId: string,
): Promise<AiProcessingJob | null> {
  const snap = await adminDb()
    .collection(JOBS_COLLECTION)
    .where('sessionId', '==', sessionId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  return snap.empty ? null : toJob(snap.docs[0]!);
}

export async function retryProcessingJobRecord(jobId: string): Promise<void> {
  await adminDb()
    .collection(JOBS_COLLECTION)
    .doc(jobId)
    .update({
      stage: 'queued' satisfies AiJobStage,
      error: null,
      attempts: FieldValue.increment(1),
      updatedAt: new Date(),
    });
}

export async function findTranscriptBySessionId(sessionId: string): Promise<AiTranscript | null> {
  const snap = await adminDb().collection(TRANSCRIPTS_COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const segments = Array.isArray(data.segments) ? (data.segments as TranscriptSegment[]) : [];
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

export async function findDashboardStats(): Promise<AiDashboardStats> {
  const sessions = await findSessions();
  const todayPrefix = new Date().toISOString().slice(0, 10);

  const todaysSessions = sessions.filter((s) => s.createdAt.slice(0, 10) === todayPrefix).length;
  const pendingProcessing = sessions.filter(
    (s) => s.status === 'processing' || s.status === 'recorded',
  ).length;
  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const recordingSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);

  return {
    todaysSessions,
    pendingProcessing,
    completedSessions,
    recordingHours: Math.round((recordingSeconds / 3600) * 10) / 10,
  };
}

const DEFAULT_SETTINGS: AiIntelligenceSettings = {
  autoClassifySpeakers: true,
  notifyTrainerOnCompletion: true,
  audioRetentionDays: 365,
  activeSpeechProvider: 'mock',
  activeSummaryProvider: 'mock',
  updatedAt: '',
  updatedBy: '',
};

export async function findAiSettings(): Promise<AiIntelligenceSettings> {
  const snap = await adminDb().doc(SETTINGS_DOC_PATH).get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  const data = snap.data() ?? {};
  return {
    autoClassifySpeakers: data.autoClassifySpeakers !== false,
    notifyTrainerOnCompletion: data.notifyTrainerOnCompletion !== false,
    audioRetentionDays: asNumberOrNull(data.audioRetentionDays) ?? 365,
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
  },
  actorUid: string,
): Promise<void> {
  await adminDb().doc(SETTINGS_DOC_PATH).set(
    {
      schemaVersion: 1,
      autoClassifySpeakers: input.autoClassifySpeakers,
      notifyTrainerOnCompletion: input.notifyTrainerOnCompletion,
      audioRetentionDays: input.audioRetentionDays,
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
