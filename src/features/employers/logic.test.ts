import { describe, expect, it } from 'vitest';

import { archiveWarning, employerStatusLabel, formatContactSummary } from './logic';

describe('employerStatusLabel', () => {
  it('maps statuses to display labels', () => {
    expect(employerStatusLabel('active')).toBe('Active');
    expect(employerStatusLabel('archived')).toBe('Archived');
  });
});

describe('formatContactSummary', () => {
  it('joins the set fields', () => {
    expect(formatContactSummary({ name: 'Jane', phone: '123', email: 'a@b.com' })).toBe(
      'Jane · 123 · a@b.com',
    );
  });

  it('skips unset fields', () => {
    expect(formatContactSummary({ name: 'Jane', phone: null, email: null })).toBe('Jane');
  });

  it('falls back to an em dash when nothing is set', () => {
    expect(formatContactSummary({ name: null, phone: null, email: null })).toBe('—');
  });
});

describe('archiveWarning', () => {
  it('is null with no placements on record', () => {
    expect(archiveWarning({ placementCount: 0 })).toBeNull();
  });

  it('warns with a singular placement', () => {
    expect(archiveWarning({ placementCount: 1 })).toBe('This employer has 1 placement on record.');
  });

  it('warns with a plural count', () => {
    expect(archiveWarning({ placementCount: 3 })).toBe('This employer has 3 placements on record.');
  });
});
