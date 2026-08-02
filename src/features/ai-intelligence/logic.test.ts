import { describe, expect, it } from 'vitest';

import {
  countWords,
  formatDuration,
  isTerminalJobStage,
  JOB_STAGE_KIND,
  jobStageProgressPercent,
  planSessionChunks,
  SESSION_STATUS_KIND,
  SESSION_STATUS_LABELS,
  sessionChunkStoragePath,
  todayIsoDate,
} from './logic';
import {
  CHUNK_DURATION_SECONDS,
  JOB_STAGES,
  MAX_CHUNKS_PER_SESSION,
  SESSION_STATUSES,
} from './schema';

describe('sessionChunkStoragePath', () => {
  it('maps known content types to their extension, keyed by chunk index', () => {
    expect(sessionChunkStoragePath('s1', 0, 'audio/webm')).toBe('aiSessions/s1/chunks/0.webm');
    expect(sessionChunkStoragePath('s1', 3, 'audio/mpeg')).toBe('aiSessions/s1/chunks/3.mp3');
    expect(sessionChunkStoragePath('s1', 1, 'audio/wav')).toBe('aiSessions/s1/chunks/1.wav');
  });

  it('falls back to .bin for an unrecognised type', () => {
    expect(sessionChunkStoragePath('s1', 0, 'audio/mystery')).toBe('aiSessions/s1/chunks/0.bin');
  });
});

describe('planSessionChunks', () => {
  it('45-minute recording (2,700s): four full 10-minute chunks plus one 5-minute chunk', () => {
    const chunks = planSessionChunks(45 * 60);
    expect(chunks).toHaveLength(5);
    expect(chunks.map((c) => c.durationSeconds)).toEqual([600, 600, 600, 600, 300]);
    expect(chunks.map((c) => c.startOffsetSec)).toEqual([0, 600, 1200, 1800, 2400]);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('60-minute recording (3,600s): six exact 10-minute chunks', () => {
    const chunks = planSessionChunks(60 * 60);
    expect(chunks).toHaveLength(6);
    expect(chunks.every((c) => c.durationSeconds === 600)).toBe(true);
    expect(chunks[5]).toEqual({ chunkIndex: 5, startOffsetSec: 3000, durationSeconds: 600 });
  });

  it('90-minute recording (5,400s, the business maximum): nine exact 10-minute chunks', () => {
    const chunks = planSessionChunks(90 * 60);
    expect(chunks).toHaveLength(MAX_CHUNKS_PER_SESSION);
    expect(chunks).toHaveLength(9);
    expect(chunks.every((c) => c.durationSeconds === CHUNK_DURATION_SECONDS)).toBe(true);
    const lastChunk = chunks[chunks.length - 1]!;
    expect(lastChunk.startOffsetSec + lastChunk.durationSeconds).toBe(90 * 60);
  });

  it('a short recording under one chunk length produces exactly one partial chunk', () => {
    const chunks = planSessionChunks(90);
    expect(chunks).toEqual([{ chunkIndex: 0, startOffsetSec: 0, durationSeconds: 90 }]);
  });

  it('zero or negative duration produces no chunks', () => {
    expect(planSessionChunks(0)).toEqual([]);
    expect(planSessionChunks(-10)).toEqual([]);
  });

  it('chunk boundaries are contiguous — no gaps, no overlaps, covers the full duration', () => {
    const totalDurationSeconds = 47 * 60 + 13;
    const chunks = planSessionChunks(totalDurationSeconds);
    let expectedOffset = 0;
    for (const chunk of chunks) {
      expect(chunk.startOffsetSec).toBe(expectedOffset);
      expectedOffset += chunk.durationSeconds;
    }
    expect(expectedOffset).toBe(totalDurationSeconds);
  });
});

describe('jobStageProgressPercent', () => {
  it('is 0 at queued and 100 at completed', () => {
    expect(jobStageProgressPercent('queued')).toBe(0);
    expect(jobStageProgressPercent('completed')).toBe(100);
  });

  it('increases monotonically through the pipeline, including the merging stage', () => {
    const stages = [
      'queued',
      'transcribing',
      'merging',
      'analyzing',
      'saving',
      'completed',
    ] as const;
    const percents = stages.map(jobStageProgressPercent);
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThan(percents[i - 1] as number);
    }
  });

  it('freezes failed at 0 rather than reporting a false position', () => {
    expect(jobStageProgressPercent('failed')).toBe(0);
  });
});

describe('isTerminalJobStage', () => {
  it('completed and failed are terminal, everything else is not', () => {
    expect(isTerminalJobStage('completed')).toBe(true);
    expect(isTerminalJobStage('failed')).toBe(true);
    expect(isTerminalJobStage('queued')).toBe(false);
    expect(isTerminalJobStage('analyzing')).toBe(false);
  });
});

describe('formatDuration', () => {
  it('formats sub-hour durations as m:ss', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('formats hour-plus durations as h:mm:ss', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('clamps negative input to zero', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('the quick brown fox')).toBe(4);
  });

  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });
});

describe('todayIsoDate', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(todayIsoDate(new Date('2026-08-02T15:30:00Z'))).toBe('2026-08-02');
  });
});

describe('SESSION_STATUS_KIND / SESSION_STATUS_LABELS', () => {
  it('define exactly one entry per status — a status added to the schema without a mapping here is a bug', () => {
    expect(Object.keys(SESSION_STATUS_KIND).sort()).toEqual([...SESSION_STATUSES].sort());
    expect(Object.keys(SESSION_STATUS_LABELS).sort()).toEqual([...SESSION_STATUSES].sort());
  });
});

describe('JOB_STAGE_KIND', () => {
  it('defines exactly one entry per stage', () => {
    expect(Object.keys(JOB_STAGE_KIND).sort()).toEqual([...JOB_STAGES].sort());
  });
});
