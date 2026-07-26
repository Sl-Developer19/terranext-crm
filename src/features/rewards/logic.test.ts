import { describe, expect, it } from 'vitest';

import { computeRewardAmount } from './logic';

describe('computeRewardAmount (Doc 25 §10/§11)', () => {
  it('returns the configured flat amount unchanged', () => {
    expect(
      computeRewardAmount({ kind: 'flat', amountPaise: 50_000, percentBps: null }, 200_000),
    ).toBe(50_000);
  });

  it('computes a percentage of the payment, rounded to the nearest paisa', () => {
    // 5% (500 bps) of 199,999 paise = 9,999.95 -> rounds to 10,000
    expect(
      computeRewardAmount({ kind: 'percent', amountPaise: null, percentBps: 500 }, 199_999),
    ).toBe(10_000);
  });

  it('treats a missing amount/percent as zero rather than throwing', () => {
    expect(
      computeRewardAmount({ kind: 'flat', amountPaise: null, percentBps: null }, 100_000),
    ).toBe(0);
    expect(
      computeRewardAmount({ kind: 'percent', amountPaise: null, percentBps: null }, 100_000),
    ).toBe(0);
  });
});
