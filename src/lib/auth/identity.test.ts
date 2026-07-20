import { describe, expect, it } from 'vitest';

import { clientIpFromHeaders, hashEmail, normalizeEmail, normalizeIp } from './identity';

describe('email normalization and hashing (ADR-013)', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeEmail('  Staff@TerraNext.IN ')).toBe('staff@terranext.in');
  });

  it('hashes to SHA-256 hex of the normalized address', () => {
    // sha256('staff@terranext.in') — stable ledger key across spellings
    expect(hashEmail('Staff@TerraNext.in')).toBe(hashEmail(' staff@terranext.in'));
    expect(hashEmail('staff@terranext.in')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEmail('a@b.c')).not.toBe(hashEmail('a@b.d'));
  });
});

describe('IP normalization (approved amendment 2)', () => {
  it('accepts plain IPv4 and strips port suffixes', () => {
    expect(normalizeIp('203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('203.0.113.7:52341')).toBe('203.0.113.7');
    expect(normalizeIp(' 203.0.113.7 ')).toBe('203.0.113.7');
  });

  it('unwraps IPv4-mapped IPv6 addresses', () => {
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('::FFFF:203.0.113.7')).toBe('203.0.113.7');
  });

  it('canonicalizes IPv6 per RFC 5952', () => {
    expect(normalizeIp('2001:0DB8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
    expect(normalizeIp('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1');
    expect(normalizeIp('[2001:db8::1]:443')).toBe('2001:db8::1');
    expect(normalizeIp('::1')).toBe('::1');
    expect(normalizeIp('fe80:0:0:0:0:0:0:0')).toBe('fe80::');
  });

  it('rejects garbage', () => {
    expect(normalizeIp('not-an-ip')).toBeNull();
    expect(normalizeIp('999.1.1.1')).toBeNull();
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });

  it('takes the first x-forwarded-for hop and falls back to unknown', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' });
    expect(clientIpFromHeaders(headers)).toBe('203.0.113.7');
    expect(clientIpFromHeaders(new Headers())).toBe('unknown');
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': 'garbage' }))).toBe('unknown');
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '::ffff:198.51.100.4' }))).toBe(
      '198.51.100.4',
    );
  });
});
