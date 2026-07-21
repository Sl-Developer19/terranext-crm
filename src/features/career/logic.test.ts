import { describe, expect, it } from 'vitest';

import { canEvaluate, eligibilityRate, isPlacementEligible } from './logic';

describe('isPlacementEligible (BR-09 — selective, never automatic)', () => {
  it('is true only for the explicit eligible state', () => {
    expect(isPlacementEligible('eligible')).toBe(true);
    expect(isPlacementEligible('not_eligible')).toBe(false);
    expect(isPlacementEligible('not_evaluated')).toBe(false);
  });
});

describe('canEvaluate', () => {
  it('allows re-evaluation from any state — no locked terminal state', () => {
    expect(canEvaluate('not_evaluated')).toBe(true);
    expect(canEvaluate('eligible')).toBe(true);
    expect(canEvaluate('not_eligible')).toBe(true);
  });
});

describe('eligibilityRate', () => {
  it('computes a whole percentage', () => {
    expect(eligibilityRate(3, 12)).toBe(25);
  });

  it('is null with nothing evaluated yet, not 0%', () => {
    expect(eligibilityRate(0, 0)).toBeNull();
  });
});
