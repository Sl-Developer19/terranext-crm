import {
  CHUNK_DURATION_SECONDS,
  type AiDashboardStats,
  type AiJobStage,
  type AiSessionStatus,
} from './schema';

/**
 * Pure business rules for the AI Intelligence Platform — no Firestore, no
 * React. Kept separate from repository.ts so the pipeline's decisions
 * (storage paths, chunk planning, stage ordering, progress mapping) are
 * unit-testable without a Firestore emulator.
 */

/** `channelIndex` is `null` for the single-mixed-stream case (every session
 * today) — the path is byte-identical to before this parameter existed.
 * Only channel-preserving capture ever passes a real channel number, giving
 * each physical channel's chunk its own Storage object instead of
 * colliding on one path. */
export function sessionChunkStoragePath(
  sessionId: string,
  chunkIndex: number,
  contentType: string,
  channelIndex: number | null = null,
): string {
  const ext = extensionForContentType(contentType);
  const suffix = channelIndex === null ? '' : `-ch${channelIndex}`;
  return `aiSessions/${sessionId}/chunks/${chunkIndex}${suffix}.${ext}`;
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'audio/webm':
      return 'webm';
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/ogg':
      return 'ogg';
    default:
      return 'bin';
  }
}

export interface PlannedChunk {
  chunkIndex: number;
  startOffsetSec: number;
  durationSeconds: number;
}

/**
 * How a session of a given total length breaks into ~10-minute chunks —
 * the same boundaries the recorder produces live via its rollover timer.
 * Used to validate `finalizeSessionRecording`'s (totalChunks,
 * totalDurationSeconds) pair against each other server-side, and is the
 * direct target of the 45/60/90-minute scenario tests.
 */
export function planSessionChunks(totalDurationSeconds: number): PlannedChunk[] {
  if (totalDurationSeconds <= 0) return [];
  const chunks: PlannedChunk[] = [];
  let offset = 0;
  let chunkIndex = 0;
  while (offset < totalDurationSeconds) {
    const durationSeconds = Math.min(CHUNK_DURATION_SECONDS, totalDurationSeconds - offset);
    chunks.push({ chunkIndex, startOffsetSec: offset, durationSeconds });
    offset += durationSeconds;
    chunkIndex += 1;
  }
  return chunks;
}

export interface ExpectedChunkKey {
  chunkIndex: number;
  /** `null` for the single-channel case — matches the `channelIndex` every
   * chunk doc has today. */
  channelIndex: number | null;
}

/**
 * The full (chunkIndex, channelIndex) matrix `finalizeSessionRecording`
 * must find uploaded before it will enqueue processing. `capturedChannelCount
 * <= 1` produces exactly the flat `channelIndex: null` sequence this always
 * validated before channel-preserving capture existed — zero behavior
 * change for the single-stream case. `capturedChannelCount > 1` produces one
 * key per physical channel per time-chunk, since channel-preserving capture
 * uploads each channel's slice of a given rollover window as its own chunk.
 */
export function planExpectedChunkKeys(
  totalDurationSeconds: number,
  capturedChannelCount: number,
): ExpectedChunkKey[] {
  const planned = planSessionChunks(totalDurationSeconds);
  const channels: Array<number | null> =
    capturedChannelCount <= 1
      ? [null]
      : Array.from({ length: capturedChannelCount }, (_, index) => index);
  const keys: ExpectedChunkKey[] = [];
  for (const chunk of planned) {
    for (const channelIndex of channels) {
      keys.push({ chunkIndex: chunk.chunkIndex, channelIndex });
    }
  }
  return keys;
}

export const JOB_STAGE_ORDER: readonly AiJobStage[] = [
  'queued',
  'transcribing',
  'merging',
  'analyzing',
  'saving',
  'completed',
];

/** Drives the Processing Screen progress bar — 'failed' freezes at its last known position. */
export function jobStageProgressPercent(stage: AiJobStage): number {
  if (stage === 'failed') return 0;
  const index = JOB_STAGE_ORDER.indexOf(stage);
  if (index === -1) return 0;
  return Math.round((index / (JOB_STAGE_ORDER.length - 1)) * 100);
}

/**
 * Playback timing over a session's chunk sequence — pure so the
 * multi-chunk seek/advance math (§5, `session-audio-player.tsx`) has a
 * regression test independent of `HTMLAudioElement`/DOM. Each chunk is its
 * own separately-encoded file (see Storage layout in `sessionChunkStoragePath`);
 * the player presents them as one continuous timeline by tracking which
 * chunk a given overall-session second falls into.
 */
export interface PlaybackChunkTiming {
  chunkIndex: number;
  startOffsetSec: number;
  durationSeconds: number;
}

/** Sum of every chunk's own duration — the overall playable length. Assumes
 * chunks don't overlap, which the recorder's rollover boundaries guarantee. */
export function totalPlaybackDurationSeconds(chunks: PlaybackChunkTiming[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.durationSeconds, 0);
}

/**
 * Which chunk contains `targetSec` on the overall session timeline, and the
 * offset within that chunk's own audio to seek to. `chunks` must already be
 * ordered by `startOffsetSec` (chunkIndex order) — the same order the
 * playback manifest returns. Clamps an out-of-range target to the nearest
 * end rather than returning `null`, so a seek bar dragged past either edge
 * still lands somewhere playable; only an empty chunk list is `null`.
 */
export function locatePlaybackPosition(
  chunks: PlaybackChunkTiming[],
  targetSec: number,
): { index: number; offsetWithinChunkSec: number } | null {
  if (chunks.length === 0) return null;
  const clamped = Math.max(0, targetSec);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const chunkEnd = chunk.startOffsetSec + chunk.durationSeconds;
    if (clamped < chunkEnd || i === chunks.length - 1) {
      const offsetWithinChunkSec = Math.max(
        0,
        Math.min(clamped - chunk.startOffsetSec, chunk.durationSeconds),
      );
      return { index: i, offsetWithinChunkSec };
    }
  }
  /* istanbul ignore next -- unreachable: the loop's last iteration always returns */
  return null;
}

export function isTerminalJobStage(stage: AiJobStage): boolean {
  return stage === 'completed' || stage === 'failed';
}

export type ProcessingStageState = 'done' | 'pending' | 'failed' | 'unavailable';

export interface ProcessingStageStatus {
  key: 'upload' | 'transcription' | 'speaker' | 'analysis' | 'summary';
  label: string;
  state: ProcessingStageState;
}

const STAGE_REACHED_ORDER: readonly AiJobStage[] = [
  'queued',
  'transcribing',
  'merging',
  'analyzing',
  'saving',
  'completed',
];

/**
 * Derives a per-stage checklist (Upload / Transcription / Speaker labels /
 * AI analysis / Summary) for the Processing Queue. Firestore only tracks
 * the pipeline's single current-or-failed `stage`, not each of these five
 * independently, so this infers each row from where the pipeline actually
 * got to (`job.stage`) or died (`job.failedAtStage`).
 *
 * - `upload` is unconditionally `'done'`: `finalizeSessionRecording`
 *   requires every chunk to already be `'uploaded'` before a job document
 *   is even created, so the job existing at all already proves it.
 * - `transcription`/`speaker` share one signal: real speaker classification
 *   happens *inside* the same `speechProvider.transcribe()` call as
 *   transcription itself (`process-session-job.ts`), so a transcription
 *   failure is a speaker-classification failure too. `speaker` is
 *   `'unavailable'` rather than `'done'` when the mock provider ran (no
 *   `OPENAI_API_KEY` configured) — no real classification happened at all.
 * - `analysis`/`summary` share one signal for the same reason: the summary
 *   provider call *and* the Firestore write of `aiSummaries` both happen
 *   inside the `'analyzing'` stage, before the pipeline ever reaches
 *   `'saving'`. A failure at `'saving'` or later happens strictly *after*
 *   the summary was already persisted, so both rows read `'done'` even
 *   though the job overall still failed (for a reason surfaced separately
 *   via the job's `error` text) — mislabeling an already-saved summary as
 *   failed would be inaccurate.
 */
export function deriveProcessingStageChecklist(job: {
  stage: AiJobStage;
  failedAtStage: AiJobStage | null;
  speechProvider: string | null;
}): ProcessingStageStatus[] {
  const reachedIndex = (stage: AiJobStage) => STAGE_REACHED_ORDER.indexOf(stage);
  const failedAt = job.stage === 'failed' ? job.failedAtStage : null;
  const currentIndex =
    job.stage === 'failed' ? (failedAt ? reachedIndex(failedAt) : -1) : reachedIndex(job.stage);

  const transcriptionState: ProcessingStageState =
    failedAt === 'transcribing'
      ? 'failed'
      : currentIndex > reachedIndex('transcribing')
        ? 'done'
        : 'pending';

  const speakerState: ProcessingStageState =
    transcriptionState === 'failed'
      ? 'failed'
      : transcriptionState !== 'done'
        ? 'pending'
        : job.speechProvider === 'mock'
          ? 'unavailable'
          : 'done';

  const analysisState: ProcessingStageState =
    failedAt === 'analyzing'
      ? 'failed'
      : currentIndex > reachedIndex('analyzing')
        ? 'done'
        : 'pending';

  const summaryState: ProcessingStageState =
    failedAt === 'analyzing'
      ? 'failed'
      : currentIndex >= reachedIndex('saving')
        ? 'done'
        : 'pending';

  return [
    { key: 'upload', label: 'Upload', state: 'done' },
    { key: 'transcription', label: 'Transcription', state: transcriptionState },
    { key: 'speaker', label: 'Speaker labels', state: speakerState },
    { key: 'analysis', label: 'AI analysis', state: analysisState },
    { key: 'summary', label: 'Summary', state: summaryState },
  ];
}

export type RecorderLocalStatus = 'idle' | 'recording' | 'paused' | 'uploading' | 'error';
export type RecorderViewMode = 'start' | 'live' | 'non-controlling' | 'hidden';

/**
 * Decides what `SessionRecorder` shows, given this browser tab's own
 * MediaRecorder status (`localStatus`) and the session doc's server-side
 * status (`serverStatus` — a snapshot from whenever this page last
 * loaded/refreshed, never live-updated while mounted). Pure so the exact
 * bug this fixes has a regression test independent of React/DOM: a tab
 * whose `localStatus !== 'idle'` genuinely has a live recorder (it called
 * handleStart itself) and must keep showing full controls no matter what
 * `serverStatus` says — previously the component hid its controls the
 * instant `serverStatus` was anything but `'draft'`, which could hide
 * Resume/Stop even in the tab still legitimately recording, the moment
 * anything (a `router.refresh()`, a revalidation) re-read the session doc.
 *
 * - `'live'` — this tab has a live recorder; render full controls driven by
 *   `localStatus`, ignoring `serverStatus` entirely.
 * - `'start'` — no live recorder here, and the session is still a fresh
 *   draft: normal "hasn't started yet" case, show the Start button.
 * - `'non-controlling'` — no live recorder here, and the server says
 *   someone (else, or this tab before a reload) already started recording:
 *   this tab cannot control it — say so plainly instead of hiding the fact.
 * - `'hidden'` — no live recorder, and the session has moved past
 *   recording/paused (processing/completed/failed): nothing to show here,
 *   other UI (timeline, processing card, summary/transcript) covers it.
 */
export function deriveRecorderViewMode(
  localStatus: RecorderLocalStatus,
  serverStatus: AiSessionStatus,
): RecorderViewMode {
  if (localStatus !== 'idle') return 'live';
  if (serverStatus === 'draft') return 'start';
  if (serverStatus === 'recording' || serverStatus === 'paused') return 'non-controlling';
  return 'hidden';
}

export const SESSION_STATUS_LABELS: Record<AiSessionStatus, string> = {
  draft: 'Draft',
  recording: 'Recording',
  paused: 'Paused',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

/** Shared badge tone per status — the single source every list/detail view reads from. */
export const SESSION_STATUS_KIND: Record<
  AiSessionStatus,
  'info' | 'progress' | 'success' | 'danger' | 'neutral'
> = {
  draft: 'neutral',
  recording: 'progress',
  paused: 'info',
  processing: 'progress',
  completed: 'success',
  failed: 'danger',
};

export const JOB_STAGE_KIND: Record<
  AiJobStage,
  'info' | 'progress' | 'success' | 'danger' | 'neutral'
> = {
  queued: 'neutral',
  transcribing: 'progress',
  merging: 'progress',
  analyzing: 'progress',
  saving: 'progress',
  completed: 'success',
  failed: 'danger',
};

export const JOB_STAGE_LABELS: Record<AiJobStage, string> = {
  queued: 'Queued',
  transcribing: 'Transcribing',
  merging: 'Merging transcript',
  analyzing: 'AI analysis',
  saving: 'Saving',
  completed: 'Completed',
  failed: 'Failed',
};

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Word count used for the analytics rollup — split on whitespace, empty text yields 0. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Pause/resume bookkeeping (Pause/Resume Recording). Kept here — pure,
 * Firestore-free — so `repository.ts`'s `markSessionPaused`/
 * `markSessionResumed`/`finalizeSessionAndEnqueue` all share one tested
 * implementation of "what does closing/summing a pause history mean"
 * rather than each re-deriving the same Date math.
 */
export interface PauseEventInput {
  pausedAt: Date;
  resumedAt: Date | null;
  durationSeconds: number | null;
}

/**
 * If the most recent pause event is still open (`resumedAt === null`),
 * closes it at `now` and returns its duration. A no-op (0 added seconds) on
 * an empty history or one whose last event is already closed — callers
 * (explicit Resume, and `finalizeSessionRecording` handling "Stop while
 * paused") can call this unconditionally without checking state first.
 */
export function closeTrailingPauseEvent(
  history: PauseEventInput[],
  now: Date,
): { history: PauseEventInput[]; closedDurationSeconds: number } {
  if (history.length === 0) return { history, closedDurationSeconds: 0 };
  const last = history[history.length - 1]!;
  if (last.resumedAt !== null) return { history, closedDurationSeconds: 0 };

  const durationSeconds = Math.max(0, Math.round((now.getTime() - last.pausedAt.getTime()) / 1000));
  const updated = [...history.slice(0, -1), { ...last, resumedAt: now, durationSeconds }];
  return { history: updated, closedDurationSeconds: durationSeconds };
}

/** Total paused seconds, recomputed from history rather than a separately
 * incremented counter — one source of truth, no drift possible between the
 * stored total and the events that make it up. */
export function sumPausedSeconds(history: PauseEventInput[]): number {
  return history.reduce((sum, event) => sum + (event.durationSeconds ?? 0), 0);
}

/** Wall-clock session length: active recording plus every paused interval. */
export function computeSessionDurationSeconds(
  activeDurationSeconds: number,
  pausedDurationSeconds: number,
): number {
  return activeDurationSeconds + pausedDurationSeconds;
}

/** The subset of a session document `findDashboardStats` needs — kept
 * minimal and Firestore-free so the aggregation itself is unit-testable
 * without a Firestore emulator (see Engineering 04 — **T4**). */
export interface DashboardStatsSessionInput {
  status: AiSessionStatus;
  createdAtIso: string;
  durationSeconds: number | null;
  pausedDurationSeconds: number | null;
  pauseCount: number | null;
}

/** Pure reduction over already-fetched session summaries — `repository.ts`'s
 * `findDashboardStats` does only the Firestore fetch and the doc→summary
 * mapping; every count/sum/rounding decision lives here. */
export function aggregateDashboardStats(
  sessions: DashboardStatsSessionInput[],
  todayIso: string,
): AiDashboardStats {
  let todaysSessions = 0;
  let pendingProcessing = 0;
  let completedSessions = 0;
  let recordingSeconds = 0;
  let pausedSeconds = 0;
  let totalPauses = 0;

  for (const session of sessions) {
    if (session.createdAtIso.slice(0, 10) === todayIso) todaysSessions += 1;
    if (session.status === 'processing') pendingProcessing += 1;
    if (session.status === 'completed') completedSessions += 1;
    recordingSeconds += session.durationSeconds ?? 0;
    pausedSeconds += session.pausedDurationSeconds ?? 0;
    totalPauses += session.pauseCount ?? 0;
  }

  return {
    todaysSessions,
    pendingProcessing,
    completedSessions,
    recordingHours: Math.round((recordingSeconds / 3600) * 10) / 10,
    pausedHours: Math.round((pausedSeconds / 3600) * 10) / 10,
    totalPauses,
  };
}
