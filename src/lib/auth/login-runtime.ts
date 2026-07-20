import 'server-only';

import { writeAudit } from '@/lib/audit/write';
import { IdentityToolkitVerifier } from '@/lib/auth/identity-toolkit';
import { createLoginProtection } from '@/lib/auth/login-protection';
import { FirestoreLoginSecurityStore } from '@/lib/auth/login-protection/firestore-store';
import type {
  LoginAuditWriter,
  LoginServiceDeps,
  SessionMinter,
  StaffDirectory,
  StaffProfile,
} from '@/lib/auth/login-service';
import { SESSION_DURATION_MS } from '@/lib/auth/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { systemClock } from '@/lib/utils/clock';
import { STAFF_ROLES, type StaffRole } from '@/types/common';

/**
 * Production wiring for the login service (ADR-013). Tests construct their
 * own deps; only the route handler imports this module.
 *
 * `guards` is the approved extension point: CAPTCHA, App Check verification,
 * and per-IP rate limiting slot in as `LoginGuard`s without touching the flow.
 */

const sessions: SessionMinter = {
  async mint(idToken) {
    const value = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    return { value, maxAgeMs: SESSION_DURATION_MS };
  },
};

const staff: StaffDirectory = {
  async getProfile(uid): Promise<StaffProfile | null> {
    const snap = await adminDb().collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const role = snap.get('role') as unknown;
    const status = snap.get('status') as unknown;
    // A users doc without a valid staff role is not a provisioned account:
    // returning a role-less profile would mint a session cookie that
    // getSession() rejects, trapping the browser in a redirect loop.
    if (!STAFF_ROLES.includes(role as StaffRole)) return null;
    return {
      role: role as StaffRole,
      status: status === 'active' ? 'active' : 'disabled',
    };
  },
  async recordSuccessfulLogin(uid, atMs) {
    await adminDb()
      .collection('users')
      .doc(uid)
      .update({ lastLoginAt: new Date(atMs), updatedAt: new Date(atMs) });
  },
};

const audit: LoginAuditWriter = {
  async loginSucceeded(entry) {
    await writeAudit({
      actorUid: entry.uid,
      actorRole: entry.role ?? 'system',
      action: 'login',
      entityType: 'session',
      entityId: entry.uid,
      entityPath: `users/${entry.uid}`,
      context: { feature: 'auth' },
    });
  },
};

let cached: LoginServiceDeps | null = null;

export function loginServiceDeps(): LoginServiceDeps {
  cached ??= {
    protection: createLoginProtection({
      store: new FirestoreLoginSecurityStore(adminDb(), systemClock),
      clock: systemClock,
    }),
    verifier: new IdentityToolkitVerifier(),
    sessions,
    staff,
    audit,
    guards: [],
  };
  return cached;
}
