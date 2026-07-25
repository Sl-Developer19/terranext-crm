import 'server-only';

import { adminDb } from '@/lib/firebase/admin';

import type { Employer, EmployerOption, EmployerStatus } from './schema';

/** Employer data access (Doc 03 §1.6, Doc 14 §15). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toEmployer(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot,
  placementCount: number,
): Employer {
  const data = doc.data() ?? {};
  const contact = (data.contact ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    name: asString(data.name),
    country: asString(data.country),
    industry: asStringOrNull(data.industry),
    contact: {
      name: asStringOrNull(contact.name),
      phone: asStringOrNull(contact.phone),
      email: asStringOrNull(contact.email),
    },
    agreementNote: asStringOrNull(data.agreementNote),
    status: (data.status as EmployerStatus) ?? 'active',
    placementCount,
  };
}

/** Bounded — same document-scan cap convention as reports/certificates (Doc 14). */
const PLACEMENTS_SCAN_CAP = 2000;

/** Placement counts per employer — the placements collection may not have any docs yet. */
async function placementCounts(): Promise<Map<string, number>> {
  const snap = await adminDb().collection('placements').limit(PLACEMENTS_SCAN_CAP).get();
  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const employerId = asString(doc.get('employerId'));
    counts.set(employerId, (counts.get(employerId) ?? 0) + 1);
  }
  return counts;
}

export async function findEmployers(): Promise<Employer[]> {
  const [snap, counts] = await Promise.all([
    adminDb().collection('employers').orderBy('name').limit(500).get(),
    placementCounts(),
  ]);
  return snap.docs.map((doc) => toEmployer(doc, counts.get(doc.id) ?? 0));
}

export async function findEmployerOptions(): Promise<EmployerOption[]> {
  const snap = await adminDb()
    .collection('employers')
    .where('status', '==', 'active')
    .orderBy('name')
    .get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    name: asString(doc.get('name')),
    country: asString(doc.get('country')),
  }));
}

export async function findEmployerById(employerId: string): Promise<Employer | null> {
  const snap = await adminDb().collection('employers').doc(employerId).get();
  if (!snap.exists) return null;
  // A single employer's count is a scoped aggregate, not a full-collection scan.
  const countSnap = await adminDb()
    .collection('placements')
    .where('employerId', '==', employerId)
    .count()
    .get();
  return toEmployer(snap, countSnap.data().count);
}

export async function isEmployerNameTaken(name: string, exceptId?: string): Promise<boolean> {
  const snap = await adminDb().collection('employers').where('name', '==', name).limit(2).get();
  return snap.docs.some((doc) => doc.id !== exceptId);
}

export interface EmployerWriteModel {
  name: string;
  country: string;
  industry?: string | undefined;
  contactName?: string | undefined;
  contactPhone?: string | undefined;
  contactEmail?: string | undefined;
  agreementNote?: string | undefined;
}

function employerFields(input: EmployerWriteModel) {
  return {
    name: input.name,
    country: input.country,
    industry: input.industry ?? null,
    contact: {
      name: input.contactName ?? null,
      phone: input.contactPhone ?? null,
      email: input.contactEmail ?? null,
    },
    agreementNote: input.agreementNote ?? null,
  };
}

export async function createEmployerRecord(
  input: EmployerWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('employers').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    ...employerFields(input),
    status: 'active',
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return ref.id;
}

export async function updateEmployerRecord(
  employerId: string,
  input: EmployerWriteModel,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('employers')
    .doc(employerId)
    .update({ ...employerFields(input), updatedAt: new Date(), updatedBy: actorUid });
}

export async function setEmployerStatusRecord(
  employerId: string,
  status: EmployerStatus,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('employers')
    .doc(employerId)
    .update({ status, updatedAt: new Date(), updatedBy: actorUid });
}
