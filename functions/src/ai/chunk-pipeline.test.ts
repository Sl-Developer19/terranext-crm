import { describe, expect, it } from 'vitest';

import { mergeChunkTranscripts, selectChunksToProcess } from './chunk-pipeline';
import type { SpeakerRole, TranscriptSegment } from './providers/types';

function seg(
  text: string,
  startSec: number,
  endSec: number,
  speaker: SpeakerRole = 'trainer',
): TranscriptSegment {
  return { speaker, speakerLabel: speaker, text, startSec, endSec };
}

describe('mergeChunkTranscripts', () => {
  it('orders chunks by chunkIndex even when given out of order', () => {
    const merged = mergeChunkTranscripts([
      { chunkIndex: 1, startOffsetSec: 600, language: 'en', segments: [seg('second', 0, 5)] },
      { chunkIndex: 0, startOffsetSec: 0, language: 'en', segments: [seg('first', 0, 5)] },
    ]);
    expect(merged.fullText).toBe('first second');
  });

  it('shifts each segment timestamp by its chunk start offset — preserving session-absolute time', () => {
    const merged = mergeChunkTranscripts([
      { chunkIndex: 0, startOffsetSec: 0, language: 'en', segments: [seg('a', 10, 20)] },
      { chunkIndex: 1, startOffsetSec: 600, language: 'en', segments: [seg('b', 5, 15)] },
      { chunkIndex: 2, startOffsetSec: 1200, language: 'en', segments: [seg('c', 0, 8)] },
    ]);
    expect(merged.segments).toEqual([
      { speaker: 'trainer', speakerLabel: 'trainer', text: 'a', startSec: 10, endSec: 20 },
      { speaker: 'trainer', speakerLabel: 'trainer', text: 'b', startSec: 605, endSec: 615 },
      { speaker: 'trainer', speakerLabel: 'trainer', text: 'c', startSec: 1200, endSec: 1208 },
    ]);
  });

  it('preserves speaker separation across a chunk boundary', () => {
    const merged = mergeChunkTranscripts([
      {
        chunkIndex: 0,
        startOffsetSec: 0,
        language: 'en',
        segments: [seg('question', 0, 5, 'student')],
      },
      {
        chunkIndex: 1,
        startOffsetSec: 600,
        language: 'en',
        segments: [seg('answer', 0, 5, 'trainer')],
      },
    ]);
    expect(merged.segments.map((s) => s.speaker)).toEqual(['student', 'trainer']);
  });

  it('a full 90-minute (9-chunk) session merges into one continuous, correctly ordered transcript', () => {
    const chunks = Array.from({ length: 9 }, (_, i) => ({
      chunkIndex: i,
      startOffsetSec: i * 600,
      language: 'en',
      segments: [seg(`chunk-${i}`, 0, 600)],
    }));
    const merged = mergeChunkTranscripts(chunks);
    expect(merged.segments).toHaveLength(9);
    expect(merged.segments.map((s) => s.text)).toEqual(chunks.map((c) => `chunk-${c.chunkIndex}`));
    expect(merged.segments[8]!.startSec).toBe(4800);
    expect(merged.fullText).toBe(chunks.map((c) => `chunk-${c.chunkIndex}`).join(' '));
  });

  it('a 45-minute (5-chunk, last one partial) session merges correctly', () => {
    const chunks = [0, 1, 2, 3, 4].map((i) => ({
      chunkIndex: i,
      startOffsetSec: i * 600,
      language: 'en',
      segments: [seg(`chunk-${i}`, 0, i === 4 ? 300 : 600)],
    }));
    const merged = mergeChunkTranscripts(chunks);
    expect(merged.segments[4]).toEqual({
      speaker: 'trainer',
      speakerLabel: 'trainer',
      text: 'chunk-4',
      startSec: 2400,
      endSec: 2700,
    });
  });

  it('handles an empty chunk list', () => {
    expect(mergeChunkTranscripts([])).toEqual({ fullText: '', language: 'en', segments: [] });
  });

  it('handles a chunk with no segments without breaking the merge', () => {
    const merged = mergeChunkTranscripts([
      { chunkIndex: 0, startOffsetSec: 0, language: 'en', segments: [seg('a', 0, 5)] },
      { chunkIndex: 1, startOffsetSec: 600, language: 'en', segments: [] },
      { chunkIndex: 2, startOffsetSec: 1200, language: 'en', segments: [seg('c', 0, 5)] },
    ]);
    expect(merged.segments.map((s) => s.text)).toEqual(['a', 'c']);
  });
});

describe('selectChunksToProcess', () => {
  it('skips already-transcribed chunks — this is what makes a retry resume instead of restart', () => {
    const chunks = [
      { chunkIndex: 0, status: 'transcribed' as const },
      { chunkIndex: 1, status: 'transcribed' as const },
      { chunkIndex: 2, status: 'failed' as const },
      { chunkIndex: 3, status: 'uploaded' as const },
    ];
    expect(selectChunksToProcess(chunks).map((c) => c.chunkIndex)).toEqual([2, 3]);
  });

  it('retries only the failed chunk when everything else already succeeded', () => {
    const chunks = [
      { chunkIndex: 0, status: 'transcribed' as const },
      { chunkIndex: 1, status: 'failed' as const },
    ];
    expect(selectChunksToProcess(chunks)).toEqual([{ chunkIndex: 1, status: 'failed' }]);
  });

  it('resumes a fully-interrupted pipeline (nothing transcribed yet) from chunk 0', () => {
    const chunks = [
      { chunkIndex: 0, status: 'uploaded' as const },
      { chunkIndex: 1, status: 'uploaded' as const },
    ];
    expect(selectChunksToProcess(chunks).map((c) => c.chunkIndex)).toEqual([0, 1]);
  });

  it('returns nothing once every chunk is already transcribed', () => {
    const chunks = [{ chunkIndex: 0, status: 'transcribed' as const }];
    expect(selectChunksToProcess(chunks)).toEqual([]);
  });

  it('orders its output by chunkIndex regardless of input order', () => {
    const chunks = [
      { chunkIndex: 2, status: 'uploaded' as const },
      { chunkIndex: 0, status: 'uploaded' as const },
      { chunkIndex: 1, status: 'uploaded' as const },
    ];
    expect(selectChunksToProcess(chunks).map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
  });
});
