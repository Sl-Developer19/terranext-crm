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
import { PARTNER_SESSION_DURATION_MS } from '@/lib/auth/partner-session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { systemClock } from '@/lib/utils/clock';

/**
 * Production wiring for Growth Partner login (Doc 25, ADR-014) — reuses
 * `performLogin` verbatim (same password verification, same brute-force
 * lockout ledger, same generic orchestration as staff login); only the
 * directory/session/audit collaborators differ, per the `LoginServiceDeps`
 * seam `login-service.ts` was already built with. `StaffProfile.role` is
 * always `null` here (a partner is never a `StaffRole`) — the real actor
 * type is recorded by the audit writer below, not by this field.
 */

const sessions: SessionMinter = {
  async mint(idToken) {
    const value = await adminAuth().createSessionCookie(idToken, {
      expiresIn: PARTNER_SESSION_DURATION_MS,
    });
    return { value, maxAgeMs: PARTNER_SESSION_DURATION_MS };
  },
};

const partnerDirectory: StaffDirectory = {
  async getProfile(uid): Promise<StaffProfile | null> {
    const snap = await adminDb()
      .collection('growthPartners')
      .where('authUid', '==', uid)
      .where('deletedAt', '==', null)
      .limit(1)
      .get();
    const doc = snap.docs[0];
    if (!doc) return null;
    const status = doc.get('status');
    return { role: null, status: status === 'active' ? 'active' : 'disabled' };
  },
  async recordSuccessfulLogin(uid, atMs) {
    const snap = await adminDb()
      .collection('growthPartners')
      .where('authUid', '==', uid)
      .limit(1)
      .get();
    const doc = snap.docs[0];
    if (!doc) return;
    await doc.ref.update({ lastLoginAt: new Date(atMs) });
  },
};

const audit: LoginAuditWriter = {
  async loginSucceeded(entry) {
    // growthPartners is keyed by its own generated id, not the Auth uid — one
    // small indexed lookup so the audit entry points at the real doc path.
    const snap = await adminDb()
      .collection('growthPartners')
      .where('authUid', '==', entry.uid)
      .limit(1)
      .get();
    const partnerId = snap.docs[0]?.id ?? entry.uid;
    await writeAudit({
      actorUid: entry.uid,
      actorRole: 'growth_partner',
      action: 'login',
      entityType: 'growth_partner',
      entityId: partnerId,
      entityPath: `growthPartners/${partnerId}`,
      context: { feature: 'growth-partners' },
    });
  },
};

let cached: LoginServiceDeps | null = null;

export function partnerLoginServiceDeps(): LoginServiceDeps {
  cached ??= {
    protection: createLoginProtection({
      store: new FirestoreLoginSecurityStore(adminDb(), systemClock),
      clock: systemClock,
    }),
    verifier: new IdentityToolkitVerifier(),
    sessions,
    staff: partnerDirectory,
    audit,
    guards: [],
  };
  return cached;
}
