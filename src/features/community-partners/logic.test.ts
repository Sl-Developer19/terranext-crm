import { describe, expect, it } from 'vitest';

import { buildReferralUrl, canDecide, canToggleStatus, formatCommunityPartnerId } from './logic';

describe('canDecide', () => {
  it('allows a decision only while pending approval', () => {
    expect(canDecide('pending_approval')).toBe(true);
    expect(canDecide('active')).toBe(false);
    expect(canDecide('suspended')).toBe(false);
    expect(canDecide('rejected')).toBe(false);
  });
});

describe('canToggleStatus', () => {
  it('allows suspend/reactivate only for already-decided partners', () => {
    expect(canToggleStatus('active')).toBe(true);
    expect(canToggleStatus('suspended')).toBe(true);
    expect(canToggleStatus('pending_approval')).toBe(false);
    expect(canToggleStatus('rejected')).toBe(false);
  });
});

describe('formatCommunityPartnerId', () => {
  it('pads the sequence to 6 digits with the given prefix', () => {
    expect(formatCommunityPartnerId('TCGN', 1)).toBe('TCGN-000001');
    expect(formatCommunityPartnerId('TCGN', 42)).toBe('TCGN-000042');
    expect(formatCommunityPartnerId('TCGN', 999_999)).toBe('TCGN-999999');
  });

  it('does not truncate a sequence that outgrows the padding width', () => {
    expect(formatCommunityPartnerId('TCGN', 1_000_000)).toBe('TCGN-1000000');
  });

  it('is a pure function of its inputs — same arguments, same output', () => {
    expect(formatCommunityPartnerId('TCGN', 7)).toBe(formatCommunityPartnerId('TCGN', 7));
  });
});

describe('buildReferralUrl', () => {
  it('points at the CRM redirect endpoint, never the website directly', () => {
    expect(buildReferralUrl('https://crm.terranextglobal.com', 'TCGN-000001')).toBe(
      'https://crm.terranextglobal.com/r/TCGN-000001',
    );
  });

  it('strips a trailing slash from the origin', () => {
    expect(buildReferralUrl('https://crm.terranextglobal.com/', 'TCGN-000001')).toBe(
      'https://crm.terranextglobal.com/r/TCGN-000001',
    );
  });

  it('never exposes anything but the human partner ID', () => {
    const url = buildReferralUrl('https://crm.terranextglobal.com', 'TCGN-000042');
    expect(url).not.toContain('firestore');
    expect(url.endsWith('/r/TCGN-000042')).toBe(true);
  });

  it('URL-encodes the code segment', () => {
    expect(buildReferralUrl('https://crm.example.com', 'TCGN 000001')).toBe(
      'https://crm.example.com/r/TCGN%20000001',
    );
  });
});
