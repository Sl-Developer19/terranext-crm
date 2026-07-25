import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';

import { env } from '@/lib/env';

/**
 * Unverified JWT payload decode (base64url, no signature check) — used only
 * for the emulator branch below, where there is no real signature to check
 * against. Hand-rolled rather than `jose`'s `decodeJwt` so this file doesn't
 * add a second, avoidable reason to pull in `jose`'s JWE/compression path.
 *
 * Doesn't fully silence it, though: `decodeProtectedHeader`/`importX509`/
 * `jwtVerify` below are load-bearing for the real RS256 verification path
 * and route through the same `jose` webapi barrel, which still drags in
 * `CompressionStream`/`DecompressionStream` (unsupported on the Edge
 * runtime) regardless of which named export triggers it. That surfaces as a
 * build-time warning, not a runtime failure — none of the affected JWE code
 * ever executes on this path — and is a `jose`-packaging characteristic,
 * not something fixable from this file without dropping RS256 verification
 * entirely.
 */
function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Edge-runtime session-cookie check for middleware (Doc 05 §4 layer 1).
 *
 * firebase-admin cannot run on the Edge runtime, so the middleware verifies
 * the Firebase session cookie JWT directly: RS256 signature against Google's
 * published session-cookie certificates, issuer/audience pinned to the
 * project. This is a fast *routing* gate — revocation checking and role
 * loading happen server-side in getSession() (defense in depth, Doc 04 §4);
 * a revoked-but-unexpired cookie passes here and is rejected there.
 *
 * The Auth emulator does not sign session cookies against Google's real
 * production keys, so this fast path skips signature verification when
 * `NEXT_PUBLIC_USE_EMULATORS` is set — which, per `src/lib/firebase/client.ts`,
 * is never true in production. getSession()'s Admin SDK verification (which
 * is itself emulator-aware) remains the authoritative check either way.
 */

const SESSION_CERT_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;

async function getCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() < certCache.expiresAt) return certCache.certs;

  const res = await fetch(SESSION_CERT_URL);
  if (!res.ok) throw new Error(`Certificate fetch failed: ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;

  const cacheControl = res.headers.get('cache-control') ?? '';
  const maxAge = /max-age=(\d+)/.exec(cacheControl)?.[1];
  const ttlMs = maxAge ? Number(maxAge) * 1000 : 60 * 60 * 1000;
  certCache = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

export interface EdgeSession {
  uid: string;
  role: string | null;
}

export async function verifySessionCookieOnEdge(
  sessionCookie: string,
  projectId: string,
): Promise<EdgeSession | null> {
  try {
    if (env().NEXT_PUBLIC_USE_EMULATORS) {
      const payload = decodeJwtPayloadUnsafe(sessionCookie);
      if (!payload || typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
      return {
        uid: payload.sub,
        role: typeof payload.role === 'string' ? payload.role : null,
      };
    }

    const { kid } = decodeProtectedHeader(sessionCookie);
    if (!kid) return null;

    const certs = await getCerts();
    const pem = certs[kid];
    if (!pem) return null;

    const key = await importX509(pem, 'RS256');
    const { payload } = await jwtVerify(sessionCookie, key, {
      issuer: `https://session.firebase.google.com/${projectId}`,
      audience: projectId,
    });

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
    return {
      uid: payload.sub,
      role: typeof payload.role === 'string' ? payload.role : null,
    };
  } catch {
    return null;
  }
}
