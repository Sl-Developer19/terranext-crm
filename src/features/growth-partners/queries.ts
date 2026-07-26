import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot, DocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type { GrowthPartner } from './schema';

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toGrowthPartner(doc: QueryDocumentSnapshot | DocumentSnapshot): GrowthPartner {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    email: typeof data.email === 'string' ? data.email : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    organizationName: typeof data.organizationName === 'string' ? data.organizationName : null,
    status: data.status,
    leadershipLevel: data.leadershipLevel,
    authUid: typeof data.authUid === 'string' ? data.authUid : null,
    approvedAt: toIso(data.approvedAt),
    approvedBy: typeof data.approvedBy === 'string' ? data.approvedBy : null,
    createdAt: toIso(data.createdAt) ?? '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedAt: toIso(data.updatedAt) ?? '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  };
}

/** Directory read for /growth-partners (Doc 25 §6) — every role with
 * `growthPartners:view` sees every partner; there is no row-level scope here
 * (unlike leads/consultant) since staff oversight is org-wide by design. */
export async function listGrowthPartners(): Promise<GrowthPartner[]> {
  const snap = await adminDb()
    .collection('growthPartners')
    .where('deletedAt', '==', null)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(toGrowthPartner);
}

export async function getGrowthPartner(partnerId: string): Promise<GrowthPartner | null> {
  const snap = await adminDb().collection('growthPartners').doc(partnerId).get();
  if (!snap.exists || snap.get('deletedAt') !== null) return null;
  return toGrowthPartner(snap);
}
