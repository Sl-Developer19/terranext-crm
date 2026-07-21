import type { BatchStatus, Weekday } from './schema';

/**
 * Pure batch rules (no I/O). BR-04 capacity lives here so the transaction,
 * the UI affordance, and the tests all read the same definition — a capacity
 * rule that disagrees with itself between layers is how overbooking happens.
 */

/** BR-04: a seat exists only while `enrolledCount < capacity`. */
export function hasCapacity(enrolledCount: number, capacity: number): boolean {
  return enrolledCount < capacity;
}

/** Seats remaining, never negative even if data drifted. */
export function seatsRemaining(enrolledCount: number, capacity: number): number {
  return Math.max(0, capacity - enrolledCount);
}

/** Fill percentage for the utilization bar (S23). Clamped to 0–100. */
export function utilizationPct(enrolledCount: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((enrolledCount / capacity) * 100));
}

/**
 * Batches accept allocations only while planned or running. Allocating into
 * a completed batch would corrupt attendance and certificate evidence after
 * the fact; a cancelled batch has no sessions to attend.
 */
export function acceptsAllocations(status: BatchStatus): boolean {
  return status === 'planned' || status === 'running';
}

/** Terminal batch states cannot transition further. */
export function isTerminalBatchStatus(status: BatchStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

const WEEKDAY_INDEX: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Expands a weekly schedule into concrete session dates between two dates
 * (inclusive), capped at `limit` so a mistyped end date cannot generate
 * thousands of documents. Returns ISO `YYYY-MM-DD` strings.
 */
export function generateSessionDates(
  startDate: string,
  endDate: string,
  days: readonly Weekday[],
  limit = 200,
): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const wanted = new Set(days.map((day) => WEEKDAY_INDEX[day]));
  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end && dates.length < limit) {
    if (wanted.has(cursor.getUTCDay())) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * A trainer may only be assigned to one batch in a given time slot on a
 * given day. Overlap is checked on the half-open interval [start, end) so a
 * batch ending at 12:00 and one starting at 12:00 do not count as clashing.
 */
export function schedulesOverlap(
  a: { days: readonly Weekday[]; startTime: string; endTime: string },
  b: { days: readonly Weekday[]; startTime: string; endTime: string },
): boolean {
  const sharesDay = a.days.some((day) => b.days.includes(day));
  if (!sharesDay) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}
