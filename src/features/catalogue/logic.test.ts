import { describe, expect, it } from 'vitest';

import {
  areCertificateRulesValid,
  canArchive,
  formatPaise,
  isFeePlanBalanced,
  slugify,
  sumInstallments,
} from './logic';

const plan = [
  { label: 'Deposit', amountPaise: 500_000, dueOffsetDays: 0 },
  { label: 'Balance', amountPaise: 1_000_000, dueOffsetDays: 30 },
];

describe('sumInstallments (ADR-012 integer paise)', () => {
  it('sums exactly, with no floating-point drift', () => {
    expect(sumInstallments(plan)).toBe(1_500_000);
  });

  it('is zero for an empty plan', () => {
    expect(sumInstallments([])).toBe(0);
  });
});

describe('isFeePlanBalanced', () => {
  it('accepts a plan whose installments equal the total', () => {
    expect(isFeePlanBalanced(1_500_000, plan)).toBe(true);
  });

  it('rejects a plan that does not add up — it could never reconcile', () => {
    expect(isFeePlanBalanced(1_400_000, plan)).toBe(false);
    expect(isFeePlanBalanced(1_600_000, plan)).toBe(false);
  });

  it('treats an empty installment list as valid (pay-in-full)', () => {
    expect(isFeePlanBalanced(1_500_000, [])).toBe(true);
  });

  it('catches an off-by-one-paise plan', () => {
    expect(isFeePlanBalanced(1_499_999, plan)).toBe(false);
  });
});

describe('areCertificateRulesValid (BR-03 thresholds)', () => {
  it('accepts whole percentages within 0-100', () => {
    expect(areCertificateRulesValid(75, 40)).toBe(true);
    expect(areCertificateRulesValid(0, 100)).toBe(true);
  });

  it('rejects out-of-range percentages', () => {
    expect(areCertificateRulesValid(101, 40)).toBe(false);
    expect(areCertificateRulesValid(75, -1)).toBe(false);
  });

  it('rejects fractional percentages', () => {
    expect(areCertificateRulesValid(75.5, 40)).toBe(false);
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Gen Z Career Readiness')).toBe('gen-z-career-readiness');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('Parent  &  Family — Transformation!')).toBe('parent-family-transformation');
  });

  it('does not leave leading or trailing hyphens', () => {
    expect(slugify('  —Trade & Career—  ')).toBe('trade-career');
  });
});

describe('canArchive (Doc 03 §4 — archive, never delete)', () => {
  it('allows archiving an academy with no programmes', () => {
    expect(canArchive(0)).toBe(true);
  });

  it('refuses while programmes still reference it', () => {
    expect(canArchive(3)).toBe(false);
  });
});

describe('formatPaise (ADR-012 display)', () => {
  it('renders paise as rupees with two decimals', () => {
    expect(formatPaise(1_500_000)).toBe('₹15,000.00');
    expect(formatPaise(50)).toBe('₹0.50');
  });

  it('renders zero cleanly', () => {
    expect(formatPaise(0)).toBe('₹0.00');
  });
});
