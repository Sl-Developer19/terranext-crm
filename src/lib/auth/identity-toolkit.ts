import 'server-only';

import { env } from '@/lib/env';

import type { CredentialVerdict, CredentialVerifier } from './login-service';

/**
 * Password verification against the Identity Toolkit REST API (ADR-013:
 * the password stage runs server-side so lockout policy governs every
 * attempt). Uses the public web API key — not a secret (Doc 10 §5).
 */

const SIGN_IN_PATH = '/v1/accounts:signInWithPassword';

/** Emulator-first local development (Doc 22 M1) — same API surface. */
function signInEndpoint(): string {
  const base = env().NEXT_PUBLIC_USE_EMULATORS
    ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com'
    : 'https://identitytoolkit.googleapis.com';
  return `${base}${SIGN_IN_PATH}`;
}

/** REST error codes that mean "credentials do not match an active account". */
const INVALID_CREDENTIAL_CODES = new Set([
  'EMAIL_NOT_FOUND',
  'INVALID_PASSWORD',
  'INVALID_LOGIN_CREDENTIALS',
  'INVALID_EMAIL',
  'MISSING_PASSWORD',
]);

interface SignInResponseBody {
  localId?: string;
  idToken?: string;
  mfaPendingCredential?: string;
  error?: { message?: string };
}

export class IdentityToolkitVerifier implements CredentialVerifier {
  async verifyPassword(email: string, password: string): Promise<CredentialVerdict> {
    let response: Response;
    let body: SignInResponseBody;
    try {
      response = await fetch(`${signInEndpoint()}?key=${env().NEXT_PUBLIC_FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      body = (await response.json()) as SignInResponseBody;
    } catch (error) {
      console.error('Identity Toolkit sign-in request failed', error);
      return { status: 'provider_error' };
    }

    if (response.ok) {
      if (body.idToken && body.localId) {
        return { status: 'ok', uid: body.localId, idToken: body.idToken };
      }
      if (body.mfaPendingCredential) {
        return { status: 'mfa_required' };
      }
      return { status: 'provider_error' };
    }

    // REST errors arrive as "CODE" or "CODE : human text".
    const code = body.error?.message?.split(':')[0]?.trim() ?? '';
    if (INVALID_CREDENTIAL_CODES.has(code)) return { status: 'invalid_credentials' };
    if (code === 'USER_DISABLED') return { status: 'disabled' };
    // Includes TOO_MANY_ATTEMPTS_TRY_LATER (Firebase's own upstream throttle,
    // kept enabled as defense in depth) and quota/transport failures.
    return { status: 'provider_error' };
  }
}
