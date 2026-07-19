import { describe, expect, it } from 'vitest';

import { formatPaise, formatPaiseWhole, formatPercent, parseRupeesToPaise } from './format';

describe('money formatting (ADR-012: integer paise)', () => {
  it('formats paise to rupees', () => {
    // ₹ = ₹; Intl output uses non-breaking spaces on some ICU builds,
    // so assert on digits and symbol presence rather than exact bytes
    expect(formatPaise(150000)).toContain('1,500');
    expect(formatPaise(150050)).toContain('1,500.50');
    expect(formatPaiseWhole(150000)).toContain('1,500');
    expect(formatPaiseWhole(150000)).not.toContain('.');
  });

  it('parses user input to exact paise', () => {
    expect(parseRupeesToPaise('1,500.50')).toBe(150050);
    expect(parseRupeesToPaise('₹1,500')).toBe(150000);
    expect(parseRupeesToPaise(' 999.99 ')).toBe(99999);
  });

  it('round-trips without float drift', () => {
    // the classic 0.1+0.2 class of bug must be impossible
    const total = parseRupeesToPaise('0.10') + parseRupeesToPaise('0.20');
    expect(total).toBe(30);
  });
});

describe('percent formatting', () => {
  it('hides decimals for whole numbers only', () => {
    expect(formatPercent(80)).toBe('80%');
    expect(formatPercent(79.5)).toBe('79.5%');
    expect(formatPercent(79.55)).toBe('79.6%');
  });
});
