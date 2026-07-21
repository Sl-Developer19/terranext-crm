import { describe, expect, it } from 'vitest';

import {
  acceptsAllocations,
  generateSessionDates,
  hasCapacity,
  isTerminalBatchStatus,
  schedulesOverlap,
  seatsRemaining,
  utilizationPct,
} from './logic';

describe('hasCapacity (BR-04)', () => {
  it('allows allocation while seats remain', () => {
    expect(hasCapacity(29, 30)).toBe(true);
  });

  it('refuses the seat that would exceed capacity', () => {
    expect(hasCapacity(30, 30)).toBe(false);
  });

  it('refuses when the count has somehow drifted above capacity', () => {
    expect(hasCapacity(31, 30)).toBe(false);
  });
});

describe('seatsRemaining', () => {
  it('reports remaining seats', () => {
    expect(seatsRemaining(12, 30)).toBe(18);
  });

  it('never reports negative seats even if data drifted', () => {
    expect(seatsRemaining(35, 30)).toBe(0);
  });
});

describe('utilizationPct', () => {
  it('rounds to a whole percentage', () => {
    expect(utilizationPct(1, 3)).toBe(33);
    expect(utilizationPct(15, 30)).toBe(50);
  });

  it('clamps an over-filled batch to 100', () => {
    expect(utilizationPct(35, 30)).toBe(100);
  });

  it('treats zero capacity as zero rather than dividing by zero', () => {
    expect(utilizationPct(0, 0)).toBe(0);
  });
});

describe('batch status rules', () => {
  it('accepts allocations only while planned or running', () => {
    expect(acceptsAllocations('planned')).toBe(true);
    expect(acceptsAllocations('running')).toBe(true);
    expect(acceptsAllocations('completed')).toBe(false);
    expect(acceptsAllocations('cancelled')).toBe(false);
  });

  it('identifies terminal states', () => {
    expect(isTerminalBatchStatus('completed')).toBe(true);
    expect(isTerminalBatchStatus('cancelled')).toBe(true);
    expect(isTerminalBatchStatus('planned')).toBe(false);
  });
});

describe('generateSessionDates', () => {
  it('expands a weekly schedule across the batch window', () => {
    // 2026-01-05 is a Monday.
    const dates = generateSessionDates('2026-01-05', '2026-01-18', ['mon', 'wed']);
    expect(dates).toEqual(['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14']);
  });

  it('includes both endpoints when they fall on scheduled days', () => {
    const dates = generateSessionDates('2026-01-05', '2026-01-05', ['mon']);
    expect(dates).toEqual(['2026-01-05']);
  });

  it('returns nothing when the window ends before it starts', () => {
    expect(generateSessionDates('2026-01-18', '2026-01-05', ['mon'])).toEqual([]);
  });

  it('returns nothing for an unparseable date', () => {
    expect(generateSessionDates('not-a-date', '2026-01-05', ['mon'])).toEqual([]);
  });

  it('caps generation so a mistyped end date cannot create thousands of docs', () => {
    const dates = generateSessionDates('2026-01-01', '2126-01-01', ['mon'], 10);
    expect(dates).toHaveLength(10);
  });
});

describe('schedulesOverlap (trainer double-booking)', () => {
  const monWed = { days: ['mon', 'wed'] as const, startTime: '10:00', endTime: '12:00' };

  it('detects an overlap on a shared day', () => {
    expect(schedulesOverlap(monWed, { days: ['wed'], startTime: '11:00', endTime: '13:00' })).toBe(
      true,
    );
  });

  it('ignores schedules on entirely different days', () => {
    expect(
      schedulesOverlap(monWed, { days: ['tue', 'thu'], startTime: '10:00', endTime: '12:00' }),
    ).toBe(false);
  });

  it('treats back-to-back slots as non-overlapping', () => {
    expect(schedulesOverlap(monWed, { days: ['mon'], startTime: '12:00', endTime: '14:00' })).toBe(
      false,
    );
    expect(schedulesOverlap(monWed, { days: ['mon'], startTime: '08:00', endTime: '10:00' })).toBe(
      false,
    );
  });

  it('detects full containment', () => {
    expect(schedulesOverlap(monWed, { days: ['mon'], startTime: '10:30', endTime: '11:00' })).toBe(
      true,
    );
  });
});
