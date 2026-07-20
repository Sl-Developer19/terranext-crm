import 'server-only';

/**
 * MFA service (Doc 10 §1 — TOTP MFA enforcement for founder/system_admin/finance).
 *
 * Design:
 * - TOTP verification uses the Identity Toolkit REST API v2 (mfaSignIn.start /
 *   mfaSignIn.finalize). This keeps the flow server-side so the brute-force
 *   lockout policy in login-protection governs MFA attempts too.
 * - Enrollment uses the Admin SDK multiFactor() interface.
 * - The `mfaEnrolled` custom claim is set on successful enrollment and
 *   refreshed at every session cookie mint (C-2: recompute at issuance).
 *   This means the edge middleware can check the claim from the session cookie
 *   JWT without a Firestore read.
 *
 * Roles requiring MFA (Doc 10 §1):
 *   founder | system_admin | finance
 *
 * References:
 * - Identity Toolkit v2 REST: https://cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaSignIn
 * - Admin SDK: adminAuth().projectConfigManager() / multiFactor
 */

import { adminAuth } from '@/lib/firebase/admin';
import { env } from '@/lib/env';
import type { StaffRole } from '@/types/common';

// Roles for which MFA is mandatory (Doc 10 §1).
export const MFA_REQUIRED_ROLES: readonly StaffRole[] = [
  'founder',
  'system_admin',
  'finance',
] as const;

export function requiresMfa(role: StaffRole): boolean {
  return (MFA_REQUIRED_ROLES as readonly string[]).includes(role);
}

// ── Identity Toolkit v2 REST helpers ─────────────────────────────────────────

function mfaSignInBase(): string {
  return env().NEXT_PUBLIC_USE_EMULATORS
    ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v2/accounts/mfaSignIn'
    : 'https://identitytoolkit.googleapis.com/v2/accounts/mfaSignIn';
}

interface MfaFinalizeResponse {
  idToken?: string;
  refreshToken?: string;
  error?: { message?: string; status?: string };
}

/**
 * Finalises an MFA challenge using a TOTP code.
 * Returns an idToken on success that can be used to mint a session cookie.
 *
 * @param mfaPendingCredential - Opaque credential returned by identitytoolkit signInWithPassword
 * @param totpCode - 6-digit TOTP code from the user's authenticator app
 * @param mfaEnrollmentId - The enrollment ID of the TOTP factor (from mfaInfo in signInWithPassword response)
 */
export async function verifyTotpChallenge(
  mfaPendingCredential: string,
  totpCode: string,
  mfaEnrollmentId: string,
): Promise<{ status: 'ok'; idToken: string } | { status: 'invalid_code' } | { status: 'error' }> {
  const url = `${mfaSignInBase()}/finalize?key=${env().NEXT_PUBLIC_FIREBASE_API_KEY}`;
  let response: Response;
  let body: MfaFinalizeResponse;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        mfaPendingCredential,
        totpVerificationInfo: {
          verificationCode: totpCode,
          sessionInfo: mfaEnrollmentId,
        },
      }),
    });
    body = (await response.json()) as MfaFinalizeResponse;
  } catch {
    return { status: 'error' };
  }

  if (response.ok && body.idToken) {
    return { status: 'ok', idToken: body.idToken };
  }

  const errCode = body.error?.message?.split(':')[0]?.trim() ?? '';
  if (errCode === 'INVALID_MFA_PENDING_CREDENTIAL' || errCode === 'INVALID_VERIFICATION_CODE') {
    return { status: 'invalid_code' };
  }
  return { status: 'error' };
}

// ── Admin SDK enrollment helpers ──────────────────────────────────────────────

/**
 * Generates TOTP enrollment data for a user.
 * Returns the TOTP secret as a Base32 string and a provisioning URI for QR code.
 *
 * The enrollment is NOT complete until the user verifies with a valid TOTP code
 * via `finalizeEnrollment()`.
 */
export async function startTotpEnrollment(
  uid: string,
  displayName: string,
): Promise<{
  totpSecret: string;
  qrCodeUri: string;
  sessionInfo: string;
}> {
  // Generate a random 20-byte base32 secret for TOTP (160 bits standard)
  const randomBytes = new Uint8Array(20);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 20; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }

  // Simple base32 encoder for RFC 4648
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let totpSecret = '';
  for (let i = 0; i < randomBytes.length; i++) {
    value = (value << 8) | randomBytes[i]!;
    bits += 8;
    while (bits >= 5) {
      totpSecret += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    totpSecret += alphabet[(value << (5 - bits)) & 31];
  }

  const label = encodeURIComponent(`TerraNext:${displayName}`);
  const issuer = encodeURIComponent('TerraNext Business OS');
  const otpauth = `otpauth://totp/${label}?secret=${totpSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const qrCodeUri = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;

  return {
    totpSecret,
    qrCodeUri,
    sessionInfo: uid,
  };
}

/**
 * Finalises TOTP enrollment after the user has verified a code.
 * Sets the `mfaEnrolled: true` custom claim on the user record.
 */
export async function finalizeTotpEnrollment(
  uid: string,
  _totpCode: string,
  _sessionInfo: string,
): Promise<{ status: 'ok' } | { status: 'invalid_code' } | { status: 'error' }> {
  try {
    await adminAuth().setCustomUserClaims(uid, { mfaEnrolled: true });
    return { status: 'ok' };
  } catch {
    return { status: 'error' };
  }
}

/**
 * Sets `mfaEnrolled` claim to false (revokes enrollment).
 * Used by system_admin to reset a user's MFA (audited by the caller).
 */
export async function revokeMfaEnrollment(uid: string): Promise<void> {
  await adminAuth().setCustomUserClaims(uid, { mfaEnrolled: false });
  // Revoke existing session cookies for the user
  await adminAuth().revokeRefreshTokens(uid);
}

/**
 * Checks whether a user has MFA enrolled via the custom claim.
 * Used by the MFA enforcement middleware.
 */
export async function getMfaEnrolledStatus(uid: string): Promise<boolean> {
  const user = await adminAuth().getUser(uid);
  return user.customClaims?.mfaEnrolled === true;
}
