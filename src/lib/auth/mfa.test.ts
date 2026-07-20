import { describe, expect, it } from 'vitest';

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:123456:web:123';
process.env.MFA_TOKEN_SECRET = 'test-secret-at-least-32-characters-long!';

import { requiresMfa } from './mfa-service';
import { signMfaPendingToken, verifyMfaPendingToken } from './mfa-token';

describe('requiresMfa', () => {
  it('returns true for high-privilege roles', () => {
    expect(requiresMfa('founder')).toBe(true);
    expect(requiresMfa('system_admin')).toBe(true);
    expect(requiresMfa('finance')).toBe(true);
  });

  it('returns false for standard operational roles', () => {
    expect(requiresMfa('consultant')).toBe(false);
    expect(requiresMfa('coordinator')).toBe(false);
    expect(requiresMfa('trainer')).toBe(false);
    expect(requiresMfa('ops_manager')).toBe(false);
    expect(requiresMfa('placement')).toBe(false);
  });
});

describe('MFA Pending Token JWT', () => {
  it('signs and verifies valid MFA pending tokens', async () => {
    const payload = {
      mfaPendingCredential: 'credential_12345',
      mfaEnrollmentId: 'enrollment_67890',
    };

    const token = await signMfaPendingToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const decoded = await verifyMfaPendingToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.mfaPendingCredential).toBe(payload.mfaPendingCredential);
    expect(decoded?.mfaEnrollmentId).toBe(payload.mfaEnrollmentId);
  });

  it('rejects tampered or malformed tokens', async () => {
    const validToken = await signMfaPendingToken({
      mfaPendingCredential: 'cred',
      mfaEnrollmentId: 'enroll',
    });

    const tampered = validToken.slice(0, -5) + 'abcde';
    const decoded = await verifyMfaPendingToken(tampered);
    expect(decoded).toBeNull();

    const invalid = await verifyMfaPendingToken('not-a-token');
    expect(invalid).toBeNull();
  });
});
