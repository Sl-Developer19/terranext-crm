import 'server-only';

import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type { Academy, CatalogueStatus, Installment, Programme, ProgrammeOption } from './schema';

/** Catalogue data access (Doc 03 §1.2). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toInstallments(value: unknown): Installment[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    return {
      label: asString(entry.label),
      amountPaise: asNumber(entry.amountPaise),
      dueOffsetDays: asNumber(entry.dueOffsetDays),
    };
  });
}

function toProgramme(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  academyName: string | null,
): Programme {
  const data = doc.data() ?? {};
  const rules = (data.certificateRules ?? {}) as Record<string, unknown>;
  const plan = (data.feePlanDefault ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    academyId: asString(data.academyId),
    academyName,
    name: asString(data.name),
    code: asString(data.code),
    durationDays: asNumber(data.durationDays),
    sessionCount: asNumber(data.sessionCount),
    eligibility: asStringOrNull(data.eligibility),
    curriculumSummary: asStringOrNull(data.curriculumSummary),
    certificateRules: {
      minAttendancePct: asNumber(rules.minAttendancePct),
      minAssessmentScore: asNumber(rules.minAssessmentScore),
    },
    feePlanDefault: {
      totalPaise: asNumber(plan.totalPaise),
      installments: toInstallments(plan.installments),
    },
    status: (data.status as CatalogueStatus) ?? 'active',
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function findAcademies(): Promise<Academy[]> {
  const db = adminDb();
  const [academies, programmes] = await Promise.all([
    db.collection('academies').orderBy('name').get(),
    db.collection('programmes').get(),
  ]);

  const counts = new Map<string, number>();
  for (const doc of programmes.docs) {
    const academyId = asString(doc.get('academyId'));
    counts.set(academyId, (counts.get(academyId) ?? 0) + 1);
  }

  return academies.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: asString(data.name),
      slug: asString(data.slug),
      description: asStringOrNull(data.description),
      status: (data.status as CatalogueStatus) ?? 'active',
      programmeCount: counts.get(doc.id) ?? 0,
    };
  });
}

export async function findProgrammes(): Promise<Programme[]> {
  const db = adminDb();
  const [programmes, academies] = await Promise.all([
    db.collection('programmes').orderBy('name').get(),
    db.collection('academies').get(),
  ]);

  const academyNames = new Map<string, string>();
  for (const doc of academies.docs) academyNames.set(doc.id, asString(doc.get('name')));

  return programmes.docs.map((doc) =>
    toProgramme(doc, academyNames.get(asString(doc.get('academyId'))) ?? null),
  );
}

/** Active programmes only — the picklist other features consume. */
export async function findProgrammeOptions(): Promise<ProgrammeOption[]> {
  const db = adminDb();
  const [programmes, academies] = await Promise.all([
    db.collection('programmes').where('status', '==', 'active').orderBy('name').get(),
    db.collection('academies').get(),
  ]);

  const academyNames = new Map<string, string>();
  for (const doc of academies.docs) academyNames.set(doc.id, asString(doc.get('name')));

  return programmes.docs.map((doc) => {
    const academyId = asString(doc.get('academyId'));
    return {
      id: doc.id,
      name: asString(doc.get('name')),
      code: asString(doc.get('code')),
      academyId,
      academyName: academyNames.get(academyId) ?? '',
    };
  });
}

export async function findProgrammeById(programmeId: string): Promise<Programme | null> {
  const snap = await adminDb().collection('programmes').doc(programmeId).get();
  if (!snap.exists) return null;
  const academyId = asString(snap.get('academyId'));
  const academy = await adminDb().collection('academies').doc(academyId).get();
  return toProgramme(snap, academy.exists ? asString(academy.get('name')) : null);
}

export async function findAcademyById(academyId: string): Promise<Academy | null> {
  const snap = await adminDb().collection('academies').doc(academyId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const programmes = await adminDb()
    .collection('programmes')
    .where('academyId', '==', academyId)
    .get();
  return {
    id: snap.id,
    name: asString(data.name),
    slug: asString(data.slug),
    description: asStringOrNull(data.description),
    status: (data.status as CatalogueStatus) ?? 'active',
    programmeCount: programmes.size,
  };
}

export async function isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const snap = await adminDb().collection('academies').where('slug', '==', slug).limit(2).get();
  return snap.docs.some((doc) => doc.id !== exceptId);
}

export async function isProgrammeCodeTaken(code: string, exceptId?: string): Promise<boolean> {
  const snap = await adminDb().collection('programmes').where('code', '==', code).limit(2).get();
  return snap.docs.some((doc) => doc.id !== exceptId);
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface AcademyWriteModel {
  name: string;
  slug: string;
  description?: string | undefined;
}

export async function createAcademyRecord(
  input: AcademyWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('academies').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    status: 'active',
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
    deletedAt: null,
    deletedBy: null,
  });
  return ref.id;
}

export async function updateAcademyRecord(
  academyId: string,
  input: AcademyWriteModel,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('academies')
    .doc(academyId)
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
}

export interface ProgrammeWriteModel {
  academyId: string;
  name: string;
  code: string;
  durationDays: number;
  sessionCount: number;
  eligibility?: string | undefined;
  curriculumSummary?: string | undefined;
  minAttendancePct: number;
  minAssessmentScore: number;
  totalFeePaise: number;
  installments: Installment[];
}

function programmeFields(input: ProgrammeWriteModel) {
  return {
    academyId: input.academyId,
    name: input.name,
    code: input.code,
    durationDays: input.durationDays,
    sessionCount: input.sessionCount,
    eligibility: input.eligibility ?? null,
    curriculumSummary: input.curriculumSummary ?? null,
    // BR-03 gate, per programme — the reason certificate eligibility is
    // configuration rather than a constant in code.
    certificateRules: {
      minAttendancePct: input.minAttendancePct,
      minAssessmentScore: input.minAssessmentScore,
    },
    feePlanDefault: {
      totalPaise: input.totalFeePaise,
      installments: input.installments,
    },
  };
}

export async function createProgrammeRecord(
  input: ProgrammeWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('programmes').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    ...programmeFields(input),
    status: 'active',
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
    deletedAt: null,
    deletedBy: null,
  });
  return ref.id;
}

export async function updateProgrammeRecord(
  programmeId: string,
  input: ProgrammeWriteModel,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('programmes')
    .doc(programmeId)
    .update({ ...programmeFields(input), updatedAt: new Date(), updatedBy: actorUid });
}

export async function setCatalogueStatusRecord(
  collection: 'academies' | 'programmes',
  id: string,
  status: CatalogueStatus,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection(collection)
    .doc(id)
    .update({ status, updatedAt: new Date(), updatedBy: actorUid });
}
