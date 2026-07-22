import { describe, expect, it } from 'vitest';

import {
  conversionPct,
  filterColleges,
  sortByContribution,
  statusLabel,
  statusTone,
} from './logic';
import type { College } from './schema';

function college(overrides: Partial<College> = {}): College {
  return {
    id: 'c1',
    name: 'St Xavier College',
    city: 'Kochi',
    contactPerson: 'Dr Rao',
    contactPhone: null,
    status: 'active',
    leadCount: 10,
    admittedCount: 3,
    leaderCount: 1,
    ...overrides,
  };
}

describe('conversionPct', () => {
  it('computes the referral conversion rate', () => {
    expect(conversionPct({ leadCount: 10, admittedCount: 3 })).toBe(30);
  });

  it('returns null when the college has sent no leads', () => {
    expect(conversionPct({ leadCount: 0, admittedCount: 0 })).toBeNull();
  });
});

describe('filterColleges', () => {
  const colleges = [
    college({ id: 'a', name: 'St Xavier College', city: 'Kochi' }),
    college({ id: 'b', name: 'Government College', city: 'Thrissur', status: 'archived' }),
  ];

  it('returns everything with no filter', () => {
    expect(filterColleges(colleges, {})).toHaveLength(2);
  });

  it('filters by status', () => {
    expect(filterColleges(colleges, { status: 'archived' }).map((c) => c.id)).toEqual(['b']);
  });

  it('searches name and city case-insensitively', () => {
    expect(filterColleges(colleges, { search: 'thrissur' }).map((c) => c.id)).toEqual(['b']);
    expect(filterColleges(colleges, { search: 'xavier' }).map((c) => c.id)).toEqual(['a']);
  });

  it('searches the contact person too', () => {
    expect(filterColleges(colleges, { search: 'rao' })).toHaveLength(2);
  });
});

describe('sortByContribution', () => {
  it('ranks the biggest lead source first', () => {
    const rows = sortByContribution([
      college({ id: 'small', leadCount: 2 }),
      college({ id: 'big', leadCount: 20 }),
    ]);
    expect(rows.map((c) => c.id)).toEqual(['big', 'small']);
  });

  it('breaks ties alphabetically', () => {
    const rows = sortByContribution([
      college({ id: 'z', name: 'Zeta', leadCount: 5 }),
      college({ id: 'a', name: 'Alpha', leadCount: 5 }),
    ]);
    expect(rows.map((c) => c.id)).toEqual(['a', 'z']);
  });
});

describe('status helpers', () => {
  it('maps status to palette and label', () => {
    expect(statusTone('active')).toBe('success');
    expect(statusTone('archived')).toBe('neutral');
    expect(statusLabel('active')).toBe('Active');
    expect(statusLabel('archived')).toBe('Archived');
  });
});
