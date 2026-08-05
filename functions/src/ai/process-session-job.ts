import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { reportFunctionError } from '../observability/report-error';
import { writeSystemEvent } from '../lib/system-events';
import {
  mergeChunkTranscripts,
  selectChunksToProcess,
  type ChunkTranscriptInput,
} from './chunk-pipeline';
import { getSpeechProvider, getSummaryProvider, OPENAI_API_KEY } from './providers/factory';
import type { TranscriptSegment } from './providers/types';
import { withRetry } from './retry-with-backoff';

/**
 * The automatic pipeline (AI Session Intelligence Proposal, extended for
 * long sessions up to 90 minutes): once a trainer stops recording, the
 * Next.js app writes an `aiProcessingJobs` doc with `stage: 'queued'` —
 * nothing after that point requires a click. This Firestore write trigger
 * picks it up and, per chunk (~10 minutes each): downloads only that
 * chunk's audio, transcribes it, and records the result on the chunk doc.
 * Once every chunk is transcribed, they're merged into one session-level
 * transcript, summarized once, and saved — exactly the single-file flow
 * this pipeline always had, just fed by many small chunks instead of one
 * large recording never sent to a provider in a single request.
 *
 * Cloud Functions Firestore triggers are at-least-once, not exactly-once —
 * the same write can legitimately invoke this function twice. `claimJob`
 * below is what makes a duplicate delivery safe: it atomically flips
 * `stage` away from `'queued'` inside a transaction, so a second concurrent
 * invocation reads a stage that is no longer `'queued'` and exits without
 * doing any work (no double API calls, no double-counted analytics).
 *
 * Chunk-level resumability: `selectChunksToProcess` skips any chunk already
 * marked `'transcribed'`, so if this function fails partway through a long
 * session (timeout, transient error) and `retryProcessingJob` re-queues the
 * job, the retried run downloads and transcribes only the chunks that
 * didn't finish — never the whole recording again.
 */

type JobStage =
  'queued' | 'transcribing' | 'merging' | 'analyzing' | 'saving' | 'completed' | 'failed';

const STAGE_PROGRESS: Record<JobStage, number> = {
  queued: 0,
  transcribing: 15,
  merging: 60,
  analyzing: 70,
  saving: 90,
  completed: 100,
  failed: 0,
};

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ChunkDocData {
  chunkIndex: number;
  status: 'uploading' | 'uploaded' | 'transcribing' | 'transcribed' | 'failed';
  storagePath: string | null;
  contentType: string | null;
  startOffsetSec: number;
  language: string | undefined;
  segments: TranscriptSegment[] | undefined;
}

function readChunkDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): ChunkDocData {
  const data = doc.data();
  return {
    chunkIndex: (data.chunkIndex as number | undefined) ?? 0,
    status: (data.status as ChunkDocData['status'] | undefined) ?? 'uploading',
    storagePath: (data.storagePath as string | undefined) ?? null,
    contentType: (data.contentType as string | undefined) ?? null,
    startOffsetSec: (data.startOffsetSec as number | undefined) ?? 0,
    language: data.language as string | undefined,
    segments: data.segments as TranscriptSegment[] | undefined,
  };
}

export const processAiSessionJob = onDocumentWritten(
  {
    document: 'aiProcessingJobs/{jobId}',
    // OpenAI is the only real provider — Mock (the zero-credential
    // fallback in providers/factory.ts) needs no secret at all, so
    // OPENAI_API_KEY is the only one this function ever binds or prompts
    // the deploying user for.
    secrets: [OPENAI_API_KEY],
    // Only one chunk's audio (a few MB in the realistic case, capped at
    // 14MB) is ever held in memory at a time, but a 90-minute, 9-chunk
    // session run against a real provider can still take a while end to
    // end — both settings are event-driven (Eventarc/Cloud Run backed), so
    // raising them here is a config change only, not an architecture one.
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const job = after.data() as { sessionId?: string; sessionTitle?: string; stage?: string };
    if (job.stage !== 'queued') return;

    const jobId = event.params.jobId;
    const sessionId = job.sessionId;
    const sessionTitle = job.sessionTitle ?? 'Untitled session';
    if (!sessionId) {
      logger.error('processAiSessionJob: job missing sessionId', { jobId });
      return;
    }

    const db = getFirestore();
    const jobRef = db.collection('aiProcessingJobs').doc(jobId);
    const sessionRef = db.collection('aiSessions').doc(sessionId);
    const transcriptRef = db.collection('aiTranscripts').doc(sessionId);
    const chunksRef = sessionRef.collection('chunks');

    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists || snap.get('stage') !== 'queued') return false;
      tx.update(jobRef, {
        stage: 'transcribing' satisfies JobStage,
        progressPercent: STAGE_PROGRESS.transcribing,
        updatedAt: new Date(),
      });
      return true;
    });
    if (!claimed) return;

    const setStage = (stage: JobStage, extra: Record<string, unknown> = {}) =>
      jobRef.update({
        stage,
        progressPercent: STAGE_PROGRESS[stage],
        updatedAt: new Date(),
        ...extra,
      });

    try {
      const sessionSnap = await sessionRef.get();
      const durationSeconds = (sessionSnap.get('durationSeconds') as number | undefined) ?? 0;

      const chunkSnap = await chunksRef.orderBy('chunkIndex', 'asc').get();
      const chunks = chunkSnap.docs.map(readChunkDoc);
      if (chunks.length === 0) throw new Error('Session has no recorded audio chunks to process.');

      const pending = selectChunksToProcess(chunks);
      const speechProvider = pending.length > 0 ? getSpeechProvider() : null;
      let chunksCompleted = chunks.length - pending.length;

      for (const chunk of pending) {
        if (!chunk.storagePath) throw new Error(`Chunk ${chunk.chunkIndex} has no recorded audio.`);

        const [audioBuffer] = await getStorage().bucket().file(chunk.storagePath).download();
        const transcription = await withRetry(() =>
          speechProvider!.transcribe({
            audioBuffer,
            contentType: chunk.contentType ?? 'audio/webm',
            sessionTitle,
          }),
        );

        await chunksRef.doc(String(chunk.chunkIndex)).update({
          status: 'transcribed',
          language: transcription.language,
          segments: transcription.segments,
          updatedAt: new Date(),
        });
        chunk.language = transcription.language;
        chunk.segments = transcription.segments;

        chunksCompleted += 1;
        await jobRef.update({
          chunksCompleted,
          updatedAt: new Date(),
        });
      }

      await setStage('merging', { chunksCompleted, chunksTotal: chunks.length });

      const mergeInput: ChunkTranscriptInput[] = chunks.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        startOffsetSec: chunk.startOffsetSec,
        language: chunk.language ?? 'en',
        segments: chunk.segments ?? [],
      }));
      const merged = mergeChunkTranscripts(mergeInput);

      await transcriptRef.set({
        schemaVersion: 1,
        sessionId,
        language: merged.language,
        fullText: merged.fullText,
        segments: merged.segments,
        createdAt: FieldValue.serverTimestamp(),
      });

      const speechProviderName = speechProvider?.name ?? 'reused (cached chunk transcripts)';
      await setStage('analyzing', { speechProvider: speechProviderName });

      const summaryProvider = getSummaryProvider();
      const summary = await withRetry(() =>
        summaryProvider.summarize({ transcriptText: merged.fullText, sessionTitle }),
      );

      await db.collection('aiSummaries').doc(sessionId).set({
        schemaVersion: 1,
        sessionId,
        executiveSummary: summary.executiveSummary,
        keyLearningPoints: summary.keyLearningPoints,
        importantQuestions: summary.importantQuestions,
        actionItems: summary.actionItems,
        createdAt: FieldValue.serverTimestamp(),
      });
      await setStage('saving', { summaryProvider: summaryProvider.name });

      await sessionRef.update({
        status: 'completed',
        transcriptId: sessionId,
        summaryId: sessionId,
        updatedAt: new Date(),
        updatedBy: 'system:processAiSessionJob',
      });

      // The Settings page has no other way to know which provider actually
      // ran (provider selection is env/secret-driven at the Functions
      // deploy, a different runtime than the page that renders it) — this
      // stamp is what keeps "Active providers" honest instead of frozen at
      // its default.
      await db.doc('aiIntelligenceSettings/config').set(
        {
          activeSpeechProvider: speechProviderName,
          activeSummaryProvider: summaryProvider.name,
        },
        { merge: true },
      );

      const today = todayIsoDate();
      await db
        .collection('aiAnalytics')
        .doc(today)
        .set(
          {
            date: today,
            sessionsCompleted: FieldValue.increment(1),
            recordingSeconds: FieldValue.increment(durationSeconds),
            wordsTranscribed: FieldValue.increment(countWords(merged.fullText)),
          },
          { merge: true },
        );

      await setStage('completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('processAiSessionJob failed', { jobId, sessionId, error: message });
      reportFunctionError(error, 'processAiSessionJob');

      await jobRef
        .update({
          stage: 'failed' satisfies JobStage,
          progressPercent: STAGE_PROGRESS.failed,
          error: message,
          updatedAt: new Date(),
        })
        .catch(() => undefined);
      await sessionRef
        .update({
          status: 'failed',
          updatedAt: new Date(),
          updatedBy: 'system:processAiSessionJob',
        })
        .catch(() => undefined);
      await writeSystemEvent({
        source: 'processAiSessionJob',
        message: `AI processing failed for session ${sessionId}`,
        detail: { jobId, sessionId, error: message },
      });

      const today = todayIsoDate();
      await db
        .collection('aiAnalytics')
        .doc(today)
        .set({ date: today, sessionsFailed: FieldValue.increment(1) }, { merge: true })
        .catch(() => undefined);
    }
  },
);
