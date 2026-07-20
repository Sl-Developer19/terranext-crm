import 'server-only';

import { writeAudit } from '@/lib/audit/write';
import { IdentityToolkitVerifier } from '@/lib/auth/identity-toolkit';
import { createLoginProtection } from '@/lib/auth/login-protection';
import { FirestoreLoginSecurityStore } from '@/lib/auth/login-protection/firestore-store';
import type { ReauthAuditWriter, ReauthServiceDeps } from '@/lib/auth/reauth-service';
import { adminDb } from '@/lib/firebase/admin';
import { systemClock } from '@/lib/utils/clock';

/** Production wiring for the idle-timeout re-auth service (M1-B). */

const audit: ReauthAuditWriter = {
  async reauthSucceeded(entry) {
    await writeAudit({
      actorUid: entry.uid,
      actorRole: entry.role,
      action: 'login',
      entityType: 'session',
      entityId: entry.uid,
      entityPath: `users/${entry.uid}`,
      context: { feature: 'auth', reason: 'idle_reauth' },
    });
  },
};

let cached: ReauthServiceDeps | null = null;

export function reauthServiceDeps(): ReauthServiceDeps {
  cached ??= {
    protection: createLoginProtection({
      store: new FirestoreLoginSecurityStore(adminDb(), systemClock),
      clock: systemClock,
    }),
    verifier: new IdentityToolkitVerifier(),
    audit,
  };
  return cached;
}
