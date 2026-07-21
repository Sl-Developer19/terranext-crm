import { describe, expect, it } from 'vitest';

import {
  buildSearchTokens,
  documentStoragePath,
  formatParticipantId,
  isManuallyAssignableStatus,
  isTerminalStatus,
  normalizeSearchTerm,
  requiresStatusReason,
  statusAfterEnrolment,
} from './logic';

describe('buildSearchTokens (Doc 14 §11 server-maintained search index)', () => {
  it('indexes every name part independently, not just the first', () => {
    const tokens = buildSearchTokens('Priya Sharma', '+919876504821');
    expect(tokens).toContain('pri');
    expect(tokens).toContain('sha');
    expect(tokens).toContain('priya');
    expect(tokens).toContain('sharma');
  });

  it('does not emit single-character tokens (too noisy to index)', () => {
    const tokens = buildSearchTokens('Priya Sharma', '+919876504821');
    expect(tokens.every((t) => t.length >= 2)).toBe(true);
  });

  it('indexes phone SUFFIXES so shared country/operator prefixes do not match everyone', () => {
    const tokens = buildSearchTokens('Priya Sharma', '+919876504821');
    expect(tokens).toContain('4821');
    expect(tokens).toContain('504821');
    // The +91 country code must not become a token matching every Indian number.
    expect(tokens).not.toContain('9198');
  });

  it('ignores phones too short to disambiguate', () => {
    const tokens = buildSearchTokens('Ann', '+91');
    expect(tokens).toEqual(['an', 'ann']);
  });

  it('is case-insensitive', () => {
    expect(buildSearchTokens('PRIYA', '')).toEqual(buildSearchTokens('priya', ''));
  });
});

describe('normalizeSearchTerm', () => {
  it('lowercases and trims a name query', () => {
    expect(normalizeSearchTerm('  Pri ')).toBe('pri');
  });

  it('reduces a phone-shaped query to its digit suffix so it matches phone tokens', () => {
    expect(normalizeSearchTerm('+91 98765 04821')).toBe('9876504821');
    expect(normalizeSearchTerm('4821')).toBe('4821');
  });

  it('treats a name containing a couple of digits as a name, not a phone', () => {
    expect(normalizeSearchTerm('priya2')).toBe('priya2');
  });
});

describe('formatParticipantId (Doc 14 §3 counter, pattern TNX-YYYY-NNNNN)', () => {
  it('zero-pads the sequence to five digits', () => {
    expect(formatParticipantId('TNX', 2026, 42)).toBe('TNX-2026-00042');
  });

  it('does not truncate a sequence that has outgrown the padding', () => {
    expect(formatParticipantId('TNX', 2026, 123456)).toBe('TNX-2026-123456');
  });
});

describe('participant status rules', () => {
  it('refuses alumni as a manually assignable status (BR-05 trigger owns it)', () => {
    expect(isManuallyAssignableStatus('alumni')).toBe(false);
    expect(isManuallyAssignableStatus('active')).toBe(true);
    expect(isManuallyAssignableStatus('dropped')).toBe(true);
  });

  it('treats completed and dropped as terminal', () => {
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('dropped')).toBe(true);
    expect(isTerminalStatus('active')).toBe(false);
    expect(isTerminalStatus('enrolled')).toBe(false);
  });

  it('requires a reason when dropping a participant', () => {
    expect(requiresStatusReason('dropped')).toBe(true);
    expect(requiresStatusReason('completed')).toBe(false);
  });
});

describe('statusAfterEnrolment (BR-01/FR-03.3 re-enrolment)', () => {
  it('activates a newly enrolled participant', () => {
    expect(statusAfterEnrolment('enrolled')).toBe('active');
  });

  it('reactivates a completed or dropped participant on re-enrolment', () => {
    expect(statusAfterEnrolment('completed')).toBe('active');
    expect(statusAfterEnrolment('dropped')).toBe('active');
  });

  it('never strips alumni — it is earned by certification (BR-05), not current enrolment', () => {
    expect(statusAfterEnrolment('alumni')).toBeNull();
  });

  it('leaves an already-active participant untouched', () => {
    expect(statusAfterEnrolment('active')).toBeNull();
  });
});

describe('documentStoragePath (Doc 10 §4 bucket layout)', () => {
  it('couples the storage object to the metadata doc id', () => {
    expect(documentStoragePath('TNX-2026-00042', 'doc_7')).toBe(
      'participants/TNX-2026-00042/doc_7',
    );
  });
});
