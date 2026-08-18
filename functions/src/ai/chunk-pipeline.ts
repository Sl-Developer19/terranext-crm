import type { SpeakerRole, TranscriptSegment } from './providers/types';

/**
 * Long-session support: a 90-minute recording arrives as ~10-minute chunks
 * (see `src/features/ai-intelligence/logic.ts#planSessionChunks` on the
 * Next.js side, which produces the same boundaries the recorder rolls over
 * at). Each chunk is transcribed independently by `processAiSessionJob`;
 * this module is the pure logic for turning those per-chunk results back
 * into one session-level transcript, and for deciding which chunks a given
 * pipeline run still has left to do.
 */

export interface ChunkTranscriptInput {
  chunkIndex: number;
  startOffsetSec: number;
  language: string;
  segments: TranscriptSegment[];
}

export interface MergedTranscript {
  fullText: string;
  language: string;
  segments: TranscriptSegment[];
}

/**
 * Stitches per-chunk transcripts into one session-level transcript, with
 * every segment's timestamps shifted from "seconds into this chunk" to
 * "seconds into the whole session" via `startOffsetSec`. Speaker labels and
 * text pass through untouched — nothing about a chunk boundary should be
 * visible in the merged result.
 *
 * The final segment order is sorted by absolute `startSec`, not by input
 * order. For today's single-stream capture (chunks strictly sequential in
 * time, `chunkIndex` order already equals time order) this is a no-op that
 * only reinforces correctness. It's what makes the result correct once a
 * capture path produces *parallel* per-channel chunks covering the same
 * `startOffsetSec` range (trainer channel's chunk 0 alongside student
 * channel 1's chunk 0, etc.) — callers just pass every chunk from every
 * channel, in any order, and this interleaves them chronologically into
 * exactly "TRAINER … STUDENT 1 … TRAINER … STUDENT 2 …" rather than one
 * channel's whole chunk dumped before the next channel's.
 */
export function mergeChunkTranscripts(chunks: ChunkTranscriptInput[]): MergedTranscript {
  const ordered = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

  const segments: TranscriptSegment[] = [];
  for (const chunk of ordered) {
    for (const segment of chunk.segments) {
      segments.push({
        ...segment,
        startSec: segment.startSec + chunk.startOffsetSec,
        endSec: segment.endSec + chunk.startOffsetSec,
      });
    }
  }
  segments.sort((a, b) => a.startSec - b.startSec);

  const language = ordered.find((chunk) => chunk.language)?.language ?? 'en';
  const fullText = segments
    .map((segment) => segment.text)
    .join(' ')
    .trim();

  return { fullText, language, segments };
}

/**
 * One row of the Settings-configured channel→speaker mapping, as read back
 * from `aiIntelligenceSettings/config`. Deliberately a plain `role: string`
 * rather than importing the Next.js app's `ChannelRole` enum — this Cloud
 * Functions codebase is a separate package with no dependency on the app,
 * so this mirrors that convention (`'trainer'`, `'students'`, `'unassigned'`)
 * loosely instead of sharing a type.
 *
 * Exactly two speaker identities exist — `'trainer'` and `'students'` —
 * never per-student numbering, even though the classroom hardware has 4
 * physical wireless microphones (1 trainer headset + 3 student handhelds).
 * The receiver groups multiple physical mics onto shared logical channels;
 * if it instead exposes the 3 student mics on separate channels, multiple
 * rows here legitimately share `role: 'students'` — see
 * `resolveKnownSpeaker` below, which is exactly what makes that grouping
 * work: every one of those channels independently resolves to the same
 * `'students'` identity, never `student_1`/`student_2`/`student_3`.
 */
export interface ChannelRoleMapEntry {
  channelIndex: number;
  role: string;
  label: string;
}

/** Exact match only — `'trainer'` or `'students'`, nothing else (including
 * any legacy/unexpected value) resolves to a real identity. No prefix
 * matching: a per-student value like `'student_1'` must never silently
 * work here, since the whole point is that no such identity exists. */
function speakerRoleFromChannelRole(role: string): SpeakerRole {
  if (role === 'trainer') return 'trainer';
  if (role === 'students') return 'student';
  return 'unknown';
}

/**
 * Resolves a chunk's real, hardware-verified speaker from Settings' channel
 * mapping — `null` whenever there's nothing to resolve: the chunk has no
 * `channelIndex` (every chunk today, since no capture path writes one yet),
 * the mapping has no row for that channel, or that channel is explicitly
 * `'unassigned'`. Never guesses; only ever returns a real configured
 * mapping, and only ever the two real identities (`'trainer'`/`'students'`
 * — never a per-student one). See `SpeechProvider.transcribe`'s
 * `knownSpeaker` parameter for how the result is used.
 */
export function resolveKnownSpeaker(
  channelIndex: number | null,
  channelRoleMap: ChannelRoleMapEntry[],
): { role: SpeakerRole; label: string; channelIndex: number } | null {
  if (channelIndex === null) return null;
  const entry = channelRoleMap.find((row) => row.channelIndex === channelIndex);
  if (!entry || entry.role === 'unassigned') return null;
  return { role: speakerRoleFromChannelRole(entry.role), label: entry.label, channelIndex };
}

export interface ChunkProgress {
  chunkIndex: number;
  status: 'uploading' | 'uploaded' | 'transcribing' | 'transcribed' | 'failed';
}

/**
 * Which chunks a pipeline run still needs to transcribe, in order. Already-
 * `transcribed` chunks are skipped — this single filter is what makes a
 * retry resume from wherever processing actually stopped instead of
 * redoing every chunk from the beginning, and what makes "retry only the
 * failed chunk" true without any chunk-specific retry action existing: the
 * one job-level retry re-enters the pipeline, and this filter is what it
 * finds left to do.
 */
export function selectChunksToProcess<T extends ChunkProgress>(chunks: T[]): T[] {
  return [...chunks]
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .filter((chunk) => chunk.status !== 'transcribed');
}
