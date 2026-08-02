import { CHUNK_DURATION_SECONDS, type AiJobStage, type AiSessionStatus } from './schema';

/**
 * Pure business rules for the AI Intelligence Platform — no Firestore, no
 * React. Kept separate from repository.ts so the pipeline's decisions
 * (storage paths, chunk planning, stage ordering, progress mapping) are
 * unit-testable without a Firestore emulator.
 */

export function sessionChunkStoragePath(
  sessionId: string,
  chunkIndex: number,
  contentType: string,
): string {
  const ext = extensionForContentType(contentType);
  return `aiSessions/${sessionId}/chunks/${chunkIndex}.${ext}`;
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

export function isTerminalJobStage(stage: AiJobStage): boolean {
  return stage === 'completed' || stage === 'failed';
}

export const SESSION_STATUS_LABELS: Record<AiSessionStatus, string> = {
  draft: 'Draft',
  recording: 'Recording',
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
