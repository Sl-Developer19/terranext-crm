import { z } from 'zod';

/**
 * AI Intelligence Platform domain schemas (AI Session Intelligence Proposal;
 * AI Knowledge Capture Room Hardware Requirements). Framework-free — reused
 * by actions, repository, and UI. New collections only (`aiSessions`,
 * `aiProcessingJobs`, `aiTranscripts`, `aiSummaries`, `aiAnalytics`,
 * `aiIntelligenceSettings`) — no existing collection is touched.
 */

export const SESSION_STATUSES = [
  'draft',
  'recording',
  'processing',
  'completed',
  'failed',
] as const;
export type AiSessionStatus = (typeof SESSION_STATUSES)[number];

export const JOB_STAGES = [
  'queued',
  'transcribing',
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
 * 4 hours at typical spoken-word bitrates — generous ceiling for a classroom
 * session, and the limit the recording UI itself enforces. NOTE: this is
 * deliberately NOT tightened to match any one provider's request-size limit
 * (OpenAI Whisper caps a single file at 25MB; Gemini's inline-audio request
 * body is far smaller than this ceiling too) — chunked/resumable upload to
 * the provider is a known follow-up (see production readiness report) rather
 * than something silently enforced here by shrinking what recording accepts.
 */
export const MAX_AUDIO_BYTES = 750 * 1024 * 1024;

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

export const requestAudioUploadSchema = z.object({
  sessionId: z.string().min(1),
  contentType: z.enum(ALLOWED_AUDIO_CONTENT_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_AUDIO_BYTES, 'Recording exceeds the maximum allowed size.'),
});
export type RequestAudioUploadInput = z.infer<typeof requestAudioUploadSchema>;

export const confirmAudioUploadSchema = z.object({
  sessionId: z.string().min(1),
  durationSeconds: z
    .number()
    .int()
    .nonnegative()
    .max(4 * 60 * 60),
});
export type ConfirmAudioUploadInput = z.infer<typeof confirmAudioUploadSchema>;

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
  audioStoragePath: string | null;
  audioContentType: string | null;
  audioSizeBytes: number | null;
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

export interface AiProcessingJob {
  id: string;
  sessionId: string;
  sessionTitle: string;
  stage: AiJobStage;
  progressPercent: number;
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
