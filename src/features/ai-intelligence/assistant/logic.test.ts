import { describe, expect, it } from 'vitest';

import type { TranscriptSegment } from '../schema';
import {
  buildAssistantSystemPrompt,
  buildSessionDataBlock,
  buildTranscriptWindows,
  evaluateRateLimit,
  selectRecentHistory,
  selectRelevantWindows,
  windowToSource,
  type TranscriptWindow,
} from './logic';
import { MAX_WINDOW_CHARS } from './schema';
import type { AssistantMessage } from './schema';

function segment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    speaker: 'trainer',
    speakerLabel: 'Trainer',
    text: 'lead qualification means checking budget and intent',
    startSec: 0,
    endSec: 5,
    attributionSource: 'heuristic',
    channelIndex: null,
    ...overrides,
  };
}

describe('buildTranscriptWindows', () => {
  it('returns an empty list for an empty transcript', () => {
    expect(buildTranscriptWindows([])).toEqual([]);
  });

  it('groups segments within the same ~90s window together', () => {
    const windows = buildTranscriptWindows([
      segment({ startSec: 0, endSec: 5, text: 'first' }),
      segment({ startSec: 30, endSec: 40, text: 'second' }),
      segment({ startSec: 89, endSec: 95, text: 'third' }),
    ]);
    expect(windows).toHaveLength(1);
    expect(windows[0]!.startSec).toBe(0);
    expect(windows[0]!.text).toBe('Trainer: first | second | third');
  });

  it('re-labels the speaker inline whenever the turn changes, so a model can tell who said what', () => {
    const windows = buildTranscriptWindows([
      segment({ startSec: 0, speakerLabel: 'Trainer', text: 'Today we cover lead qualification.' }),
      segment({
        startSec: 5,
        speakerLabel: 'Student',
        text: 'How do we identify a qualified lead?',
      }),
      segment({ startSec: 10, speakerLabel: 'Trainer', text: 'Budget, authority, and timeline.' }),
    ]);
    expect(windows[0]!.text).toBe(
      'Trainer: Today we cover lead qualification. | Student: How do we identify a qualified lead? | Trainer: Budget, authority, and timeline.',
    );
  });

  it('starts a new window once a segment crosses the boundary', () => {
    const windows = buildTranscriptWindows([
      segment({ startSec: 0, endSec: 5, text: 'first' }),
      segment({ startSec: 95, endSec: 100, text: 'second' }),
    ]);
    expect(windows).toHaveLength(2);
    expect(windows[0]!.startSec).toBe(0);
    expect(windows[1]!.startSec).toBe(90);
  });

  it('reports the actual last segment end as endSec, not the full 90s window boundary', () => {
    const windows = buildTranscriptWindows([
      segment({ startSec: 0, endSec: 3, text: 'first' }),
      segment({ startSec: 10, endSec: 27, text: 'second' }),
    ]);
    expect(windows).toHaveLength(1);
    expect(windows[0]!.endSec).toBe(27);
  });

  it('grows endSec as later segments extend it, still never past the true last segment', () => {
    const windows = buildTranscriptWindows([
      segment({ startSec: 0, endSec: 5, text: 'first' }),
      segment({ startSec: 60, endSec: 82, text: 'second' }),
    ]);
    expect(windows[0]!.endSec).toBe(82);
  });

  it('collects distinct speaker labels in first-seen order without duplicates', () => {
    const windows = buildTranscriptWindows([
      segment({ startSec: 0, speakerLabel: 'Trainer' }),
      segment({ startSec: 10, speakerLabel: 'Students' }),
      segment({ startSec: 20, speakerLabel: 'Trainer' }),
    ]);
    expect(windows[0]!.speakerLabels).toEqual(['Trainer', 'Students']);
  });
});

function makeWindows(count: number): TranscriptWindow[] {
  return Array.from({ length: count }, (_, i) => ({
    startSec: i * 90,
    endSec: i * 90 + 90,
    text: `window ${i} generic filler text about the classroom session`,
    speakerLabels: ['Trainer'],
  }));
}

describe('selectRelevantWindows', () => {
  it('returns every window when there are fewer than the cap', () => {
    const windows = makeWindows(3);
    expect(selectRelevantWindows(windows, 'anything', 6)).toHaveLength(3);
  });

  it('prioritises windows whose text overlaps the question', () => {
    const windows = makeWindows(10);
    windows[7]!.text = 'lead qualification requires checking budget authority need timeline';
    const selected = selectRelevantWindows(windows, 'What is lead qualification?', 3);
    expect(selected.map((w) => w.startSec)).toContain(7 * 90);
  });

  it('keeps chronological order in the returned selection', () => {
    const windows = makeWindows(10);
    windows[2]!.text = 'lead scoring budget';
    windows[8]!.text = 'lead scoring budget';
    const selected = selectRelevantWindows(windows, 'lead scoring budget', 4);
    const starts = selected.map((w) => w.startSec);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('falls back to evenly spaced windows across the whole session when there is no lexical signal', () => {
    const windows = makeWindows(20);
    const selected = selectRelevantWindows(windows, 'zzz nonexistent qqq', 4);
    expect(selected).toHaveLength(4);
    expect(selected[0]!.startSec).toBe(0);
    expect(selected[selected.length - 1]!.startSec).toBe(19 * 90);
  });
});

describe('windowToSource', () => {
  it('joins multiple speakers and preserves the time range', () => {
    const window: TranscriptWindow = {
      startSec: 90,
      endSec: 180,
      text: 'x',
      speakerLabels: ['Trainer', 'Students'],
    };
    expect(windowToSource(window)).toEqual({
      startSec: 90,
      endSec: 180,
      speakerLabel: 'Trainer & Students',
    });
  });

  it('falls back to "Unknown speaker" when no speaker label was captured', () => {
    const window: TranscriptWindow = { startSec: 0, endSec: 90, text: 'x', speakerLabels: [] };
    expect(windowToSource(window).speakerLabel).toBe('Unknown speaker');
  });
});

describe('buildAssistantSystemPrompt', () => {
  it('names the session and states the fabrication refusal exactly', () => {
    const prompt = buildAssistantSystemPrompt('Day 04 — CRM Fundamentals');
    expect(prompt).toContain('Day 04 — CRM Fundamentals');
    expect(prompt).toContain('I could not find that information in this recorded session.');
  });

  it('demotes the session data block below these instructions (prompt-injection defense)', () => {
    const prompt = buildAssistantSystemPrompt('Any session');
    expect(prompt.toLowerCase()).toContain('untrusted');
    expect(prompt).toContain('always take priority');
  });
});

describe('buildSessionDataBlock', () => {
  it('includes the summary and transcript excerpts with timestamps', () => {
    const block = buildSessionDataBlock('Great session on CRM basics.', [
      { startSec: 65, endSec: 125, text: 'discussion of lead scoring', speakerLabels: ['Trainer'] },
    ]);
    expect(block).toContain('Great session on CRM basics.');
    expect(block).toContain('01:05');
    expect(block).toContain('discussion of lead scoring');
  });

  it('truncates an overlong window to the character ceiling', () => {
    const longText = 'a'.repeat(MAX_WINDOW_CHARS + 200);
    const block = buildSessionDataBlock(null, [
      { startSec: 0, endSec: 90, text: longText, speakerLabels: ['Trainer'] },
    ]);
    expect(block).toContain('…');
    expect(block.length).toBeLessThan(longText.length + 100);
  });

  it('says plainly when there is nothing to include', () => {
    expect(buildSessionDataBlock(null, [])).toBe(
      'No transcript or summary is available for this session yet.',
    );
  });
});

function assistantMessage(role: 'user' | 'assistant', content: string): AssistantMessage {
  return { id: content, role, content, sources: [], createdAt: '', createdBy: 'u1' };
}

describe('selectRecentHistory', () => {
  it('keeps only the most recent messages within the cap', () => {
    const messages = Array.from({ length: 20 }, (_, i) => assistantMessage('user', `m${i}`));
    const history = selectRecentHistory(messages, 4);
    expect(history).toHaveLength(4);
    expect(history.map((h) => h.content)).toEqual(['m16', 'm17', 'm18', 'm19']);
  });

  it('drops sources/ids, keeping only role and content', () => {
    const history = selectRecentHistory([assistantMessage('assistant', 'answer')], 10);
    expect(history).toEqual([{ role: 'assistant', content: 'answer' }]);
  });
});

describe('evaluateRateLimit', () => {
  it('allows the first request with no prior state', () => {
    const decision = evaluateRateLimit(null, 1000, 3, 60_000);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.next).toEqual({ windowStartAt: 1000, count: 1 });
  });

  it('increments within the window while under the cap', () => {
    const decision = evaluateRateLimit({ windowStartAt: 1000, count: 1 }, 2000, 3, 60_000);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.next.count).toBe(2);
  });

  it('rejects once the cap is reached inside the window', () => {
    const decision = evaluateRateLimit({ windowStartAt: 1000, count: 3 }, 2000, 3, 60_000);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.retryAfterMs).toBe(1000 + 60_000 - 2000);
  });

  it('resets to a fresh window once the previous one has expired', () => {
    const decision = evaluateRateLimit({ windowStartAt: 1000, count: 3 }, 61_001, 3, 60_000);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.next).toEqual({ windowStartAt: 61_001, count: 1 });
  });

  it('treats the exact window boundary as expired (>= not >)', () => {
    const decision = evaluateRateLimit({ windowStartAt: 1000, count: 3 }, 61_000, 3, 60_000);
    expect(decision.allowed).toBe(true);
  });
});
