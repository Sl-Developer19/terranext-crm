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

/**
 * The automatic pipeline (AI Session Intelligence Proposal): once a trainer
 * stops recording, the Next.js app writes an `aiProcessingJobs` doc with
 * `stage: 'queued'` — nothing after that point requires a click. This
 * Firestore write trigger picks it up, runs speech-to-text → trainer/student
 * classification → AI summary → save, and updates the session, transcript,
 * summary, and daily analytics rollup as it goes. `retryProcessingJob`
 * (server action) re-enters the same trigger by writing `stage: 'queued'`
 * again, so the guard below is also what prevents infinite self-triggering:
 * every stage transition this function makes moves `stage` away from
 * `'queued'`, so its own writes never re-enter the queued branch.
 */

const STAGE_PROGRESS: Record<string, number> = {
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
  { document: 'aiProcessingJobs/{jobId}', secrets: [GEMINI_API_KEY, OPENAI_API_KEY] },
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

    const setStage = (stage: string, extra: Record<string, unknown> = {}) =>
      jobRef.update({
        stage,
        progressPercent: STAGE_PROGRESS[stage] ?? 0,
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

      await setStage('transcribing');
      const speechProvider = getSpeechProvider();
      const [audioBuffer] = await getStorage().bucket().file(audioStoragePath).download();
      const transcription = await speechProvider.transcribe({
        audioBuffer,
        contentType: audioContentType,
        sessionTitle,
      });

      await db.collection('aiTranscripts').doc(sessionId).set({
        schemaVersion: 1,
        sessionId,
        language: transcription.language,
        fullText: transcription.fullText,
        segments: transcription.segments,
        createdAt: FieldValue.serverTimestamp(),
      });
      await setStage('analyzing', { speechProvider: speechProvider.name });

      const summaryProvider = getSummaryProvider();
      const summary = await summaryProvider.summarize({
        transcriptText: transcription.fullText,
        sessionTitle,
      });

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
          stage: 'failed',
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
