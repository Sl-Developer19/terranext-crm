import type { LoginAttempt, LoginSecurityState, SecurityEvent } from '@/types/auth-security';

/**
 * Persistence contract for login protection (ADR-013). The production
 * implementation (./firestore-store.ts) backs onto the server-only
 * `loginSecurity`, `loginAttempts`, and `securityEvents` collections;
 * tests use the in-memory implementation below.
 */
export interface LoginSecurityStore {
  read(emailHash: string): Promise<LoginSecurityState | null>;
  /**
   * Atomically read-modify-write one `loginSecurity` doc. `mutate` must be a
   * pure function of `current` — the Firestore implementation runs it inside
   * a transaction and may invoke it more than once on contention.
   */
  transact<R>(
    emailHash: string,
    mutate: (current: LoginSecurityState | null) => { next: LoginSecurityState; result: R },
  ): Promise<R>;
  appendAttempt(attempt: LoginAttempt): Promise<void>;
  appendSecurityEvent(event: SecurityEvent): Promise<void>;
}

/** Deterministic store for unit tests and local tooling. */
export class InMemoryLoginSecurityStore implements LoginSecurityStore {
  readonly states = new Map<string, LoginSecurityState>();
  readonly attempts: LoginAttempt[] = [];
  readonly securityEvents: SecurityEvent[] = [];

  read(emailHash: string): Promise<LoginSecurityState | null> {
    return Promise.resolve(this.states.get(emailHash) ?? null);
  }

  transact<R>(
    emailHash: string,
    mutate: (current: LoginSecurityState | null) => { next: LoginSecurityState; result: R },
  ): Promise<R> {
    const { next, result } = mutate(this.states.get(emailHash) ?? null);
    this.states.set(emailHash, next);
    return Promise.resolve(result);
  }

  appendAttempt(attempt: LoginAttempt): Promise<void> {
    this.attempts.push(attempt);
    return Promise.resolve();
  }

  appendSecurityEvent(event: SecurityEvent): Promise<void> {
    this.securityEvents.push(event);
    return Promise.resolve();
  }
}
