import { describe, expect, it } from 'vitest';

import {
  canCreatePlacement,
  feeDisclosure,
  isTerminalStatus,
  isValidTransition,
  pipelineCounts,
} from './logic';

describe('canCreatePlacement (BR-09 — selective, never automatic)', () => {
  it('allows creation only when explicitly eligible', () => {
    expect(canCreatePlacement('eligible')).toBe(true);
    expect(canCreatePlacement('not_eligible')).toBe(false);
    expect(canCreatePlacement('not_evaluated')).toBe(false);
  });
});

describe('isTerminalStatus', () => {
  it('treats placed and dropped as terminal', () => {
    expect(isTerminalStatus('placed')).toBe(true);
    expect(isTerminalStatus('dropped')).toBe(true);
    expect(isTerminalStatus('under_review')).toBe(false);
  });
});

describe('isValidTransition', () => {
  it('allows forward moves through the stage order', () => {
    expect(isValidTransition('under_review', 'shortlisted')).toBe(true);
    expect(isValidTransition('under_review', 'placed')).toBe(true);
    expect(isValidTransition('interview', 'offer')).toBe(true);
  });

  it('rejects backward moves', () => {
    expect(isValidTransition('interview', 'shortlisted')).toBe(false);
  });

  it('rejects a no-op move to the same status', () => {
    expect(isValidTransition('interview', 'interview')).toBe(false);
  });

  it('allows dropping from any non-terminal stage', () => {
    expect(isValidTransition('under_review', 'dropped')).toBe(true);
    expect(isValidTransition('offer', 'dropped')).toBe(true);
  });

  it('rejects any move out of a terminal stage', () => {
    expect(isValidTransition('placed', 'dropped')).toBe(false);
    expect(isValidTransition('dropped', 'under_review')).toBe(false);
  });
});

describe('feeDisclosure (BR-08 — zero fee to the student, always)', () => {
  it('is always literally zero regardless of input', () => {
    expect(feeDisclosure('Visa cost borne by candidate')).toEqual({
      terranextFeePaise: 0,
      thirdPartyNotes: 'Visa cost borne by candidate',
    });
    expect(feeDisclosure(null).terranextFeePaise).toBe(0);
  });
});

describe('pipelineCounts', () => {
  it('counts every status, including zero for empty ones', () => {
    const counts = pipelineCounts(['under_review', 'under_review', 'placed']);
    expect(counts.under_review).toBe(2);
    expect(counts.placed).toBe(1);
    expect(counts.shortlisted).toBe(0);
    expect(counts.dropped).toBe(0);
  });
});
