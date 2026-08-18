import { describe, expect, it } from 'vitest';

import {
  br02Checklist,
  canConvertLead,
  outcomeTone,
  partitionByHeld,
  recommendingSession,
} from './logic';
import type { CounsellingSession } from './schema';

function session(overrides: Partial<CounsellingSession> = {}): CounsellingSession {
  return {
    id: 's1',
    leadId: 'l1',
    leadName: 'Asha Menon',
    consultantUid: 'u1',
    consultantName: 'Consultant',
    heldAt: '2026-07-01T10:00:00.000Z',
    mode: 'in_person',
    notes: 'Discussed programme options.',
    needsAssessment: null,
    recommendation: { programmeId: 'p1', programmeName: 'Programme One', remarks: null },
    outcome: 'recommended',
    createdAt: '2026-07-01T10:00:00.000Z',
    createdBy: 'u1',
    updatedAt: '2026-07-01T10:00:00.000Z',
    updatedBy: 'u1',
    ...overrides,
  };
}

describe('recommendingSession', () => {
  it('returns null when there are no sessions', () => {
    expect(recommendingSession([])).toBeNull();
  });

  it('accepts a recommended session that names a programme', () => {
    expect(recommendingSession([session()])?.id).toBe('s1');
  });

  it('rejects a recommended outcome with no programme named', () => {
    expect(recommendingSession([session({ recommendation: null })])).toBeNull();
  });

  it('rejects a non-recommended outcome', () => {
    expect(recommendingSession([session({ outcome: 'not_suitable' })])).toBeNull();
  });

  it('honours the most recent session, not an older approval', () => {
    // The consultant later decided the lead was not suitable — that must win.
    const sessions = [
      session({ id: 'old', heldAt: '2026-07-01T10:00:00.000Z', outcome: 'recommended' }),
      session({
        id: 'new',
        heldAt: '2026-07-10T10:00:00.000Z',
        outcome: 'not_suitable',
        recommendation: null,
      }),
    ];
    expect(recommendingSession(sessions)).toBeNull();
    expect(canConvertLead(sessions)).toBe(false);
  });

  it('lets a later recommendation override an earlier rejection', () => {
    const sessions = [
      session({
        id: 'old',
        heldAt: '2026-07-01T10:00:00.000Z',
        outcome: 'not_suitable',
        recommendation: null,
      }),
      session({ id: 'new', heldAt: '2026-07-10T10:00:00.000Z', outcome: 'recommended' }),
    ];
    expect(recommendingSession(sessions)?.id).toBe('new');
    expect(canConvertLead(sessions)).toBe(true);
  });
});

describe('br02Checklist', () => {
  it('explains that no session exists', () => {
    const result = br02Checklist([]);
    expect(result.satisfied).toBe(false);
    expect(result.blocker).toContain('No counselling session');
  });

  it('explains a wrong outcome', () => {
    const result = br02Checklist([session({ outcome: 'follow_up', recommendation: null })]);
    expect(result.satisfied).toBe(false);
    expect(result.hasSession).toBe(true);
    expect(result.blocker).toContain('follow_up');
  });

  it('explains a missing programme recommendation', () => {
    const result = br02Checklist([session({ recommendation: null })]);
    expect(result.satisfied).toBe(false);
    expect(result.latestOutcomeRecommended).toBe(true);
    expect(result.blocker).toContain('does not name a programme');
  });

  it('is satisfied with no blocker when BR-02 holds', () => {
    const result = br02Checklist([session()]);
    expect(result.satisfied).toBe(true);
    expect(result.blocker).toBeNull();
  });
});

describe('partitionByHeld', () => {
  const now = new Date('2026-07-05T00:00:00.000Z');

  it('splits future from past sessions', () => {
    const { upcoming, held } = partitionByHeld(
      [
        session({ id: 'past', heldAt: '2026-07-01T10:00:00.000Z' }),
        session({ id: 'future', heldAt: '2026-07-09T10:00:00.000Z' }),
      ],
      now,
    );
    expect(upcoming.map((s) => s.id)).toEqual(['future']);
    expect(held.map((s) => s.id)).toEqual(['past']);
  });

  it('orders upcoming soonest-first and held most-recent-first', () => {
    const { upcoming, held } = partitionByHeld(
      [
        session({ id: 'far', heldAt: '2026-07-20T10:00:00.000Z' }),
        session({ id: 'soon', heldAt: '2026-07-06T10:00:00.000Z' }),
        session({ id: 'older', heldAt: '2026-06-01T10:00:00.000Z' }),
        session({ id: 'recent', heldAt: '2026-07-04T10:00:00.000Z' }),
      ],
      now,
    );
    expect(upcoming.map((s) => s.id)).toEqual(['soon', 'far']);
    expect(held.map((s) => s.id)).toEqual(['recent', 'older']);
  });
});

describe('outcomeTone', () => {
  it('maps outcomes to the status palette', () => {
    expect(outcomeTone('recommended')).toBe('success');
    expect(outcomeTone('follow_up')).toBe('progress');
    expect(outcomeTone('not_suitable')).toBe('neutral');
  });
});
