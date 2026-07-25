import 'server-only';

import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { SCHEMA_VERSIONS } from '@/types/schema-versions';

import type { ResetRequestThrottleStore } from './reset-request-throttle';

/**
 * Firestore persistence for the reset-request cooldown (Doc 10 §1
 * extension). Server-only: `passwordResetRequests` carries the same
 * deny-all rule as `loginSecurity` (Doc 18).
 */
const PASSWORD_RESET_REQUESTS = 'passwordResetRequests';

export class FirestoreResetRequestThrottleStore implements ResetRequestThrottleStore {
  constructor(private readonly db: Firestore) {}

  async read(emailHash: string): Promise<{ lastRequestedAt: number } | null> {
    const snap = await this.db.collection(PASSWORD_RESET_REQUESTS).doc(emailHash).get();
    const lastRequestedAt = snap.get('lastRequestedAt');
    return lastRequestedAt instanceof Timestamp
      ? { lastRequestedAt: lastRequestedAt.toMillis() }
      : null;
  }

  async recordRequest(emailHash: string, atMs: number): Promise<void> {
    const now = Timestamp.fromMillis(atMs);
    await this.db.collection(PASSWORD_RESET_REQUESTS).doc(emailHash).set({
      emailHash,
      lastRequestedAt: now,
      schemaVersion: SCHEMA_VERSIONS.passwordResetRequests,
      updatedAt: now,
    });
  }
}
