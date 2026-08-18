import 'server-only';

import { FieldValue, type Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { formatCommunityPartnerId } from './logic';
import type { BusinessCategory } from './schema';

/**
 * Shared write path for Community Partner registration (TCGN) — used by both
 * the staff-entry action and the public registration action, so the three
 * duplicate checks and the create are written once, not twice (unlike
 * `growth-partners`, whose staff and public registration actions each
 * duplicate their own inline email check).
 */

export type CommunityPartnerDuplicateField = 'email' | 'phone' | 'orgName';

export interface CommunityPartnerWriteModel {
  orgName: string;
  businessCategory: BusinessCategory;
  contactName: string;
  email: string;
  phone: string;
  applicationNotes: string | null;
}

export interface CreateCommunityPartnerOutcome {
  id: string;
  /** Which field collided, if any — the create was not performed when set. */
  duplicate: CommunityPartnerDuplicateField | null;
}

/**
 * Creates a pending-approval Community Partner record inside a single
 * Firestore transaction: the email/phone/business-name duplicate checks and
 * the create happen atomically, so two concurrent submissions for the same
 * business can never both pass the dedupe check and land as two records —
 * a race the equivalent growth-partners registration actions do not close
 * (their check-then-write is two separate calls).
 */
export async function createCommunityPartnerRecord(
  input: CommunityPartnerWriteModel,
  actorUid: string,
): Promise<CreateCommunityPartnerOutcome> {
  const db = adminDb();
  const ref = db.collection('communityPartners').doc();

  const duplicate = await db.runTransaction(async (tx) => {
    const [emailSnap, phoneSnap, orgNameSnap] = await Promise.all([
      tx.get(
        db
          .collection('communityPartners')
          .where('email', '==', input.email)
          .where('deletedAt', '==', null)
          .limit(1),
      ),
      tx.get(
        db
          .collection('communityPartners')
          .where('phone', '==', input.phone)
          .where('deletedAt', '==', null)
          .limit(1),
      ),
      tx.get(
        db
          .collection('communityPartners')
          .where('orgName', '==', input.orgName)
          .where('deletedAt', '==', null)
          .limit(1),
      ),
    ]);

    if (!emailSnap.empty) return 'email' as const;
    if (!phoneSnap.empty) return 'phone' as const;
    if (!orgNameSnap.empty) return 'orgName' as const;

    const now = new Date();
    tx.set(ref, {
      schemaVersion: 1,
      humanPartnerId: null,
      orgName: input.orgName,
      businessCategory: input.businessCategory,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      applicationNotes: input.applicationNotes,
      status: 'pending_approval',
      authUid: null,
      scanCount: 0,
      referralCount: 0,
      approvedAt: null,
      approvedBy: null,
      createdAt: now,
      createdBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
      deletedAt: null,
      deletedBy: null,
    });
    return null;
  });

  return { id: ref.id, duplicate };
}

/* ── Human Partner ID (TCGN-000001) ───────────────────────────────────────
 * Mirrors `participants/repository.ts`'s `reserveParticipantId` exactly:
 * a `counters/{name}` document, read-modify-write inside a caller-supplied
 * transaction. No `year` field (unlike participant IDs) — the Community
 * Partner sequence is a flat, non-year-scoped counter per the required
 * "TCGN-000001, TCGN-000002, …" format. Firestore rules already deny all
 * client access to every `counters/*` document (`firestore.rules` — Admin
 * SDK only), so no rules change was needed for this counter either.
 */

const COUNTER_ID = 'communityPartnerId';
/** Absolute last-resort fallback only — reached if `settings/idFormats` is
 * ever unreadable. The real default comes from `getIdFormats().communityPartnerPrefix`,
 * passed in by the caller (see `reserveCommunityPartnerId`'s doc comment). */
const DEFAULT_ID_PREFIX = 'TCGN';

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Reserves the next Human Partner ID inside a transaction. The counter is
 * the concurrency guarantee: two admins approving different pending
 * partners at the same instant cannot mint the same ID, because the
 * read-modify-write is transactional — Firestore's automatic
 * optimistic-concurrency retry (the same mechanism `reserveParticipantId`
 * and `issueCertificate` already rely on) re-runs the whole callback if
 * another transaction committed a conflicting write to this same counter
 * document first, so no bespoke retry loop is written here.
 *
 * MUST only be called from the `approve` branch of `decideCommunityPartner`,
 * inside the same transaction that flips status to `active` — never at
 * registration, never on reject, so a rejected application or a lost
 * approval race never consumes a sequence number (business rule: IDs are
 * immutable and permanent, so none may ever be skipped by a decision that
 * didn't actually happen).
 *
 * `configuredPrefix` is `settings/idFormats.communityPartnerPrefix`, read by
 * the caller (a plain, non-transactional read — Settings is slow-changing
 * config, not something that needs snapshot consistency with the counter).
 * It's used only the very first time this counter is ever reserved: once a
 * prefix is persisted on the counter document, every later call reuses that
 * persisted value regardless of what Settings says later — changing the
 * Settings field never retroactively alters already-issued IDs' prefix.
 */
export async function reserveCommunityPartnerId(
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
  return formatCommunityPartnerId(prefix, next);
}

/* ── QR scan tracking ──────────────────────────────────────────────────── */

/**
 * Best-effort scan counter for the `/r/{humanPartnerId}` redirect (QR
 * Referral System, Feature 6) — a single atomic `FieldValue.increment` write,
 * not a `runTransaction`: this is a soft, top-of-funnel visibility metric
 * (a scan is not a business event on its own, unlike a referral count, which
 * *does* need to move with the lead that earned it — see
 * `createPublicLead`). An unknown or deleted code is silently a no-op —
 * exactly like an invalid QR, this must never surface an error to the
 * visitor being redirected.
 */
export async function recordCommunityPartnerScan(humanPartnerId: string): Promise<void> {
  const snap = await adminDb()
    .collection('communityPartners')
    .where('humanPartnerId', '==', humanPartnerId)
    .where('deletedAt', '==', null)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return;
  await doc.ref.update({ scanCount: FieldValue.increment(1) });
}
