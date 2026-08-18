import { describe, expect, it } from 'vitest';

import {
  mergeChunkTranscripts,
  resolveKnownSpeaker,
  selectChunksToProcess,
  type ChunkTranscriptInput,
} from './chunk-pipeline';
import type { SpeakerRole, TranscriptSegment } from './providers/types';

function seg(
  text: string,
  startSec: number,
  endSec: number,
  speaker: SpeakerRole = 'trainer',
): TranscriptSegment {
  return {
    speaker,
    speakerLabel: speaker,
    text,
    startSec,
    endSec,
    attributionSource: 'heuristic',
    channelIndex: null,
  };
}

function channelSeg(
  text: string,
  startSec: number,
  endSec: number,
  speaker: SpeakerRole,
  speakerLabel: string,
  channelIndex: number,
): TranscriptSegment {
  return {
    speaker,
    speakerLabel,
    text,
    startSec,
    endSec,
    attributionSource: 'channel',
    channelIndex,
  };
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
    expect(merged.segments).toEqual([seg('a', 10, 20), seg('b', 605, 615), seg('c', 1200, 1208)]);
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
    expect(merged.segments[4]).toEqual(seg('chunk-4', 2400, 2700));
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

  it('interleaves the trainer channel with a single, already-hardware-mixed students channel chronologically — the 2-logical-channel classroom rig', () => {
    // The receiver's actual topology: CH1 = trainer headset, CH2 = all 3
    // student handhelds already grouped by the hardware before reaching the
    // USB interface. Two channels covering the SAME time range — not
    // sequential like today's single-stream chunks.
    const trainerChannel: ChunkTranscriptInput[] = [
      {
        chunkIndex: 0,
        startOffsetSec: 0,
        language: 'en',
        segments: [
          channelSeg('Welcome everyone.', 0, 3, 'trainer', 'Trainer', 0),
          channelSeg('Any questions on that?', 400, 403, 'trainer', 'Trainer', 0),
        ],
      },
    ];
    const studentsChannel: ChunkTranscriptInput[] = [
      {
        chunkIndex: 0,
        startOffsetSec: 0,
        language: 'en',
        segments: [channelSeg('Sir, I have a doubt.', 405, 408, 'student', 'Students', 1)],
      },
    ];

    const merged = mergeChunkTranscripts([...trainerChannel, ...studentsChannel]);

    expect(merged.segments.map((s) => s.speakerLabel)).toEqual(['Trainer', 'Trainer', 'Students']);
    expect(merged.segments.map((s) => s.startSec)).toEqual([0, 400, 405]);
    expect(merged.segments.every((s) => s.attributionSource === 'channel')).toBe(true);
  });

  it('groups 3 discrete student-handheld channels into one STUDENTS identity, never per-student ones, if the receiver exposes them separately', () => {
    // Defensive case: the receiver did NOT pre-mix the 3 student handhelds,
    // so each arrives as its own chunk sequence — channels 1, 2, 3, each
    // independently mapped to the SAME 'students' role in Settings (see
    // resolveKnownSpeaker's grouping tests below). All three must still
    // combine into one "STUDENTS" identity in the merged transcript.
    const trainer: ChunkTranscriptInput[] = [
      {
        chunkIndex: 0,
        startOffsetSec: 0,
        language: 'en',
        segments: [channelSeg('Topic time.', 0, 2, 'trainer', 'Trainer', 0)],
      },
    ];
    const handheld1: ChunkTranscriptInput[] = [
      {
        chunkIndex: 0,
        startOffsetSec: 0,
        language: 'en',
        segments: [channelSeg('First doubt.', 10, 12, 'student', 'Students', 1)],
      },
    ];
    const handheld2: ChunkTranscriptInput[] = [
      {
        chunkIndex: 0,
        startOffsetSec: 0,
        language: 'en',
        segments: [channelSeg('Second doubt.', 20, 22, 'student', 'Students', 2)],
      },
    ];
    const handheld3: ChunkTranscriptInput[] = [
      {
        chunkIndex: 0,
        startOffsetSec: 0,
        language: 'en',
        segments: [channelSeg('Third doubt.', 30, 32, 'student', 'Students', 3)],
      },
    ];

    const merged = mergeChunkTranscripts([...trainer, ...handheld1, ...handheld2, ...handheld3]);

    expect(merged.segments.map((s) => s.speakerLabel)).toEqual([
      'Trainer',
      'Students',
      'Students',
      'Students',
    ]);
    // Every student segment reads as the one STUDENTS identity — none
    // carries a distinguishing per-speaker label despite 3 different
    // physical channels.
    expect(
      merged.segments
        .filter((s) => s.speaker === 'student')
        .every((s) => s.speakerLabel === 'Students'),
    ).toBe(true);
  });
});

describe('resolveKnownSpeaker', () => {
  it('returns null when the chunk has no channelIndex — every chunk today, since no capture path writes one yet', () => {
    expect(
      resolveKnownSpeaker(null, [{ channelIndex: 0, role: 'trainer', label: 'Trainer' }]),
    ).toBeNull();
  });

  it('returns null when the mapping has no row for that channel — never guesses', () => {
    expect(
      resolveKnownSpeaker(2, [{ channelIndex: 0, role: 'trainer', label: 'Trainer' }]),
    ).toBeNull();
  });

  it('returns null for a channel explicitly left unassigned', () => {
    expect(
      resolveKnownSpeaker(1, [{ channelIndex: 1, role: 'unassigned', label: 'Unassigned' }]),
    ).toBeNull();
  });

  it('resolves the trainer channel (CH1) to the coarse "trainer" role with its configured label', () => {
    expect(
      resolveKnownSpeaker(0, [{ channelIndex: 0, role: 'trainer', label: 'Trainer' }]),
    ).toEqual({ role: 'trainer', label: 'Trainer', channelIndex: 0 });
  });

  it('resolves the students channel (CH2) to the coarse "student" role with the single "Students" label', () => {
    expect(
      resolveKnownSpeaker(1, [{ channelIndex: 1, role: 'students', label: 'Students' }]),
    ).toEqual({ role: 'student', label: 'Students', channelIndex: 1 });
  });

  it('resolves multiple channels all mapped to "students" independently — this is exactly how 3 discrete student handhelds group into one identity', () => {
    const map = [
      { channelIndex: 0, role: 'trainer', label: 'Trainer' },
      { channelIndex: 1, role: 'students', label: 'Students' },
      { channelIndex: 2, role: 'students', label: 'Students' },
      { channelIndex: 3, role: 'students', label: 'Students' },
    ];
    expect(resolveKnownSpeaker(1, map)).toEqual({
      role: 'student',
      label: 'Students',
      channelIndex: 1,
    });
    expect(resolveKnownSpeaker(2, map)).toEqual({
      role: 'student',
      label: 'Students',
      channelIndex: 2,
    });
    expect(resolveKnownSpeaker(3, map)).toEqual({
      role: 'student',
      label: 'Students',
      channelIndex: 3,
    });
  });

  it('never treats a per-student value like "student_1" as a valid role — no per-student identity exists', () => {
    expect(
      resolveKnownSpeaker(1, [{ channelIndex: 1, role: 'student_1', label: 'Student 1' }]),
    ).toEqual({ role: 'unknown', label: 'Student 1', channelIndex: 1 });
  });

  it('treats an unrecognized role string as unknown rather than throwing', () => {
    expect(
      resolveKnownSpeaker(3, [{ channelIndex: 3, role: 'something-unexpected', label: 'X' }]),
    ).toEqual({ role: 'unknown', label: 'X', channelIndex: 3 });
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
