import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot, DocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import type { AuditLogEntry } from '@/features/audit';
import type { AuditAction, AuditEntityType } from '@/lib/audit/types';

import type { CommunityPartner } from './schema';

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toCommunityPartner(doc: QueryDocumentSnapshot | DocumentSnapshot): CommunityPartner {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    humanPartnerId: typeof data.humanPartnerId === 'string' ? data.humanPartnerId : null,
    orgName: typeof data.orgName === 'string' ? data.orgName : '',
    businessCategory: data.businessCategory,
    contactName: typeof data.contactName === 'string' ? data.contactName : '',
    email: typeof data.email === 'string' ? data.email : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    applicationNotes: typeof data.applicationNotes === 'string' ? data.applicationNotes : null,
    status: data.status,
    authUid: typeof data.authUid === 'string' ? data.authUid : null,
    scanCount: toCount(data.scanCount),
    referralCount: toCount(data.referralCount),
    approvedAt: toIso(data.approvedAt),
    approvedBy: typeof data.approvedBy === 'string' ? data.approvedBy : null,
    emailSent: data.emailSent === true,
    emailSentAt: toIso(data.emailSentAt),
    emailStatus:
      data.emailStatus === 'sent' || data.emailStatus === 'failed' || data.emailStatus === 'skipped'
        ? data.emailStatus
        : null,
    emailError: typeof data.emailError === 'string' ? data.emailError : null,
    createdAt: toIso(data.createdAt) ?? '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedAt: toIso(data.updatedAt) ?? '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  };
}

/** Directory read for /community-partners — every role with `growthPartners:view`
 * sees every community partner; no row-level scope here (staff oversight is
 * org-wide by design, same as `growth-partners/queries.ts`). */
export async function listCommunityPartners(): Promise<CommunityPartner[]> {
  const snap = await adminDb()
    .collection('communityPartners')
    .where('deletedAt', '==', null)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(toCommunityPartner);
}

export async function getCommunityPartner(partnerId: string): Promise<CommunityPartner | null> {
  const snap = await adminDb().collection('communityPartners').doc(partnerId).get();
  if (!snap.exists || snap.get('deletedAt') !== null) return null;
  return toCommunityPartner(snap);
}

/** Resolves a print/QR-facing code ("TCGN-000001") to its live partner record.
 * Used by referral attribution and the QR redirect route — an unknown or
 * inactive code must resolve to `null`, never throw (BR-07: a bad referral
 * code never blocks the enquiry it's attached to). */
export async function findCommunityPartnerByHumanId(
  humanPartnerId: string,
): Promise<CommunityPartner | null> {
  const snap = await adminDb()
    .collection('communityPartners')
    .where('humanPartnerId', '==', humanPartnerId)
    .where('deletedAt', '==', null)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? toCommunityPartner(doc) : null;
}

/** Session-mint lookup (Community Partner Login feature) — resolves a
 * verified Firebase Auth uid to its community partner record. */
export async function findCommunityPartnerByAuthUid(
  authUid: string,
): Promise<CommunityPartner | null> {
  const snap = await adminDb()
    .collection('communityPartners')
    .where('authUid', '==', authUid)
    .where('deletedAt', '==', null)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? toCommunityPartner(doc) : null;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Status history / audit trail for one Community Partner — reuses the
 * immutable `auditLogs` collection (ADR-007) rather than a new
 * `statusHistory` collection: every approve/reject/suspend/reactivate
 * already writes a `status_change` entry there (see the two actions in
 * `actions/`). The `entityType ASC, entityId ASC, at DESC` composite index
 * this relies on already exists in `firestore.indexes.json` (Doc 03 §3) — no
 * new collection, no new index, no duplicate write path.
 */
export async function listCommunityPartnerStatusHistory(
  partnerId: string,
): Promise<AuditLogEntry[]> {
  const snap = await adminDb()
    .collection('auditLogs')
    .where('entityType', '==', 'community_partner')
    .where('entityId', '==', partnerId)
    .orderBy('at', 'desc')
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      at: toIso(d.at) ?? new Date(0).toISOString(),
      actorUid: safeString(d.actorUid),
      actorRole: safeString(d.actorRole),
      action: (d.action ?? 'create') as AuditAction,
      entityType: (d.entityType ?? 'community_partner') as AuditEntityType,
      entityId: safeString(d.entityId),
      entityPath: safeString(d.entityPath),
      changes:
        d.changes && typeof d.changes === 'object'
          ? (d.changes as Record<string, { before: unknown; after: unknown }>)
          : null,
      context: {
        feature: safeString(d.context?.feature),
        reason: typeof d.context?.reason === 'string' ? d.context.reason : null,
      },
    };
  });
}
