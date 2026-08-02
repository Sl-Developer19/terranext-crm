import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { reportFunctionError } from '../observability/report-error';
import { writeSystemEvent } from '../lib/system-events';
import {
  GEMINI_API_KEY,
  getSpeechProvider,
  getSummaryProvider,
  OPENAI_API_KEY,
} from './providers/factory';
import type { TranscriptionResult } from './providers/types';
import { withRetry } from './retry-with-backoff';

/**
 * The automatic pipeline (AI Session Intelligence Proposal): once a trainer
 * stops recording, the Next.js app writes an `aiProcessingJobs` doc with
 * `stage: 'queued'` — nothing after that point requires a click. This
 * Firestore write trigger picks it up, runs speech-to-text → trainer/student
 * classification → AI summary → save, and updates the session, transcript,
 * summary, and daily analytics rollup as it goes. `retryProcessingJob`
 * (server action) re-enters the same trigger by writing `stage: 'queued'`
 * again.
 *
 * Cloud Functions Firestore triggers are at-least-once, not exactly-once —
 * the same write can legitimately invoke this function twice. `claimJob`
 * below is what makes a duplicate delivery safe: it atomically flips
 * `stage` away from `'queued'` inside a transaction, so a second concurrent
 * invocation reads a stage that is no longer `'queued'` and exits without
 * doing any work (no double API calls, no double-counted analytics).
 */

type JobStage = 'queued' | 'transcribing' | 'analyzing' | 'saving' | 'completed' | 'failed';

const STAGE_PROGRESS: Record<JobStage, number> = {
  queued: 0,
  transcribing: 25,
  analyzing: 50,
  saving: 75,
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

export const processAiSessionJob = onDocumentWritten(
  {
    document: 'aiProcessingJobs/{jobId}',
    secrets: [GEMINI_API_KEY, OPENAI_API_KEY],
    // Downloading + base64-encoding a large audio file needs real headroom;
    // a full pipeline run (download, transcribe, summarize) can run long
    // against a real provider. Both are event-driven (Eventarc/Cloud Run
    // backed), so raising them here is a config change only.
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
      const audioStoragePath = sessionSnap.get('audioStoragePath') as string | undefined;
      const audioContentType =
        (sessionSnap.get('audioContentType') as string | undefined) ?? 'audio/webm';
      const durationSeconds = (sessionSnap.get('durationSeconds') as number | undefined) ?? 0;
      if (!audioStoragePath) throw new Error('Session has no recorded audio to process.');

      // Resumable retry: a prior attempt may have already produced a
      // transcript and then failed on summarization. Reusing it avoids
      // re-downloading the audio and re-billing the speech provider for
      // work that already succeeded.
      const existingTranscript = await transcriptRef.get();
      let transcription: TranscriptionResult;
      let speechProviderName: string;

      if (existingTranscript.exists) {
        const data = existingTranscript.data()!;
        transcription = {
          fullText: (data.fullText as string) ?? '',
          language: (data.language as string) ?? 'en',
          segments: (data.segments as TranscriptionResult['segments']) ?? [],
        };
        speechProviderName = 'reused (cached transcript)';
      } else {
        const speechProvider = getSpeechProvider();
        speechProviderName = speechProvider.name;
        const [audioBuffer] = await getStorage().bucket().file(audioStoragePath).download();
        transcription = await withRetry(() =>
          speechProvider.transcribe({ audioBuffer, contentType: audioContentType, sessionTitle }),
        );

        await transcriptRef.set({
          schemaVersion: 1,
          sessionId,
          language: transcription.language,
          fullText: transcription.fullText,
          segments: transcription.segments,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await setStage('analyzing', { speechProvider: speechProviderName });

      const summaryProvider = getSummaryProvider();
      const summary = await withRetry(() =>
        summaryProvider.summarize({ transcriptText: transcription.fullText, sessionTitle }),
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
            wordsTranscribed: FieldValue.increment(countWords(transcription.fullText)),
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
