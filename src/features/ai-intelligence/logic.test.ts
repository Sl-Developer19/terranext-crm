import { describe, expect, it } from 'vitest';

import {
  aggregateDashboardStats,
  closeTrailingPauseEvent,
  computeSessionDurationSeconds,
  countWords,
  deriveProcessingStageChecklist,
  deriveRecorderViewMode,
  formatDuration,
  isTerminalJobStage,
  JOB_STAGE_KIND,
  jobStageProgressPercent,
  locatePlaybackPosition,
  planExpectedChunkKeys,
  planSessionChunks,
  SESSION_STATUS_KIND,
  SESSION_STATUS_LABELS,
  sessionChunkStoragePath,
  sumPausedSeconds,
  todayIsoDate,
  totalPlaybackDurationSeconds,
  type DashboardStatsSessionInput,
  type PauseEventInput,
  type PlaybackChunkTiming,
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

  it('omitting channelIndex (or passing null) is byte-identical to the pre-channel-capture path', () => {
    expect(sessionChunkStoragePath('s1', 2, 'audio/webm')).toBe(
      sessionChunkStoragePath('s1', 2, 'audio/webm', null),
    );
  });

  it('a real channelIndex adds a distinguishing suffix instead of colliding on one path', () => {
    expect(sessionChunkStoragePath('s1', 2, 'audio/webm', 0)).toBe(
      'aiSessions/s1/chunks/2-ch0.webm',
    );
    expect(sessionChunkStoragePath('s1', 2, 'audio/webm', 3)).toBe(
      'aiSessions/s1/chunks/2-ch3.webm',
    );
  });
});

describe('planExpectedChunkKeys', () => {
  it('capturedChannelCount <= 1 reproduces exactly the flat channelIndex:null sequence finalize always validated', () => {
    const keys = planExpectedChunkKeys(45 * 60, 1);
    expect(keys).toEqual(
      planSessionChunks(45 * 60).map((c) => ({ chunkIndex: c.chunkIndex, channelIndex: null })),
    );
  });

  it('capturedChannelCount 0 also collapses to the single-channel-null case, never an empty matrix', () => {
    expect(planExpectedChunkKeys(10 * 60, 0)).toEqual([{ chunkIndex: 0, channelIndex: null }]);
  });

  it('produces one key per physical channel per time-chunk for real multi-channel capture', () => {
    const keys = planExpectedChunkKeys(20 * 60, 4);
    // 2 time-chunks (10-min each) x 4 channels = 8 keys.
    expect(keys).toHaveLength(8);
    expect(keys.filter((k) => k.chunkIndex === 0).map((k) => k.channelIndex)).toEqual([0, 1, 2, 3]);
    expect(keys.filter((k) => k.chunkIndex === 1).map((k) => k.channelIndex)).toEqual([0, 1, 2, 3]);
  });

  it('the trainer/students hardware case: 2 channels x 5 time-chunks (45-minute session)', () => {
    const keys = planExpectedChunkKeys(45 * 60, 2);
    expect(keys).toHaveLength(10);
    expect(new Set(keys.map((k) => k.channelIndex))).toEqual(new Set([0, 1]));
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

describe('closeTrailingPauseEvent', () => {
  it('closes an open trailing pause event, computing its duration', () => {
    const pausedAt = new Date('2026-08-02T10:00:00Z');
    const now = new Date('2026-08-02T10:05:30Z');
    const history: PauseEventInput[] = [{ pausedAt, resumedAt: null, durationSeconds: null }];

    const { history: closed, closedDurationSeconds } = closeTrailingPauseEvent(history, now);

    expect(closedDurationSeconds).toBe(330);
    expect(closed).toEqual([{ pausedAt, resumedAt: now, durationSeconds: 330 }]);
  });

  it('is a no-op when the last event is already closed', () => {
    const history: PauseEventInput[] = [
      {
        pausedAt: new Date('2026-08-02T10:00:00Z'),
        resumedAt: new Date('2026-08-02T10:01:00Z'),
        durationSeconds: 60,
      },
    ];

    const result = closeTrailingPauseEvent(history, new Date('2026-08-02T11:00:00Z'));

    expect(result.closedDurationSeconds).toBe(0);
    expect(result.history).toEqual(history);
  });

  it('is a no-op on an empty history', () => {
    const result = closeTrailingPauseEvent([], new Date());
    expect(result).toEqual({ history: [], closedDurationSeconds: 0 });
  });

  it('only touches the last event when several precede it', () => {
    const closedEvent: PauseEventInput = {
      pausedAt: new Date('2026-08-02T09:00:00Z'),
      resumedAt: new Date('2026-08-02T09:02:00Z'),
      durationSeconds: 120,
    };
    const openEvent: PauseEventInput = {
      pausedAt: new Date('2026-08-02T10:00:00Z'),
      resumedAt: null,
      durationSeconds: null,
    };
    const now = new Date('2026-08-02T10:01:00Z');

    const { history } = closeTrailingPauseEvent([closedEvent, openEvent], now);

    expect(history[0]).toEqual(closedEvent);
    expect(history[1]).toEqual({ ...openEvent, resumedAt: now, durationSeconds: 60 });
  });
});

describe('sumPausedSeconds', () => {
  it('sums durations across every event, ignoring still-open ones', () => {
    const history: PauseEventInput[] = [
      { pausedAt: new Date(), resumedAt: new Date(), durationSeconds: 60 },
      { pausedAt: new Date(), resumedAt: new Date(), durationSeconds: 90 },
      { pausedAt: new Date(), resumedAt: null, durationSeconds: null },
    ];
    expect(sumPausedSeconds(history)).toBe(150);
  });

  it('returns 0 for an empty history', () => {
    expect(sumPausedSeconds([])).toBe(0);
  });
});

describe('computeSessionDurationSeconds', () => {
  it('adds active recording time and paused time', () => {
    expect(computeSessionDurationSeconds(1800, 300)).toBe(2100);
  });

  it('handles zero paused time', () => {
    expect(computeSessionDurationSeconds(1800, 0)).toBe(1800);
  });
});

describe('Pause/Resume session scenarios', () => {
  it('Start → Pause → Resume → Stop: one pause cycle produces one closed history entry and correct totals', () => {
    const started = new Date('2026-08-03T09:00:00Z');
    const paused = new Date('2026-08-03T09:20:00Z'); // 20 min active before the pause
    const resumed = new Date('2026-08-03T09:25:00Z'); // 5 min paused
    const stopped = new Date('2026-08-03T09:45:00Z'); // 20 more min active after resume

    let history: PauseEventInput[] = [];
    // Pause clicked.
    history = [...history, { pausedAt: paused, resumedAt: null, durationSeconds: null }];
    expect(sumPausedSeconds(history)).toBe(0); // still open — not counted yet

    // Resume clicked.
    ({ history } = closeTrailingPauseEvent(history, resumed));
    const pausedDurationSeconds = sumPausedSeconds(history);
    expect(pausedDurationSeconds).toBe(5 * 60);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ pausedAt: paused, resumedAt: resumed, durationSeconds: 300 });

    // Stop clicked — active recording time is wall-clock minus the pause.
    const activeDurationSeconds =
      Math.round((stopped.getTime() - started.getTime()) / 1000) - pausedDurationSeconds;
    expect(activeDurationSeconds).toBe(40 * 60);
    expect(computeSessionDurationSeconds(activeDurationSeconds, pausedDurationSeconds)).toBe(
      45 * 60,
    );
  });

  it('supports multiple Pause/Resume cycles in one session, accumulating across all of them', () => {
    let history: PauseEventInput[] = [];

    // Cycle 1: paused 2 minutes.
    history = [
      ...history,
      { pausedAt: new Date('2026-08-03T09:10:00Z'), resumedAt: null, durationSeconds: null },
    ];
    ({ history } = closeTrailingPauseEvent(history, new Date('2026-08-03T09:12:00Z')));

    // Cycle 2: paused 10 minutes (a tea break).
    history = [
      ...history,
      { pausedAt: new Date('2026-08-03T09:30:00Z'), resumedAt: null, durationSeconds: null },
    ];
    ({ history } = closeTrailingPauseEvent(history, new Date('2026-08-03T09:40:00Z')));

    // Cycle 3: paused 30 seconds.
    history = [
      ...history,
      { pausedAt: new Date('2026-08-03T09:55:00Z'), resumedAt: null, durationSeconds: null },
    ];
    ({ history } = closeTrailingPauseEvent(history, new Date('2026-08-03T09:55:30Z')));

    expect(history).toHaveLength(3);
    expect(history.every((event) => event.resumedAt !== null)).toBe(true);
    expect(sumPausedSeconds(history)).toBe(2 * 60 + 10 * 60 + 30);
  });

  it('Stop while paused: finalize closes the trailing open pause instead of requiring Resume first', () => {
    const history: PauseEventInput[] = [
      {
        pausedAt: new Date('2026-08-03T10:00:00Z'),
        resumedAt: new Date('2026-08-03T10:01:00Z'),
        durationSeconds: 60,
      },
      // Trainer clicked Stop without clicking Resume — this entry is still open.
      { pausedAt: new Date('2026-08-03T10:30:00Z'), resumedAt: null, durationSeconds: null },
    ];
    const stopClickedAt = new Date('2026-08-03T10:31:15Z');

    const { history: closed, closedDurationSeconds } = closeTrailingPauseEvent(
      history,
      stopClickedAt,
    );

    expect(closedDurationSeconds).toBe(75);
    expect(closed.every((event) => event.resumedAt !== null)).toBe(true);
    expect(sumPausedSeconds(closed)).toBe(60 + 75);
  });

  it('chunk finalization is unaffected by pauses — planSessionChunks only ever sees active duration', () => {
    const activeDurationSeconds = 47 * 60; // what the trainer actually spoke, regardless of pauses
    const withoutPauses = planSessionChunks(activeDurationSeconds);
    const withPauses = planSessionChunks(activeDurationSeconds); // pausedDurationSeconds never passed in
    expect(withPauses).toEqual(withoutPauses);
  });

  it('paused periods cannot leak into the transcript timeline: pausedDurationSeconds plays no part in chunk offsets', () => {
    const activeDurationSeconds = 25 * 60;
    const pausedDurationSeconds = 3 * 60 * 60; // a very long break — 3 hours
    const chunks = planSessionChunks(activeDurationSeconds);
    const lastChunk = chunks[chunks.length - 1]!;
    // The chunk plan (and therefore every transcript segment's startOffsetSec/
    // endOffsetSec, which mergeChunkTranscripts derives from it) covers only
    // the active recording — the multi-hour pause never advances any offset.
    expect(lastChunk.startOffsetSec + lastChunk.durationSeconds).toBe(activeDurationSeconds);
    expect(computeSessionDurationSeconds(activeDurationSeconds, pausedDurationSeconds)).toBe(
      activeDurationSeconds + pausedDurationSeconds,
    );
  });
});

describe('aggregateDashboardStats', () => {
  const session = (overrides: Partial<DashboardStatsSessionInput>): DashboardStatsSessionInput => ({
    status: 'completed',
    createdAtIso: '2026-08-03T08:00:00.000Z',
    durationSeconds: 0,
    pausedDurationSeconds: 0,
    pauseCount: 0,
    ...overrides,
  });

  it("counts today's sessions, pending, and completed independently", () => {
    const stats = aggregateDashboardStats(
      [
        session({ status: 'processing', createdAtIso: '2026-08-03T08:00:00.000Z' }),
        session({ status: 'completed', createdAtIso: '2026-08-02T08:00:00.000Z' }),
        session({ status: 'completed', createdAtIso: '2026-08-03T09:00:00.000Z' }),
        session({ status: 'failed', createdAtIso: '2026-08-03T10:00:00.000Z' }),
      ],
      '2026-08-03',
    );

    expect(stats.todaysSessions).toBe(3);
    expect(stats.pendingProcessing).toBe(1);
    expect(stats.completedSessions).toBe(2);
  });

  it('sums active and paused seconds across sessions, rounded to one decimal hour', () => {
    const stats = aggregateDashboardStats(
      [
        session({ durationSeconds: 1800, pausedDurationSeconds: 300, pauseCount: 2 }),
        session({ durationSeconds: 5400, pausedDurationSeconds: 900, pauseCount: 3 }),
      ],
      '2026-08-03',
    );

    expect(stats.recordingHours).toBe(2); // (1800+5400)/3600
    expect(stats.pausedHours).toBe(0.3); // (300+900)/3600 = 0.333... → 0.3
    expect(stats.totalPauses).toBe(5);
  });

  it('treats null duration/pause fields as zero rather than throwing', () => {
    const stats = aggregateDashboardStats(
      [session({ durationSeconds: null, pausedDurationSeconds: null, pauseCount: null })],
      '2026-08-03',
    );

    expect(stats.recordingHours).toBe(0);
    expect(stats.pausedHours).toBe(0);
    expect(stats.totalPauses).toBe(0);
  });

  it('returns all zeros for an empty session list', () => {
    expect(aggregateDashboardStats([], '2026-08-03')).toEqual({
      todaysSessions: 0,
      pendingProcessing: 0,
      completedSessions: 0,
      recordingHours: 0,
      pausedHours: 0,
      totalPauses: 0,
    });
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

describe('totalPlaybackDurationSeconds', () => {
  it("sums every chunk's own duration", () => {
    const chunks: PlaybackChunkTiming[] = [
      { chunkIndex: 0, startOffsetSec: 0, durationSeconds: 600 },
      { chunkIndex: 1, startOffsetSec: 600, durationSeconds: 600 },
      { chunkIndex: 2, startOffsetSec: 1200, durationSeconds: 245 },
    ];
    expect(totalPlaybackDurationSeconds(chunks)).toBe(1445);
  });

  it('is 0 for no chunks', () => {
    expect(totalPlaybackDurationSeconds([])).toBe(0);
  });
});

describe('locatePlaybackPosition', () => {
  const chunks: PlaybackChunkTiming[] = [
    { chunkIndex: 0, startOffsetSec: 0, durationSeconds: 600 },
    { chunkIndex: 1, startOffsetSec: 600, durationSeconds: 600 },
    { chunkIndex: 2, startOffsetSec: 1200, durationSeconds: 245 },
  ];

  it('finds the first chunk for a target within it', () => {
    expect(locatePlaybackPosition(chunks, 90)).toEqual({ index: 0, offsetWithinChunkSec: 90 });
  });

  it('finds a later chunk and computes the offset relative to its own start', () => {
    expect(locatePlaybackPosition(chunks, 650)).toEqual({ index: 1, offsetWithinChunkSec: 50 });
  });

  it('lands exactly on a chunk boundary in the next chunk, not the one that just ended', () => {
    expect(locatePlaybackPosition(chunks, 600)).toEqual({ index: 1, offsetWithinChunkSec: 0 });
  });

  it('clamps a negative target to the very start', () => {
    expect(locatePlaybackPosition(chunks, -50)).toEqual({ index: 0, offsetWithinChunkSec: 0 });
  });

  it("clamps a target past the end to the last chunk's own end", () => {
    expect(locatePlaybackPosition(chunks, 9999)).toEqual({ index: 2, offsetWithinChunkSec: 245 });
  });

  it('returns null for an empty chunk list', () => {
    expect(locatePlaybackPosition([], 10)).toBeNull();
  });

  it('handles a single-chunk session', () => {
    const single: PlaybackChunkTiming[] = [
      { chunkIndex: 0, startOffsetSec: 0, durationSeconds: 42 },
    ];
    expect(locatePlaybackPosition(single, 20)).toEqual({ index: 0, offsetWithinChunkSec: 20 });
    expect(locatePlaybackPosition(single, 999)).toEqual({ index: 0, offsetWithinChunkSec: 42 });
  });
});

describe('deriveProcessingStageChecklist', () => {
  function stateOf(job: Parameters<typeof deriveProcessingStageChecklist>[0], key: string) {
    return deriveProcessingStageChecklist(job).find((row) => row.key === key)?.state;
  }

  it('marks everything done for a successfully completed job (real OpenAI provider)', () => {
    const job = { stage: 'completed' as const, failedAtStage: null, speechProvider: 'openai' };
    const checklist = deriveProcessingStageChecklist(job);
    expect(checklist.map((row) => row.state)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('marks speaker labels "unavailable" (not "done") when the mock provider ran — no real classification happened', () => {
    const job = { stage: 'completed' as const, failedAtStage: null, speechProvider: 'mock' };
    expect(stateOf(job, 'speaker')).toBe('unavailable');
    // Everything else genuinely did run, mock or not.
    expect(stateOf(job, 'transcription')).toBe('done');
    expect(stateOf(job, 'analysis')).toBe('done');
  });

  it('an in-progress job (still transcribing) shows transcription/analysis/summary as not-yet-reached', () => {
    const job = { stage: 'transcribing' as const, failedAtStage: null, speechProvider: 'openai' };
    expect(stateOf(job, 'upload')).toBe('done');
    expect(stateOf(job, 'transcription')).toBe('pending');
    expect(stateOf(job, 'speaker')).toBe('pending');
    expect(stateOf(job, 'analysis')).toBe('pending');
    expect(stateOf(job, 'summary')).toBe('pending');
  });

  it('a transcription failure fails both transcription and speaker labels, leaving analysis/summary not-yet-reached', () => {
    const job = {
      stage: 'failed' as const,
      failedAtStage: 'transcribing' as const,
      speechProvider: null,
    };
    expect(stateOf(job, 'transcription')).toBe('failed');
    expect(stateOf(job, 'speaker')).toBe('failed');
    expect(stateOf(job, 'analysis')).toBe('pending');
    expect(stateOf(job, 'summary')).toBe('pending');
  });

  it('a failure during merging leaves transcription done but analysis/summary not-yet-reached (merge has no dedicated UI row)', () => {
    const job = {
      stage: 'failed' as const,
      failedAtStage: 'merging' as const,
      speechProvider: 'openai',
    };
    expect(stateOf(job, 'transcription')).toBe('done');
    expect(stateOf(job, 'speaker')).toBe('done');
    expect(stateOf(job, 'analysis')).toBe('pending');
    expect(stateOf(job, 'summary')).toBe('pending');
  });

  it('a failure during analyzing fails both AI analysis and summary — the summarize+save call is one unit of work', () => {
    const job = {
      stage: 'failed' as const,
      failedAtStage: 'analyzing' as const,
      speechProvider: 'openai',
    };
    expect(stateOf(job, 'transcription')).toBe('done');
    expect(stateOf(job, 'analysis')).toBe('failed');
    expect(stateOf(job, 'summary')).toBe('failed');
  });

  it('a failure during saving leaves analysis/summary "done" — the summary was already persisted by the time saving starts', () => {
    const job = {
      stage: 'failed' as const,
      failedAtStage: 'saving' as const,
      speechProvider: 'openai',
    };
    expect(stateOf(job, 'analysis')).toBe('done');
    expect(stateOf(job, 'summary')).toBe('done');
  });

  it("upload is always done regardless of every other stage's outcome — finalize requires it before a job can even exist", () => {
    const job = {
      stage: 'failed' as const,
      failedAtStage: 'transcribing' as const,
      speechProvider: null,
    };
    expect(stateOf(job, 'upload')).toBe('done');
  });
});

describe('deriveRecorderViewMode', () => {
  it('shows the Start button for a fresh draft with no live recorder', () => {
    expect(deriveRecorderViewMode('idle', 'draft')).toBe('start');
  });

  it('the exact bug this fixes: a tab with a live recorder keeps full controls even once the server session has moved past draft', () => {
    // Previously the component hid its controls the instant `session.status`
    // (a stale snapshot) was anything but 'draft' — including in the very
    // tab still legitimately recording, the moment anything (router.refresh,
    // a revalidation) re-read the server doc mid-session.
    expect(deriveRecorderViewMode('recording', 'draft')).toBe('live');
    expect(deriveRecorderViewMode('recording', 'recording')).toBe('live');
    expect(deriveRecorderViewMode('paused', 'paused')).toBe('live');
    expect(deriveRecorderViewMode('paused', 'recording')).toBe('live');
    expect(deriveRecorderViewMode('uploading', 'processing')).toBe('live');
    expect(deriveRecorderViewMode('error', 'recording')).toBe('live');
  });

  it('tells a genuinely non-controlling tab (reload, second tab, closed original tab) that it cannot control an in-progress recording — never silently hides it', () => {
    expect(deriveRecorderViewMode('idle', 'recording')).toBe('non-controlling');
    expect(deriveRecorderViewMode('idle', 'paused')).toBe('non-controlling');
  });

  it('has nothing to show once the session has moved past recording/paused and this tab has no live recorder', () => {
    expect(deriveRecorderViewMode('idle', 'processing')).toBe('hidden');
    expect(deriveRecorderViewMode('idle', 'completed')).toBe('hidden');
    expect(deriveRecorderViewMode('idle', 'failed')).toBe('hidden');
  });
});
