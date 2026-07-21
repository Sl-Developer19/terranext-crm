import { describe, expect, it } from 'vitest';

import { deriveResult, isScoreInRange, meetsAssessmentThreshold, summarizeAttempts } from './logic';

describe('deriveResult (server-derived, never client-supplied)', () => {
  it('passes at exactly the pass mark', () => {
    expect(deriveResult(40, 40)).toBe('pass');
  });

  it('fails one mark below', () => {
    expect(deriveResult(39, 40)).toBe('fail');
  });

  it('passes above the mark', () => {
    expect(deriveResult(95, 40)).toBe('pass');
  });

  it('treats a zero pass mark as always passing', () => {
    expect(deriveResult(0, 0)).toBe('pass');
  });
});

describe('isScoreInRange', () => {
  it('accepts scores within 0..maxScore inclusive', () => {
    expect(isScoreInRange(0, 100)).toBe(true);
    expect(isScoreInRange(100, 100)).toBe(true);
  });

  it('rejects negatives and scores above the maximum', () => {
    expect(isScoreInRange(-1, 100)).toBe(false);
    expect(isScoreInRange(101, 100)).toBe(false);
  });

  it('rejects fractional marks', () => {
    expect(isScoreInRange(72.5, 100)).toBe(false);
  });
});

describe('summarizeAttempts', () => {
  it('counts attempts and passes', () => {
    const summary = summarizeAttempts([
      { score: 80, maxScore: 100, result: 'pass' },
      { score: 30, maxScore: 100, result: 'fail' },
    ]);
    expect(summary.attempted).toBe(2);
    expect(summary.passed).toBe(1);
  });

  it('averages PERCENTAGES so assessments of different weights compare fairly', () => {
    // 45/50 = 90%, 60/100 = 60% → mean 75%. Averaging raw marks would give
    // 52.5, which is meaningless across different maximums.
    const summary = summarizeAttempts([
      { score: 45, maxScore: 50, result: 'pass' },
      { score: 60, maxScore: 100, result: 'pass' },
    ]);
    expect(summary.avgScore).toBe(75);
  });

  it('returns a zeroed summary for no attempts', () => {
    expect(summarizeAttempts([])).toEqual({ attempted: 0, passed: 0, avgScore: 0 });
  });

  it('does not divide by zero when an assessment has no maximum', () => {
    const summary = summarizeAttempts([{ score: 0, maxScore: 0, result: 'fail' }]);
    expect(summary.avgScore).toBe(0);
    expect(summary.attempted).toBe(1);
  });

  it('is order-independent and idempotent — a full recompute', () => {
    const attempts = [
      { score: 45, maxScore: 50, result: 'pass' as const },
      { score: 60, maxScore: 100, result: 'pass' as const },
    ];
    const reversed = [...attempts].reverse();
    expect(summarizeAttempts(attempts)).toEqual(summarizeAttempts(reversed));
    expect(summarizeAttempts(attempts)).toEqual(summarizeAttempts(attempts));
  });

  it('rounds the average to a whole percent', () => {
    const summary = summarizeAttempts([
      { score: 1, maxScore: 3, result: 'fail' },
      { score: 2, maxScore: 3, result: 'pass' },
    ]);
    // 33.33 + 66.67 → mean 50
    expect(summary.avgScore).toBe(50);
  });
});

describe('meetsAssessmentThreshold (BR-03 assessment half)', () => {
  it('meets the bar at exactly the threshold', () => {
    expect(meetsAssessmentThreshold({ attempted: 2, passed: 2, avgScore: 40 }, 40)).toBe(true);
  });

  it('fails below the threshold', () => {
    expect(meetsAssessmentThreshold({ attempted: 2, passed: 1, avgScore: 39 }, 40)).toBe(false);
  });

  it('NEVER passes an unassessed participant — not-yet-measured is not met', () => {
    expect(meetsAssessmentThreshold({ attempted: 0, passed: 0, avgScore: 0 }, 0)).toBe(false);
    expect(meetsAssessmentThreshold({ attempted: 0, passed: 0, avgScore: 100 }, 40)).toBe(false);
  });
});
