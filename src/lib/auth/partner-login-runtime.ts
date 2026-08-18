import 'server-only';

import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

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
import {
  PARTNER_AUDIT_ENTITY_TYPE,
  PARTNER_COLLECTIONS,
  PARTNER_FEATURE_NAME,
  type PartnerCollection,
} from '@/lib/auth/partner-directory';
import { PARTNER_SESSION_DURATION_MS } from '@/lib/auth/partner-session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { systemClock } from '@/lib/utils/clock';

/**
 * Production wiring for Partner login (Doc 25, ADR-014; extended for TCGN) —
 * reuses `performLogin` verbatim (same password verification, same
 * brute-force lockout ledger, same generic orchestration as staff login);
 * only the directory/session/audit collaborators differ, per the
 * `LoginServiceDeps` seam `login-service.ts` was already built with.
 * `StaffProfile.role` is always `null` here (a partner is never a
 * `StaffRole`) — the real actor type is recorded by the audit writer below,
 * not by this field.
 *
 * A single Firebase Auth `uid` belongs to at most one partner collection
 * (minted once, at that partner's approval — Doc 25 §2, TCGN Feature 3), so
 * trying each collection in `PARTNER_COLLECTIONS` order is always
 * unambiguous, and adding a future partner programme only means adding it to
 * that one list (`partner-directory.ts`) — nothing here changes.
 */

interface ResolvedPartnerDoc {
  collection: PartnerCollection;
  doc: QueryDocumentSnapshot;
}

async function findPartnerDocByAuthUid(uid: string): Promise<ResolvedPartnerDoc | null> {
  const db = adminDb();
  for (const collection of PARTNER_COLLECTIONS) {
    const snap = await db
      .collection(collection)
      .where('authUid', '==', uid)
      .where('deletedAt', '==', null)
      .limit(1)
      .get();
    const doc = snap.docs[0];
    if (doc) return { collection, doc };
  }
  return null;
}

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
    const found = await findPartnerDocByAuthUid(uid);
    if (!found) return null;
    // Only an `active` identity doc logs in — `pending_approval`, `suspended`,
    // and `rejected` all fall into the same `disabled` bucket, which
    // `performLogin` turns into the same generic "invalid credentials"
    // response as a wrong password (enumeration resistance, ADR-013 A3):
    // an attacker must not be able to tell "wrong password" apart from
    // "this email has a pending/suspended/rejected application" apart from
    // "no account at all".
    const status = found.doc.get('status');
    return { role: null, status: status === 'active' ? 'active' : 'disabled' };
  },
  async recordSuccessfulLogin(uid, atMs) {
    const found = await findPartnerDocByAuthUid(uid);
    if (!found) return;
    await found.doc.ref.update({ lastLoginAt: new Date(atMs) });
  },
};

const audit: LoginAuditWriter = {
  async loginSucceeded(entry) {
    // Partner collections are keyed by their own generated id, not the Auth
    // uid — one small indexed lookup so the audit entry points at the real
    // doc path, regardless of which partner programme this account belongs to.
    const found = await findPartnerDocByAuthUid(entry.uid);
    const partnerId = found?.doc.id ?? entry.uid;
    const collection = found?.collection ?? 'growthPartners';
    await writeAudit({
      actorUid: entry.uid,
      actorRole: 'growth_partner',
      action: 'login',
      entityType: PARTNER_AUDIT_ENTITY_TYPE[collection],
      entityId: partnerId,
      entityPath: `${collection}/${partnerId}`,
      context: { feature: PARTNER_FEATURE_NAME[collection] },
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
