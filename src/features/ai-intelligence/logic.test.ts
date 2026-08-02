import { describe, expect, it } from 'vitest';

import {
  canTransitionSession,
  countWords,
  formatDuration,
  isTerminalJobStage,
  jobStageProgressPercent,
  sessionAudioStoragePath,
  todayIsoDate,
} from './logic';

describe('sessionAudioStoragePath', () => {
  it('maps known content types to their extension', () => {
    expect(sessionAudioStoragePath('s1', 'audio/webm')).toBe('aiSessions/s1/audio.webm');
    expect(sessionAudioStoragePath('s1', 'audio/mpeg')).toBe('aiSessions/s1/audio.mp3');
    expect(sessionAudioStoragePath('s1', 'audio/wav')).toBe('aiSessions/s1/audio.wav');
  });

  it('falls back to .bin for an unrecognised type', () => {
    expect(sessionAudioStoragePath('s1', 'audio/mystery')).toBe('aiSessions/s1/audio.bin');
  });
});

describe('jobStageProgressPercent', () => {
  it('is 0 at queued and 100 at completed', () => {
    expect(jobStageProgressPercent('queued')).toBe(0);
    expect(jobStageProgressPercent('completed')).toBe(100);
  });

  it('increases monotonically through the pipeline', () => {
    const stages = ['queued', 'transcribing', 'analyzing', 'saving', 'completed'] as const;
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

describe('canTransitionSession', () => {
  it('allows the documented forward path', () => {
    expect(canTransitionSession('draft', 'recording')).toBe(true);
    expect(canTransitionSession('recording', 'recorded')).toBe(true);
    expect(canTransitionSession('recorded', 'processing')).toBe(true);
    expect(canTransitionSession('processing', 'completed')).toBe(true);
    expect(canTransitionSession('failed', 'processing')).toBe(true);
  });

  it('rejects skipping stages or moving out of a terminal state', () => {
    expect(canTransitionSession('draft', 'completed')).toBe(false);
    expect(canTransitionSession('completed', 'processing')).toBe(false);
    expect(canTransitionSession('recording', 'draft')).toBe(false);
  });
});
