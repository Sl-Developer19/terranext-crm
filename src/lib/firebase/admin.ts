import 'server-only';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

import { env } from '@/lib/env';

/**
 * Admin SDK singleton — the privileged tier (ADR-008).
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS file path locally,
 * Application Default Credentials on App Hosting. The key file must live
 * outside the repository (Doc 10 §5).
 *
 * Import policy (Doc 02 §5): this module may only be imported by
 * server actions, route handlers, and lib/auth — `server-only` makes a
 * client-bundle import a build error.
 */

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0 && existing[0]) return existing[0];

  const projectId = env().NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (keyPath) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8')) as Record<string, string>;
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }
  // Deployed environments: ADC via the runtime service account
  return initializeApp({ projectId });
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}
