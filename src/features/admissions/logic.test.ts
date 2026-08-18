import { describe, expect, it } from 'vitest';

import type { CounsellingSession } from '@/features/counselling';

import {
  canConvert,
  hasBlockingDuplicate,
  isAdmissionCandidate,
  readyCount,
  sortCandidates,
} from './logic';
import type { AdmissionCandidate, DuplicateMatch } from './schema';

function session(overrides: Partial<CounsellingSession> = {}): CounsellingSession {
  return {
    id: 's1',
    leadId: 'l1',
    leadName: 'Asha',
    consultantUid: 'u1',
    consultantName: 'C',
    heldAt: '2026-07-01T10:00:00.000Z',
    mode: 'in_person',
    notes: 'notes',
    needsAssessment: null,
    recommendation: { programmeId: 'p1', programmeName: 'P1', remarks: null },
    outcome: 'recommended',
    createdAt: '2026-07-01T10:00:00.000Z',
    createdBy: 'u1',
    updatedAt: '2026-07-01T10:00:00.000Z',
    updatedBy: 'u1',
    ...overrides,
  };
}

function candidate(overrides: Partial<AdmissionCandidate> = {}): AdmissionCandidate {
  return {
    leadId: 'l1',
    name: 'Asha',
    phone: '+919000000001',
    email: null,
    stage: 'hot',
    source: 'website',
    assignedToName: null,
    checklist: {
      hasSession: true,
      latestOutcomeRecommended: true,
      hasProgrammeRecommendation: true,
      satisfied: true,
      blocker: null,
    },
    recommendedProgrammeName: 'P1',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

const blocked = {
  hasSession: false,
  latestOutcomeRecommended: false,
  hasProgrammeRecommendation: false,
  satisfied: false,
  blocker: 'No counselling session recorded yet (BR-02).',
};

describe('isAdmissionCandidate', () => {
  it('accepts the two stages the queue is built from', () => {
    expect(isAdmissionCandidate('hot')).toBe(true);
    expect(isAdmissionCandidate('counselling_attended')).toBe(true);
  });

  it('excludes stages that are not ready for admission', () => {
    expect(isAdmissionCandidate('new')).toBe(false);
    expect(isAdmissionCandidate('admitted')).toBe(false);
    expect(isAdmissionCandidate('lost')).toBe(false);
  });
});

describe('canConvert', () => {
  it('permits conversion when BR-02 is satisfied', () => {
    expect(canConvert([session()])).toBe(true);
  });

  it('refuses with no session at all', () => {
    expect(canConvert([])).toBe(false);
  });

  it('refuses when the recommendation names no programme', () => {
    expect(canConvert([session({ recommendation: null })])).toBe(false);
  });
});

describe('hasBlockingDuplicate', () => {
  const match: DuplicateMatch = {
    participantId: 'TNX-2026-00001',
    fullName: 'Asha',
    phone: '+919000000001',
    matchedOn: 'phone',
  };

  it('blocks an unacknowledged duplicate', () => {
    expect(hasBlockingDuplicate([match], false)).toBe(true);
  });

  it('lets a consciously acknowledged duplicate through', () => {
    expect(hasBlockingDuplicate([match], true)).toBe(false);
  });

  it('does not block when there is no duplicate', () => {
    expect(hasBlockingDuplicate([], false)).toBe(false);
  });
});

describe('sortCandidates', () => {
  it('puts BR-02-ready candidates first', () => {
    const rows = sortCandidates([
      candidate({ leadId: 'blocked', checklist: blocked }),
      candidate({ leadId: 'ready' }),
    ]);
    expect(rows.map((r) => r.leadId)).toEqual(['ready', 'blocked']);
  });

  it('breaks ties by most recently updated', () => {
    const rows = sortCandidates([
      candidate({ leadId: 'older', updatedAt: '2026-07-01T00:00:00.000Z' }),
      candidate({ leadId: 'newer', updatedAt: '2026-07-09T00:00:00.000Z' }),
    ]);
    expect(rows.map((r) => r.leadId)).toEqual(['newer', 'older']);
  });
});

describe('readyCount', () => {
  it('counts only the candidates BR-02 clears', () => {
    expect(readyCount([candidate(), candidate({ checklist: blocked })])).toBe(1);
  });
});
