import 'server-only';

/**
 * MFA pending credential token (Doc 10 §1 TOTP flow).
 *
 * When the password stage passes but MFA is required, the login route issues a
 * short-lived signed JWT containing the opaque mfaPendingCredential and the
 * mfaEnrollmentId. The client stores this token temporarily and posts it to
 * /api/auth/mfa/challenge together with the 6-digit TOTP code.
 *
 * The token is:
 * - Signed (not encrypted) with HS256 using MFA_TOKEN_SECRET
 * - Short-lived: 5 minutes (enough for the user to open their authenticator app)
 * - Single-use: the challenge route verifies and discards it (no server-side state)
 *
 * The mfaPendingCredential itself is an opaque blob that Firebase's Identity
 * Toolkit trusts — it carries its own internal expiry (typically a few minutes).
 */

import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

const ALG = 'HS256';
const TTL_SECONDS = 300; // 5 minutes

function secret(): Uint8Array {
  return new TextEncoder().encode(env().MFA_TOKEN_SECRET);
}

export interface MfaPendingPayload {
  mfaPendingCredential: string;
  mfaEnrollmentId: string;
}

/** Issues a signed JWT representing an in-progress MFA challenge. */
export async function signMfaPendingToken(payload: MfaPendingPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
}

/** Verifies and decodes an MFA pending token. Returns null if invalid or expired. */
export async function verifyMfaPendingToken(token: string): Promise<MfaPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (
      typeof payload.mfaPendingCredential === 'string' &&
      typeof payload.mfaEnrollmentId === 'string'
    ) {
      return {
        mfaPendingCredential: payload.mfaPendingCredential,
        mfaEnrollmentId: payload.mfaEnrollmentId,
      };
    }
    return null;
  } catch {
    return null;
  }
}
