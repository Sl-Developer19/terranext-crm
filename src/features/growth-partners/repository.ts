import 'server-only';

import { FieldValue, type Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { formatGrowthPartnerId } from './logic';

/**
 * Human Partner ID (TGP-000001) + QR scan tracking for individual Growth
 * Partners — hand-copied from `community-partners/repository.ts`'s
 * equivalent section, same Rule-of-Three reasoning as `logic.ts`/`schema.ts`.
 * This file didn't exist before (growth-partners' Firestore writes were
 * previously inline in each action) — it now holds only the two pieces new
 * to this feature; the existing inline writes in the action files are left
 * as they were.
 */

const COUNTER_ID = 'growthPartnerId';
/** Absolute last-resort fallback only — reached if `settings/idFormats` is
 * ever unreadable. The real default comes from `getIdFormats().growthPartnerPrefix`,
 * passed in by the caller (see `reserveGrowthPartnerId`'s doc comment). */
const DEFAULT_ID_PREFIX = 'TGP';

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Reserves the next Human Partner ID inside a transaction — identical
 * mechanics to `community-partners/repository.ts`'s `reserveCommunityPartnerId`
 * (see that function's comment for the concurrency/retry reasoning, which
 * applies unchanged here). MUST only be called from the `approve` branch of
 * `decideGrowthPartner`, inside the same transaction that flips status to
 * `active` — never at registration, never on reject.
 *
 * `configuredPrefix` is `settings/idFormats.growthPartnerPrefix`, read by the
 * caller outside the transaction — used only the very first time this
 * counter is reserved; once persisted on the counter document, later calls
 * reuse that value regardless of later Settings changes.
 */
export async function reserveGrowthPartnerId(
  tx: Transaction,
  configuredPrefix: string,
): Promise<string> {
  const ref = adminDb().collection('counters').doc(COUNTER_ID);
  const snap = await tx.get(ref);

  const prefix =
    (snap.exists ? asStringOrNull(snap.get('prefix')) : null) ??
    configuredPrefix ??
    DEFAULT_ID_PREFIX;
  const current = snap.exists ? asNumber(snap.get('current')) : 0;
  const next = current + 1;

  tx.set(ref, { current: next, prefix }, { merge: true });
  return formatGrowthPartnerId(prefix, next);
}

/**
 * Best-effort scan counter for the `/r/{humanPartnerId}` redirect — identical
 * semantics to `community-partners/repository.ts`'s `recordCommunityPartnerScan`
 * (soft top-of-funnel metric, silent no-op on an unknown code).
 */
export async function recordGrowthPartnerScan(humanPartnerId: string): Promise<void> {
  const snap = await adminDb()
    .collection('growthPartners')
    .where('humanPartnerId', '==', humanPartnerId)
    .where('deletedAt', '==', null)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return;
  await doc.ref.update({ scanCount: FieldValue.increment(1) });
}
