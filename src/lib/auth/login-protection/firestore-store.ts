import 'server-only';

import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import type { Clock } from '@/lib/utils/clock';
import type { LoginAttempt, LoginSecurityState, SecurityEvent } from '@/types/auth-security';
import { SCHEMA_VERSIONS } from '@/types/schema-versions';

import type { LoginSecurityStore } from './store';

/**
 * Firestore persistence for login protection (ADR-013). All three collections
 * are server-only: the Admin SDK bypasses rules and the rules file carries
 * explicit deny-all blocks for them (Doc 18).
 */

const LOGIN_SECURITY = 'loginSecurity';
const LOGIN_ATTEMPTS = 'loginAttempts';
const SECURITY_EVENTS = 'securityEvents';

function tsOrNull(ms: number | null): Timestamp | null {
  return ms === null ? null : Timestamp.fromMillis(ms);
}

function msOrNull(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function toState(emailHash: string, data: FirebaseFirestore.DocumentData): LoginSecurityState {
  return {
    emailHash,
    failedAttempts: typeof data.failedAttempts === 'number' ? data.failedAttempts : 0,
    lastFailedAt: msOrNull(data.lastFailedAt),
    lockedUntil: msOrNull(data.lockedUntil),
    lastSuccessfulLogin: msOrNull(data.lastSuccessfulLogin),
    lastLoginIp: typeof data.lastLoginIp === 'string' ? data.lastLoginIp : null,
    lastUserAgent: typeof data.lastUserAgent === 'string' ? data.lastUserAgent : null,
  };
}

export class FirestoreLoginSecurityStore implements LoginSecurityStore {
  constructor(
    private readonly db: Firestore,
    private readonly clock: Clock,
  ) {}

  private securityRef(emailHash: string) {
    return this.db.collection(LOGIN_SECURITY).doc(emailHash);
  }

  async read(emailHash: string): Promise<LoginSecurityState | null> {
    const snap = await this.securityRef(emailHash).get();
    const data = snap.data();
    return data === undefined ? null : toState(emailHash, data);
  }

  async transact<R>(
    emailHash: string,
    mutate: (current: LoginSecurityState | null) => { next: LoginSecurityState; result: R },
  ): Promise<R> {
    const ref = this.securityRef(emailHash);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      const current = data === undefined ? null : toState(emailHash, data);
      const { next, result } = mutate(current);
      const now = Timestamp.fromMillis(this.clock.now());
      tx.set(ref, {
        emailHash: next.emailHash,
        failedAttempts: next.failedAttempts,
        lastFailedAt: tsOrNull(next.lastFailedAt),
        lockedUntil: tsOrNull(next.lockedUntil),
        lastSuccessfulLogin: tsOrNull(next.lastSuccessfulLogin),
        lastLoginIp: next.lastLoginIp,
        lastUserAgent: next.lastUserAgent,
        schemaVersion: SCHEMA_VERSIONS.loginSecurity,
        createdAt: data?.createdAt instanceof Timestamp ? data.createdAt : now,
        updatedAt: now,
      });
      return result;
    });
  }

  async appendAttempt(attempt: LoginAttempt): Promise<void> {
    const now = Timestamp.fromMillis(this.clock.now());
    await this.db.collection(LOGIN_ATTEMPTS).add({
      at: Timestamp.fromMillis(attempt.at),
      email: attempt.email,
      emailHash: attempt.emailHash,
      success: attempt.success,
      ip: attempt.ip,
      userAgent: attempt.userAgent,
      reason: attempt.reason,
      schemaVersion: SCHEMA_VERSIONS.loginAttempts,
      createdAt: now,
    });
  }

  async appendSecurityEvent(event: SecurityEvent): Promise<void> {
    const now = Timestamp.fromMillis(this.clock.now());
    await this.db.collection(SECURITY_EVENTS).add({
      at: Timestamp.fromMillis(event.at),
      type: event.type,
      severity: event.severity,
      emailHash: event.emailHash,
      ip: event.ip,
      userAgent: event.userAgent,
      details: event.details,
      schemaVersion: SCHEMA_VERSIONS.securityEvents,
      createdAt: now,
    });
  }
}
