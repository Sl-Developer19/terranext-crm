import { describe, expect, it } from 'vitest';

import {
  calculateAttendancePct,
  countsAsAttended,
  countsTowardTotal,
  isAttendanceWriteScoped,
  isSessionFullyMarked,
} from './logic';

describe('attendance status classification', () => {
  it('counts present and late as attended', () => {
    expect(countsAsAttended('present')).toBe(true);
    expect(countsAsAttended('late')).toBe(true);
  });

  it('does not count absent or excused as attended', () => {
    expect(countsAsAttended('absent')).toBe(false);
    expect(countsAsAttended('excused')).toBe(false);
  });

  it('excludes excused from the denominator so it neither rewards nor penalises', () => {
    expect(countsTowardTotal('excused')).toBe(false);
    expect(countsTowardTotal('present')).toBe(true);
    expect(countsTowardTotal('absent')).toBe(true);
    expect(countsTowardTotal('late')).toBe(true);
  });
});

describe('calculateAttendancePct (the number BR-03 is checked against)', () => {
  it('computes a whole percentage', () => {
    expect(calculateAttendancePct(['present', 'present', 'present', 'absent'])).toBe(75);
  });

  it('treats late as attended', () => {
    expect(calculateAttendancePct(['present', 'late'])).toBe(100);
  });

  it('ignores excused entirely — 1 of 2 with an excused is still 50%', () => {
    expect(calculateAttendancePct(['present', 'absent', 'excused'])).toBe(50);
  });

  it('returns 100 when every counted session was attended', () => {
    expect(calculateAttendancePct(['present', 'present'])).toBe(100);
  });

  it('returns 0 for an all-excused set rather than dividing by zero', () => {
    expect(calculateAttendancePct(['excused', 'excused'])).toBe(0);
  });

  it('returns 0 when nothing has been marked yet, never a passing number', () => {
    expect(calculateAttendancePct([])).toBe(0);
  });

  it('rounds to the nearest whole percent', () => {
    // 2 of 3 = 66.67 → 67
    expect(calculateAttendancePct(['present', 'present', 'absent'])).toBe(67);
  });

  it('is order-independent — a full recompute, not a running total', () => {
    const a = calculateAttendancePct(['present', 'absent', 'late', 'excused']);
    const b = calculateAttendancePct(['excused', 'late', 'absent', 'present']);
    expect(a).toBe(b);
  });

  it('is idempotent under replay of the same data', () => {
    const statuses = ['present', 'absent', 'present'] as const;
    expect(calculateAttendancePct(statuses)).toBe(calculateAttendancePct(statuses));
  });
});

describe('isAttendanceWriteScoped (Doc 10 §2 trainer↔batch scope)', () => {
  it('denies a trainer marking a batch they do not run', () => {
    expect(isAttendanceWriteScoped('trainer', 'other-trainer', 'me')).toBe(true);
  });

  it('denies a trainer marking a batch with no trainer assigned', () => {
    expect(isAttendanceWriteScoped('trainer', null, 'me')).toBe(true);
  });

  it('allows a trainer marking their own batch', () => {
    expect(isAttendanceWriteScoped('trainer', 'me', 'me')).toBe(false);
  });

  it('never scopes coordinator or ops_manager', () => {
    expect(isAttendanceWriteScoped('coordinator', 'other-trainer', 'me')).toBe(false);
    expect(isAttendanceWriteScoped('ops_manager', null, 'me')).toBe(false);
  });
});

describe('isSessionFullyMarked', () => {
  it('is true once every roster member has a mark', () => {
    expect(isSessionFullyMarked(30, 30)).toBe(true);
  });

  it('is false while marks are missing', () => {
    expect(isSessionFullyMarked(29, 30)).toBe(false);
  });

  it('is false for an empty roster rather than vacuously true', () => {
    expect(isSessionFullyMarked(0, 0)).toBe(false);
  });
});
