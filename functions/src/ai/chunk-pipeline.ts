import type { TranscriptSegment } from './providers/types';

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
 * Stitches per-chunk transcripts into one session-level transcript: ordered
 * by `chunkIndex` (defensive — callers should already provide them in
 * order), with every segment's timestamps shifted from "seconds into this
 * chunk" to "seconds into the whole session" via `startOffsetSec`. Speaker
 * labels and text pass through untouched — nothing about a chunk boundary
 * should be visible in the merged result.
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

  const language = ordered.find((chunk) => chunk.language)?.language ?? 'en';
  const fullText = segments
    .map((segment) => segment.text)
    .join(' ')
    .trim();

  return { fullText, language, segments };
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
