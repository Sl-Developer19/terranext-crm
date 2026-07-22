import 'server-only';

import { adminDb } from '@/lib/firebase/admin';

import type { CampusLeader, College, CollegeStatus } from './schema';

/** College master data access (Doc 14 §10). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Lead attribution per college. Leads carry `sourceDetail.collegeId`, so the
 * counts come from one pass over leads rather than a query per college.
 */
async function leadStats(): Promise<Map<string, { leads: number; admitted: number }>> {
  const snap = await adminDb().collection('leads').limit(1000).get();
  const stats = new Map<string, { leads: number; admitted: number }>();

  for (const doc of snap.docs) {
    const detail = (doc.get('sourceDetail') ?? {}) as Record<string, unknown>;
    const collegeId = asString(detail.collegeId);
    if (!collegeId) continue;

    const entry = stats.get(collegeId) ?? { leads: 0, admitted: 0 };
    entry.leads += 1;
    if (asString(doc.get('stage')) === 'admitted') entry.admitted += 1;
    stats.set(collegeId, entry);
  }
  return stats;
}

async function leaderCounts(): Promise<Map<string, number>> {
  const snap = await adminDb().collectionGroup('campusLeaders').get();
  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const collegeId = doc.ref.parent.parent?.id;
    if (!collegeId) continue;
    counts.set(collegeId, (counts.get(collegeId) ?? 0) + 1);
  }
  return counts;
}

function toCollege(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot,
  stats: Map<string, { leads: number; admitted: number }>,
  leaders: Map<string, number>,
): College {
  const entry = stats.get(doc.id);
  return {
    id: doc.id,
    name: asString(doc.get('name')),
    city: asString(doc.get('city')),
    contactPerson: asStringOrNull(doc.get('contactPerson')),
    contactPhone: asStringOrNull(doc.get('contactPhone')),
    status: (asString(doc.get('status')) || 'active') as CollegeStatus,
    leadCount: entry?.leads ?? 0,
    admittedCount: entry?.admitted ?? 0,
    leaderCount: leaders.get(doc.id) ?? 0,
  };
}

export async function findColleges(): Promise<College[]> {
  const [snap, stats, leaders] = await Promise.all([
    adminDb().collection('colleges').orderBy('name').get(),
    leadStats(),
    leaderCounts(),
  ]);
  return snap.docs.map((doc) => toCollege(doc, stats, leaders));
}

export async function findCollegeById(collegeId: string): Promise<College | null> {
  const [doc, stats, leaders] = await Promise.all([
    adminDb().collection('colleges').doc(collegeId).get(),
    leadStats(),
    leaderCounts(),
  ]);
  if (!doc.exists) return null;
  return toCollege(doc, stats, leaders);
}

export async function findCampusLeaders(collegeId: string): Promise<CampusLeader[]> {
  const snap = await adminDb()
    .collection('colleges')
    .doc(collegeId)
    .collection('campusLeaders')
    .orderBy('name')
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    name: asString(doc.get('name')),
    phone: asString(doc.get('phone')),
    participantId: asStringOrNull(doc.get('participantId')),
    active: doc.get('active') !== false,
  }));
}

export async function isCollegeNameTaken(name: string, exceptId?: string): Promise<boolean> {
  const snap = await adminDb().collection('colleges').where('name', '==', name).limit(2).get();
  return snap.docs.some((doc) => doc.id !== exceptId);
}

export interface CollegeWriteModel {
  name: string;
  city: string;
  contactPerson?: string | undefined;
  contactPhone?: string | undefined;
}

function collegeFields(input: CollegeWriteModel) {
  return {
    name: input.name,
    city: input.city,
    contactPerson: input.contactPerson ?? null,
    contactPhone: input.contactPhone ?? null,
  };
}

export async function createCollegeRecord(
  input: CollegeWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('colleges').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    ...collegeFields(input),
    status: 'active',
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return ref.id;
}

export async function updateCollegeRecord(
  collegeId: string,
  input: CollegeWriteModel,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('colleges')
    .doc(collegeId)
    .update({ ...collegeFields(input), updatedAt: new Date(), updatedBy: actorUid });
}

export async function setCollegeStatusRecord(
  collegeId: string,
  status: CollegeStatus,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('colleges')
    .doc(collegeId)
    .update({ status, updatedAt: new Date(), updatedBy: actorUid });
}

export async function collegeExists(collegeId: string): Promise<boolean> {
  const doc = await adminDb().collection('colleges').doc(collegeId).get();
  return doc.exists;
}

export async function createCampusLeaderRecord(
  collegeId: string,
  input: { name: string; phone: string; participantId: string | null },
  actorUid: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('colleges').doc(collegeId).collection('campusLeaders').doc();

  await ref.set({
    schemaVersion: 1,
    name: input.name,
    phone: input.phone,
    participantId: input.participantId,
    active: true,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return ref.id;
}

export async function setLeaderActiveRecord(
  collegeId: string,
  leaderId: string,
  active: boolean,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('colleges')
    .doc(collegeId)
    .collection('campusLeaders')
    .doc(leaderId)
    .update({ active, updatedAt: new Date(), updatedBy: actorUid });
}
