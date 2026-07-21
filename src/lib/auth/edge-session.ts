import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';

/**
 * Edge-runtime session-cookie check for middleware (Doc 05 §4 layer 1).
 *
 * firebase-admin cannot run on the Edge runtime, so the middleware verifies
 * the Firebase session cookie JWT directly: RS256 signature against Google's
 * published session-cookie certificates, issuer/audience pinned to the
 * project. This is a fast *routing* gate — revocation checking and role
 * loading happen server-side in getSession() (defense in depth, Doc 04 §4);
 * a revoked-but-unexpired cookie passes here and is rejected there.
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
