import { describe, expect, it } from 'vitest';

import {
  buildAlumniGrowth,
  buildAttendanceRisk,
  buildBatchUtilisation,
  buildCounsellingConversion,
  buildDuplicateSuspects,
  buildGrowthPartnerRewards,
  buildLeadSource,
  buildPlacementFunnel,
  monthKey,
  pct,
} from './logic';

describe('pct', () => {
  it('returns null rather than dividing by zero', () => {
    expect(pct(3, 0)).toBeNull();
  });

  it('rounds to one decimal', () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(2, 3)).toBe(66.7);
    expect(pct(1, 2)).toBe(50);
  });
});

describe('buildBatchUtilisation', () => {
  const batches = [
    { batchName: 'Full', programmeName: 'P', status: 'running', enrolled: 10, capacity: 10 },
    { batchName: 'Empty', programmeName: 'P', status: 'planned', enrolled: 0, capacity: 20 },
    { batchName: 'Half', programmeName: 'P', status: 'running', enrolled: 5, capacity: 10 },
  ];

  it('puts the least-filled batch first', () => {
    const rows = buildBatchUtilisation(batches).rows;
    expect(rows.map((r) => r.batchName)).toEqual(['Empty', 'Half', 'Full']);
  });

  it('computes utilisation percentage', () => {
    const rows = buildBatchUtilisation(batches).rows;
    expect(rows.find((r) => r.batchName === 'Half')?.utilisationPct).toBe(50);
    expect(rows.find((r) => r.batchName === 'Full')?.utilisationPct).toBe(100);
  });

  it('survives a batch with zero capacity', () => {
    const result = buildBatchUtilisation([
      { batchName: 'Bad', programmeName: 'P', status: 'planned', enrolled: 0, capacity: 0 },
    ]);
    expect(result.rows[0]?.utilisationPct).toBeNull();
  });
});

describe('buildAttendanceRisk', () => {
  const base = { participantName: 'A', participantId: 'p1', batchName: 'B1' };

  it('flags only participants below their threshold', () => {
    const result = buildAttendanceRisk([
      { ...base, batchRunning: true, attendancePct: 60, requiredPct: 75 },
      { ...base, participantId: 'p2', batchRunning: true, attendancePct: 90, requiredPct: 75 },
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.participantId).toBe('p1');
  });

  it('ignores finished batches — the shortfall is no longer actionable', () => {
    const result = buildAttendanceRisk([
      { ...base, batchRunning: false, attendancePct: 10, requiredPct: 75 },
    ]);
    expect(result.rows).toHaveLength(0);
    expect(result.note).toContain('No participant');
  });

  it('sorts by largest shortfall and reports it', () => {
    const result = buildAttendanceRisk([
      { ...base, participantId: 'small', batchRunning: true, attendancePct: 70, requiredPct: 75 },
      { ...base, participantId: 'big', batchRunning: true, attendancePct: 20, requiredPct: 75 },
    ]);
    expect(result.rows.map((r) => r.participantId)).toEqual(['big', 'small']);
    expect(result.rows[0]?.shortfallPct).toBe(55);
  });
});

describe('buildLeadSource', () => {
  it('groups by source with conversion rates, busiest first', () => {
    const result = buildLeadSource([
      { source: 'website', admitted: true },
      { source: 'website', admitted: false },
      { source: 'referral', admitted: true },
    ]);
    expect(result.rows[0]).toMatchObject({
      source: 'website',
      total: 2,
      admitted: 1,
      conversionPct: 50,
    });
    expect(result.rows[1]).toMatchObject({ source: 'referral', total: 1, conversionPct: 100 });
  });

  it('handles no leads at all', () => {
    expect(buildLeadSource([]).rows).toEqual([]);
  });
});

describe('buildCounsellingConversion', () => {
  it('passes the BR-02 integrity check when no admission bypassed counselling', () => {
    const result = buildCounsellingConversion({
      counselled: 10,
      admitted: 4,
      admittedWithoutCounselling: 0,
    });
    expect(result.rows).toContainEqual({ metric: 'Conversion %', value: 40 });
    expect(result.note).toContain('passed');
  });

  it('fails loudly when an admission bypassed counselling', () => {
    const result = buildCounsellingConversion({
      counselled: 10,
      admitted: 4,
      admittedWithoutCounselling: 2,
    });
    expect(result.note).toContain('FAILED');
    expect(result.note).toContain('2');
  });

  it('says the check is not assessable rather than asserting a zero it cannot verify', () => {
    const result = buildCounsellingConversion({
      counselled: 10,
      admitted: 4,
      admittedWithoutCounselling: null,
    });
    expect(result.note).toContain('not assessable');
    expect(result.note).not.toContain('passed');
    // The conversion figure itself is still real and still shown.
    expect(result.rows).toContainEqual({ metric: 'Conversion %', value: 40 });
  });
});

describe('buildAlumniGrowth', () => {
  it('buckets by month and accumulates a running total', () => {
    const result = buildAlumniGrowth([
      '2026-06-15T00:00:00.000Z',
      '2026-07-02T00:00:00.000Z',
      '2026-07-20T00:00:00.000Z',
    ]);
    expect(result.rows).toEqual([
      { month: '2026-06', newAlumni: 1, runningTotal: 1 },
      { month: '2026-07', newAlumni: 2, runningTotal: 3 },
    ]);
  });

  it('skips records with no membership date', () => {
    expect(buildAlumniGrowth(['', '2026-07-01T00:00:00.000Z']).rows).toHaveLength(1);
  });
});

describe('monthKey', () => {
  it('takes the ISO year-month prefix', () => {
    expect(monthKey('2026-07-22T10:00:00.000Z')).toBe('2026-07');
  });
});

describe('buildDuplicateSuspects', () => {
  it('reports phones carrying more than one open lead', () => {
    const result = buildDuplicateSuspects([
      { phone: '+919000000001', name: 'Asha', converted: false },
      { phone: '+919000000001', name: 'A. Menon', converted: false },
      { phone: '+919000000002', name: 'Ravi', converted: false },
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ leadCount: 2, names: 'Asha, A. Menon' });
  });

  it('excludes converted leads — those already became a participant', () => {
    const result = buildDuplicateSuspects([
      { phone: '+919000000001', name: 'Asha', converted: true },
      { phone: '+919000000001', name: 'A. Menon', converted: false },
    ]);
    expect(result.rows).toHaveLength(0);
    expect(result.note).toContain('BR-01 holds');
  });

  it('ignores leads with no phone on file', () => {
    const result = buildDuplicateSuspects([
      { phone: '', name: 'One', converted: false },
      { phone: '', name: 'Two', converted: false },
    ]);
    expect(result.rows).toHaveLength(0);
  });
});

describe('buildPlacementFunnel', () => {
  it('renders the three BR-09 stages in order', () => {
    const result = buildPlacementFunnel({ evaluated: 20, eligible: 8, placed: 3 });
    expect(result.rows.map((r) => r.count)).toEqual([20, 8, 3]);
  });
});

describe('buildGrowthPartnerRewards (Doc 25 §13/§15)', () => {
  it('groups rewards by partner, splitting accrued from paid', () => {
    const result = buildGrowthPartnerRewards([
      { partnerId: 'p1', partnerName: 'Asha', amountPaise: 50_000, status: 'accrued' },
      { partnerId: 'p1', partnerName: 'Asha', amountPaise: 100_000, status: 'paid' },
      { partnerId: 'p2', partnerName: 'Ravi', amountPaise: 25_000, status: 'accrued' },
    ]);

    const asha = result.rows.find((r) => r.partnerName === 'Asha');
    const ravi = result.rows.find((r) => r.partnerName === 'Ravi');
    expect(asha).toMatchObject({ rewardCount: 2, accruedRupees: 500, paidRupees: 1_000 });
    expect(ravi).toMatchObject({ rewardCount: 1, accruedRupees: 250, paidRupees: 0 });
  });

  it('ranks the highest-earning partner first', () => {
    const result = buildGrowthPartnerRewards([
      { partnerId: 'p1', partnerName: 'Small', amountPaise: 10_000, status: 'paid' },
      { partnerId: 'p2', partnerName: 'Big', amountPaise: 500_000, status: 'paid' },
    ]);
    expect(result.rows[0]).toMatchObject({ partnerName: 'Big' });
  });

  it('handles an empty ledger', () => {
    const result = buildGrowthPartnerRewards([]);
    expect(result.rows).toHaveLength(0);
    expect(result.note).toContain('0 rewards');
  });
});
