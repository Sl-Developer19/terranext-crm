import 'server-only';

import { writeAudit } from '@/lib/audit/write';
import { hashEmail } from '@/lib/auth/identity';
import { IdentityToolkitPasswordResetConfirmer } from '@/lib/auth/identity-toolkit';
import { loginServiceDeps } from '@/lib/auth/login-runtime';
import type {
  ResetPasswordAuditWriter,
  ResetPasswordDeps,
  SessionRevoker,
  StaffLookup,
} from '@/lib/auth/reset-password-service';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { STAFF_ROLES, type StaffRole } from '@/types/common';

/** Production wiring for password-reset confirmation (Doc 10 §1 extension). */

const staff: StaffLookup = {
  async findByEmail(email) {
    let uid: string;
    try {
      uid = (await adminAuth().getUserByEmail(email)).uid;
    } catch {
      return null;
    }
    const snap = await adminDb().collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const role = snap.get('role') as unknown;
    return { uid, role: STAFF_ROLES.includes(role as StaffRole) ? (role as StaffRole) : null };
  },
};

const sessions: SessionRevoker = {
  async revokeAll(uid) {
    await adminAuth().revokeRefreshTokens(uid);
  },
};

const audit: ResetPasswordAuditWriter = {
  async passwordResetCompleted(entry) {
    await writeAudit({
      actorUid: entry.uid,
      actorRole: entry.role ?? 'system',
      action: 'update',
      entityType: 'user',
      entityId: entry.uid,
      entityPath: `users/${entry.uid}`,
      context: { feature: 'auth', reason: 'Self-service password reset' },
    });
  },
};

let cached: ResetPasswordDeps | null = null;

export function resetPasswordServiceDeps(): ResetPasswordDeps {
  cached ??= {
    confirmer: new IdentityToolkitPasswordResetConfirmer(),
    staff,
    sessions,
    audit,
    // `securityEvents` is a single shared ledger — reuse the write path the
    // login-protection store already owns instead of a second one.
    createSecurityEvent: (event) => loginServiceDeps().protection.createSecurityEvent(event),
    hashEmail,
  };
  return cached;
}
