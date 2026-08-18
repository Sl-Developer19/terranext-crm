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

/**
 * Real, hardware-channel speaker separation (AI Knowledge Capture Room
 * Hardware Requirements). Corrected model, per the actual classroom
 * receiver: 4 physical wireless transmitters (1 trainer headset + 3
 * student handhelds) do not mean 4 logical identities. The receiver groups
 * multiple physical microphones onto shared logical channels, and
 * TerraNext's own logical model on top of that is exactly two speaker
 * identities — `'trainer'` and `'students'` — never per-student numbering.
 * If a receiver *does* expose more than 2 discrete channels (e.g. each
 * student handheld on its own line, ungrouped by the hardware), the fix
 * lives entirely in *how many rows* map to `'students'` in Settings — every
 * one of them still resolves to the single `'students'` identity, never
 * `student_1`/`student_2`/etc. `MAX_MAPPED_CHANNELS` bounds how many
 * physical channels can be mapped at all (covers that discrete-channel
 * case); it is not a count of distinguishable speakers, which stays fixed
 * at 2 (`'trainer'`, `'students'`) plus `'unassigned'`.
 */
export const MAX_MAPPED_CHANNELS = 4;
export const CHANNEL_ROLES = ['trainer', 'students', 'unassigned'] as const;
export type ChannelRole = (typeof CHANNEL_ROLES)[number];

/** One physical input channel's assignment — e.g. "channel 0 (as the
 * ChannelSplitterNode / MediaStreamTrack reports it) is the trainer's
 * headset". Configured in AI Intelligence Settings, not hardcoded, since
 * receiver wiring varies per classroom/kit. Multiple channels may map to
 * the same role — e.g. three discrete student channels can all be mapped
 * to `'students'`, grouping them into one logical identity rather than
 * creating separate per-student ones. */
export interface ChannelRoleMapping {
  channelIndex: number;
  role: ChannelRole;
  /** Trainer-facing label — defaults to the role's display name ("Trainer" /
   * "Students") and rarely needs overriding, since students are grouped, not
   * individually named. */
  label: string;
}

export const channelRoleMappingSchema = z.object({
  channelIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_MAPPED_CHANNELS - 1),
  role: z.enum(CHANNEL_ROLES),
  label: requiredText(1, 60, 'Give this channel a label.'),
});

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

/** Which physical channel this chunk came from — `null` for the single-
 * mixed-stream case (every session today). Only set when channel-preserving
 * capture actually ran (see `AiSessionChunk.channelIndex`'s doc comment). */
const channelIndexField = z
  .number()
  .int()
  .min(0)
  .max(MAX_MAPPED_CHANNELS - 1)
  .nullable()
  .default(null);

export const requestChunkUploadSchema = z.object({
  sessionId: z.string().min(1),
  chunkIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_CHUNKS_PER_SESSION - 1),
  channelIndex: channelIndexField,
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
  channelIndex: channelIndexField,
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
  /** How many discrete channels were actually captured — `1` (the default)
   * for every session today. Only `>1` when the browser genuinely
   * negotiated that many channels during a channel-preserving recording. */
  capturedChannelCount: z.number().int().min(1).max(MAX_MAPPED_CHANNELS).default(1),
});
export type FinalizeSessionRecordingInput = z.infer<typeof finalizeSessionRecordingSchema>;

export const startSessionRecordingSchema = z.object({
  sessionId: z.string().min(1),
});
export type StartSessionRecordingInput = z.infer<typeof startSessionRecordingSchema>;

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

export const getSessionAudioSchema = z.object({
  sessionId: z.string().min(1),
});
export type GetSessionAudioInput = z.infer<typeof getSessionAudioSchema>;

export const updateAiSettingsSchema = z.object({
  autoClassifySpeakers: z.boolean(),
  notifyTrainerOnCompletion: z.boolean(),
  audioRetentionDays: z.number().int().min(7).max(3650),
  defaultRecordingSource: z.enum(RECORDING_SOURCES),
  channelRoleMap: z
    .array(channelRoleMappingSchema)
    .max(MAX_MAPPED_CHANNELS)
    .refine(
      (rows) => new Set(rows.map((r) => r.channelIndex)).size === rows.length,
      'Each channel can only be mapped once.',
    ),
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
  /** How many discrete input channels this recording actually captured —
   * `1` for every session today (single mixed stream, `channelIndex: null`
   * on every chunk). Only `>1` when the browser genuinely negotiated that
   * many channels and channel-preserving capture ran; set once, at
   * finalize, from what really happened during recording. */
  capturedChannelCount: number;
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
  /** Which physical input channel this chunk's audio came from — `null` for
   * every chunk today (single-mixed-stream capture; see `AudioSource` in
   * `audio/types.ts`). Reserved for a future channel-preserving capture
   * path; nothing currently writes a non-null value. */
  channelIndex: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One playable segment of a finalized session's recording — a short-lived
 * signed GET URL minted on demand (never stored) plus the timing needed to
 * place it on the session's overall timeline. See
 * `actions/get-session-audio.ts#getSessionPlaybackManifest`.
 */
export interface PlaybackChunk {
  chunkIndex: number;
  url: string;
  startOffsetSec: number;
  durationSeconds: number;
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
  /** Which stage was in progress when this job failed — `null` unless `stage === 'failed'`. */
  failedAtStage: AiJobStage | null;
  speechProvider: string | null;
  summaryProvider: string | null;
  createdAt: string;
  updatedAt: string;
}

/** How `speaker`/`speakerLabel` were determined. `'channel'` means real,
 * hardware-verified identity from a mapped physical input channel (see
 * `ChannelRoleMapping`) — `'heuristic'` means a text-only AI guess from
 * wording, with no audio/channel evidence behind it. Every segment
 * produced today is `'heuristic'`; nothing yet captures real per-channel
 * audio. Never render a `'heuristic'` segment as if it were verified. */
export const ATTRIBUTION_SOURCES = ['channel', 'heuristic'] as const;
export type AttributionSource = (typeof ATTRIBUTION_SOURCES)[number];

export interface TranscriptSegment {
  speaker: SpeakerRole;
  speakerLabel: string;
  text: string;
  startSec: number;
  endSec: number;
  attributionSource: AttributionSource;
  /** Which physical input channel this segment's speaker identity came
   * from, when `attributionSource === 'channel'` — otherwise `null`. */
  channelIndex: number | null;
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
  /** Added in schemaVersion 2 — empty/blank on a summary generated before this change, not an error. */
  trainerDiscussion: string;
  studentParticipation: string;
  importantObservations: string[];
  followUpRequired: string[];
  participantInsights: string[];
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
  /** Which physical input channel maps to which speaker — see `ChannelRoleMapping`. Empty until an admin configures it; no channel is assumed by default. */
  channelRoleMap: ChannelRoleMapping[];
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
