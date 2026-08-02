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
 * Per-chunk size ceiling — chosen to stay safely under real provider limits
 * rather than a generic round number: OpenAI's Whisper API hard-caps a
 * single file at 25MB, and Gemini's inline (non-Files-API) request body is
 * capped well under that once ~10 minutes of audio is base64-encoded
 * (~1.34x inflation). 14MB comfortably clears both with margin, while a
 * realistic 10-minute voice recording at typical Opus/WebM bitrates is only
 * a few MB — this ceiling is a safety valve, not an expected size.
 */
export const MAX_CHUNK_BYTES = 14 * 1024 * 1024;

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
});
export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

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
  durationSeconds: number | null;
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
  activeSpeechProvider: string;
  activeSummaryProvider: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AiDashboardStats {
  todaysSessions: number;
  pendingProcessing: number;
  completedSessions: number;
  recordingHours: number;
}
