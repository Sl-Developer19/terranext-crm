import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

/**
 * Identity normalization for the login-security ledger (ADR-013).
 * `loginSecurity` docs are keyed by SHA-256 of the normalized email so the
 * ledger holds no plain addresses and unknown emails get identical treatment.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email), 'utf8').digest('hex');
}

/** Sentinel used when no client address can be determined. */
export const UNKNOWN_IP = 'unknown';

/**
 * Normalizes a client IP to a canonical string (approved amendment 2):
 * - IPv4 returned as-is once validated (`203.0.113.7`)
 * - IPv4-mapped IPv6 unwrapped to the IPv4 form (`::ffff:203.0.113.7` → `203.0.113.7`)
 * - IPv6 canonicalized per RFC 5952 (lowercase, zero-run compressed)
 * - brackets and port suffixes from proxy headers stripped
 * Returns null when the input is not a valid address.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (value === '') return null;

  // "[2001:db8::1]:443" → "2001:db8::1"
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value)?.[1];
  if (bracketed !== undefined) {
    value = bracketed;
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    // "203.0.113.7:443" → "203.0.113.7"
    value = value.slice(0, value.lastIndexOf(':'));
  }

  const kind = isIP(value);
  if (kind === 4) return value;
  if (kind !== 6) return null;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value)?.[1];
  if (mapped !== undefined && isIP(mapped) === 4) return mapped;

  return canonicalizeIpv6(value);
}

/** RFC 5952 canonical form: expanded, zero-stripped, longest zero run → "::". */
function canonicalizeIpv6(address: string): string {
  let head = address.toLowerCase();
  let tail = '';

  // Embedded IPv4 (e.g. "64:ff9b::192.0.2.1") → convert last 32 bits to hex groups.
  const v4 = /^(.*):(\d{1,3}(?:\.\d{1,3}){3})$/.exec(head);
  if (v4 && v4[1] !== undefined && v4[2] !== undefined) {
    const [a = 0, b = 0, c = 0, d = 0] = v4[2].split('.').map(Number);
    const hex = [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)].join(':');
    head = `${v4[1]}:${hex}`;
  }

  if (head.includes('::')) {
    [head = '', tail = ''] = head.split('::');
  }
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === '' ? [] : tail.split(':');
  const missing = 8 - headGroups.length - tailGroups.length;
  const groups = [
    ...headGroups,
    ...Array.from({ length: address.includes('::') ? missing : 0 }, () => '0'),
    ...tailGroups,
  ].map((g) => g.replace(/^0+(?=.)/, ''));

  // Longest run of zero groups (length ≥ 2, leftmost wins) becomes "::".
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < groups.length;) {
    if (groups[i] !== '0') {
      i += 1;
      continue;
    }
    let j = i;
    while (j < groups.length && groups[j] === '0') j += 1;
    if (j - i > bestLen) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }

  if (bestLen < 2) return groups.join(':');
  const before = groups.slice(0, bestStart).join(':');
  const after = groups.slice(bestStart + bestLen).join(':');
  return `${before}::${after}`;
}

/**
 * Extracts the client IP from proxy headers (first `x-forwarded-for` hop).
 * Trustworthy only behind our own hosting proxy (Doc 10 §5 caveat).
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const firstHop = forwarded?.split(',')[0];
  return normalizeIp(firstHop) ?? normalizeIp(headers.get('x-real-ip')) ?? UNKNOWN_IP;
}
