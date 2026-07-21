import { describe, expect, it } from 'vitest';

import { consentLabel, totalEngagement } from './logic';

describe('totalEngagement', () => {
  it('sums referrals and events attended', () => {
    expect(totalEngagement({ referrals: 2, eventsAttended: 3 })).toBe(5);
  });

  it('is zero when nothing has been recorded', () => {
    expect(totalEngagement({ referrals: 0, eventsAttended: 0 })).toBe(0);
  });
});

describe('consentLabel', () => {
  it('labels consent state', () => {
    expect(consentLabel(true)).toBe('Consent given');
    expect(consentLabel(false)).toBe('No consent');
  });
});
