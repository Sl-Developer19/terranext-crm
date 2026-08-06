import { z } from 'zod';

/**
 * AI Intelligence Platform domain schemas (AI Session Intelligence Proposal;
 * AI Knowledge Capture Room Hardware Requirements). Framework-free — reused
 * by actions, repository, and UI. New collections/subcollections only
 * (`aiSessions` + its `chunks` subcollection, `aiProcessingJobs`,
 * `aiTranscripts`, `aiSummaries`, `aiAnalytics`, `aiIntelligenceSettings`) —
 * no existing collection is touched.
 */

export const SESSION_STATUSES = [
  'draft',
  'recording',
  'paused',
  'processing',
  'completed',
  'failed',
] as const;
export type AiSessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * `merging` sits between `transcribing` and `analyzing`: once every chunk
 * has its own transcript, they're stitched into the one session-level
 * transcript before summarization ever runs.
 */
export const JOB_STAGES = [
  'queued',
  'transcribing',
  'merging',
  'analyzing',
  'saving',
  'completed',
  'failed',
] as const;
export type AiJobStage = (typeof JOB_STAGES)[number];

export const SPEAKER_ROLES = ['trainer', 'student', 'unknown'] as const;
export type SpeakerRole = (typeof SPEAKER_ROLES)[number];

/** Storage allow-list for classroom audio (mirrors participants' pattern, Doc 10 §4). */
export const ALLOWED_AUDIO_CONTENT_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
] as const;
export type AllowedAudioContentType = (typeof ALLOWED_AUDIO_CONTENT_TYPES)[number];

/**
 * Long-session support (business requirement: 45–60 min normal, 90 min
 * maximum classroom duration). Rather than upload one huge blob and send it
 * to a provider in a single request — which is what forced the 750MB
 * recording ceiling in the previous design to sit far above what any real
 * provider accepts in one call — the recorder rolls over to a new chunk
 * every `CHUNK_DURATION_SECONDS`, and each chunk is uploaded and transcribed
 * independently. `MAX_CHUNKS_PER_SESSION` is the number of chunks a 90-minute
 * recording produces; the recorder auto-stops at `MAX_SESSION_DURATION_SECONDS`.
 */
export const CHUNK_DURATION_SECONDS = 10 * 60;
export const MAX_SESSION_DURATION_SECONDS = 90 * 60;
export const MAX_CHUNKS_PER_SESSION = Math.ceil(
  MAX_SESSION_DURATION_SECONDS / CHUNK_DURATION_SECONDS,
);

/**
 * Per-chunk size ceiling — chosen to stay safely under OpenAI's real limit
 * rather than a generic round number: Whisper's `/audio/transcriptions`
 * endpoint hard-caps a single file at 25MB. 14MB clears that with real
 * margin, while a realistic 10-minute voice recording at typical
 * Opus/WebM bitrates is only a few MB — this ceiling is a safety valve,
 * not an expected size.
 */
export const MAX_CHUNK_BYTES = 14 * 1024 * 1024;

/**
 * Classroom Hardware Mode (AI Knowledge Capture Room Hardware Requirements):
 * an informational hint, not a hard filter — the recorder still lists every
 * `audioinput` device the browser reports and lets the trainer pick any of
 * them. `defaultRecordingSource` only biases which device the recorder
 * pre-selects (see `audio/device-classification.ts#classifyRecordingSource`,
 * which guesses a device's kind from its label) and labels it for the
 * trainer. There is deliberately no separate "8-channel mixer" or "digital
 * console" option yet — see the `AudioSource` interface in
 * `audio/types.ts` for how those would plug in later without this list, the
 * recorder, or the processing pipeline changing.
 */
export const RECORDING_SOURCES = [
  'laptop_microphone',
  'usb_audio_interface',
  'wireless_receiver',
  'professional_audio_mixer',
] as const;
export type RecordingSourceKind = (typeof RECORDING_SOURCES)[number];

export const CHUNK_STATUSES = [
  'uploading',
  'uploaded',
  'transcribing',
  'transcribed',
  'failed',
] as const;
export type ChunkStatus = (typeof CHUNK_STATUSES)[number];

const requiredText = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max);

export const createSessionSchema = z.object({
  title: requiredText(3, 200, 'Give the session a title (at least 3 characters).'),
  batchId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  programmeId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  deviceLabel: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const requestChunkUploadSchema = z.object({
  sessionId: z.string().min(1),
  chunkIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_CHUNKS_PER_SESSION - 1),
  contentType: z.enum(ALLOWED_AUDIO_CONTENT_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_CHUNK_BYTES, 'Chunk exceeds the maximum allowed size.'),
  startOffsetSec: z.number().int().nonnegative().max(MAX_SESSION_DURATION_SECONDS),
});
export type RequestChunkUploadInput = z.infer<typeof requestChunkUploadSchema>;

export const confirmChunkUploadSchema = z.object({
  sessionId: z.string().min(1),
  chunkIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_CHUNKS_PER_SESSION - 1),
  // A little slack over the nominal chunk length for rollover-timer jitter —
  // never a full extra chunk's worth.
  durationSeconds: z
    .number()
    .int()
    .positive()
    .max(CHUNK_DURATION_SECONDS + 30),
});
export type ConfirmChunkUploadInput = z.infer<typeof confirmChunkUploadSchema>;

export const finalizeSessionRecordingSchema = z.object({
  sessionId: z.string().min(1),
  totalChunks: z.number().int().min(1).max(MAX_CHUNKS_PER_SESSION),
  totalDurationSeconds: z
    .number()
    .int()
    .positive()
    .max(MAX_SESSION_DURATION_SECONDS + 60),
});
export type FinalizeSessionRecordingInput = z.infer<typeof finalizeSessionRecordingSchema>;

export const pauseSessionRecordingSchema = z.object({
  sessionId: z.string().min(1),
});
export type PauseSessionRecordingInput = z.infer<typeof pauseSessionRecordingSchema>;

export const resumeSessionRecordingSchema = z.object({
  sessionId: z.string().min(1),
});
export type ResumeSessionRecordingInput = z.infer<typeof resumeSessionRecordingSchema>;

export const retryProcessingJobSchema = z.object({
  jobId: z.string().min(1),
});
export type RetryProcessingJobInput = z.infer<typeof retryProcessingJobSchema>;

export const deleteSessionSchema = z.object({
  sessionId: z.string().min(1),
});
export type DeleteSessionInput = z.infer<typeof deleteSessionSchema>;

export const updateAiSettingsSchema = z.object({
  autoClassifySpeakers: z.boolean(),
  notifyTrainerOnCompletion: z.boolean(),
  audioRetentionDays: z.number().int().min(7).max(3650),
  defaultRecordingSource: z.enum(RECORDING_SOURCES),
});
export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

/**
 * One pause/resume cycle on a session. `resumedAt`/`durationSeconds` are
 * `null` while the pause is still open — either the trainer hasn't clicked
 * Resume yet, or the recording was stopped while paused (in which case
 * `finalizeSessionRecording` closes the trailing entry itself; see
 * `closeTrailingPauseEvent` in logic.ts).
 */
export interface PauseEvent {
  pausedAt: string;
  resumedAt: string | null;
  durationSeconds: number | null;
}

export interface AiSession {
  id: string;
  title: string;
  status: AiSessionStatus;
  trainerUid: string;
  trainerName: string;
  batchId: string | null;
  batchName: string | null;
  programmeId: string | null;
  programmeName: string | null;
  deviceLabel: string | null;
  totalChunks: number | null;
  /** Active recording time only (paused periods never accrue here) — what the chunk pipeline transcribes. */
  durationSeconds: number | null;
  /** Wall-clock total: `durationSeconds + pausedDurationSeconds`. Set at finalize. */
  sessionDurationSeconds: number | null;
  pausedDurationSeconds: number;
  pauseCount: number;
  pauseHistory: PauseEvent[];
  processingJobId: string | null;
  transcriptId: string | null;
  summaryId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
}

export interface AiSessionChunk {
  id: string;
  sessionId: string;
  chunkIndex: number;
  status: ChunkStatus;
  storagePath: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  startOffsetSec: number;
  durationSeconds: number | null;
  attempts: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiProcessingJob {
  id: string;
  sessionId: string;
  sessionTitle: string;
  stage: AiJobStage;
  progressPercent: number;
  chunksCompleted: number | null;
  chunksTotal: number | null;
  attempts: number;
  error: string | null;
  speechProvider: string | null;
  summaryProvider: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSegment {
  speaker: SpeakerRole;
  speakerLabel: string;
  text: string;
  startSec: number;
  endSec: number;
}

export interface AiTranscript {
  id: string;
  sessionId: string;
  language: string;
  fullText: string;
  segments: TranscriptSegment[];
  createdAt: string;
}

export interface AiSummary {
  id: string;
  sessionId: string;
  executiveSummary: string;
  keyLearningPoints: string[];
  importantQuestions: string[];
  actionItems: string[];
  createdAt: string;
}

export interface AiAnalyticsDay {
  date: string;
  sessionsCompleted: number;
  sessionsFailed: number;
  recordingSeconds: number;
  wordsTranscribed: number;
}

export interface AiIntelligenceSettings {
  autoClassifySpeakers: boolean;
  notifyTrainerOnCompletion: boolean;
  audioRetentionDays: number;
  /** Classroom Hardware Mode default — see `RECORDING_SOURCES` above. */
  defaultRecordingSource: RecordingSourceKind;
  activeSpeechProvider: string;
  activeSummaryProvider: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AiDashboardStats {
  todaysSessions: number;
  pendingProcessing: number;
  completedSessions: number;
  /** Active recording time only — see `AiSession.durationSeconds`. */
  recordingHours: number;
  pausedHours: number;
  totalPauses: number;
}
