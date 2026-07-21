import { describe, expect, it } from 'vitest';

import {
  buildFamilySearchTokens,
  canConvertParent,
  conversionBlocker,
  conversionRate,
  highestConversionStatus,
  isActiveOutcome,
  latestRecommendedProgramme,
} from './logic';

const recommended = {
  outcome: 'recommended' as const,
  recommendedProgrammeId: 'prog-1',
  heldAt: '2026-03-01',
};
const followUp = {
  outcome: 'follow_up' as const,
  recommendedProgrammeId: null,
  heldAt: '2026-02-01',
};

describe('highestConversionStatus', () => {
  it('reports the furthest state any parent in the household reached', () => {
    expect(highestConversionStatus(['not_converted', 'enrolled', 'lead_created'])).toBe('enrolled');
    expect(highestConversionStatus(['not_converted', 'lead_created'])).toBe('lead_created');
  });

  it('is not_converted for an empty household', () => {
    expect(highestConversionStatus([])).toBe('not_converted');
  });
});

describe('canConvertParent (mirrors BR-02 for the parent path)', () => {
  it('allows conversion after a recommendation with a programme', () => {
    expect(canConvertParent([recommended])).toBe(true);
  });

  it('refuses when no session has been recorded', () => {
    expect(canConvertParent([])).toBe(false);
  });

  it('refuses when sessions exist but none recommended anything', () => {
    expect(canConvertParent([followUp])).toBe(false);
  });

  it('refuses a "recommended" outcome with no programme attached', () => {
    expect(canConvertParent([{ outcome: 'recommended', recommendedProgrammeId: null }])).toBe(
      false,
    );
  });

  it('allows once any one session qualifies, even among non-qualifying ones', () => {
    expect(canConvertParent([followUp, recommended])).toBe(true);
  });
});

describe('conversionBlocker', () => {
  it('is null when conversion is allowed', () => {
    expect(conversionBlocker([recommended])).toBeNull();
  });

  it('distinguishes "no sessions" from "no recommendation"', () => {
    expect(conversionBlocker([])).toContain('No counselling session has been recorded');
    expect(conversionBlocker([followUp])).toContain('has recommended a programme');
  });
});

describe('latestRecommendedProgramme', () => {
  it('returns the most recent recommendation', () => {
    const older = { ...recommended, recommendedProgrammeId: 'prog-old', heldAt: '2026-01-01' };
    expect(latestRecommendedProgramme([older, recommended])).toBe('prog-1');
  });

  it('ignores non-recommending sessions', () => {
    expect(latestRecommendedProgramme([followUp])).toBeNull();
  });

  it('is null when there is nothing to recommend', () => {
    expect(latestRecommendedProgramme([])).toBeNull();
  });
});

describe('isActiveOutcome', () => {
  it('keeps recommended and follow-up in the pipeline', () => {
    expect(isActiveOutcome('recommended')).toBe(true);
    expect(isActiveOutcome('follow_up')).toBe(true);
  });

  it('drops not_interested out of the pipeline', () => {
    expect(isActiveOutcome('not_interested')).toBe(false);
  });
});

describe('conversionRate (Parent Conversion Report)', () => {
  it('computes a whole percentage', () => {
    expect(conversionRate(3, 12)).toBe(25);
  });

  it('is 0% for no households rather than dividing by zero', () => {
    expect(conversionRate(0, 0)).toBe(0);
  });

  it('is 100% when every household converted', () => {
    expect(conversionRate(8, 8)).toBe(100);
  });
});

describe('buildFamilySearchTokens', () => {
  it('indexes family and contact name parts', () => {
    const tokens = buildFamilySearchTokens('Sharma', 'Priya Sharma', '+919876504821');
    expect(tokens).toContain('sha');
    expect(tokens).toContain('pri');
  });

  it('indexes phone suffixes, not the shared country code', () => {
    const tokens = buildFamilySearchTokens('Sharma', 'Priya', '+919876504821');
    expect(tokens).toContain('4821');
    expect(tokens).not.toContain('9198');
  });
});
