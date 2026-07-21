import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { buildFamilySearchTokens, highestConversionStatus } from './logic';
import type {
  Family,
  FamilyFilters,
  FamilyListItem,
  FamilyProgrammeHistoryRow,
  PaginatedFamilies,
  Parent,
  ParentConversionStatus,
  ParentSession,
} from './schema';

/** Parent/family data access (Doc 03 §8 Q3). Actions own permission + audit. */

export const FAMILY_PAGE_SIZE = 25;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toFamily(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  parentCount: number,
  sessionCount: number,
): Family {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    familyName: asString(data.familyName),
    primaryContactName: asString(data.primaryContactName),
    primaryContactPhone: asString(data.primaryContactPhone),
    primaryContactEmail: asStringOrNull(data.primaryContactEmail),
    relation: data.relation as Family['relation'],
    source: data.source as Family['source'],
    address: asStringOrNull(data.address),
    notes: asStringOrNull(data.notes),
    linkedParticipantIds: Array.isArray(data.linkedParticipantIds)
      ? (data.linkedParticipantIds as string[])
      : [],
    parentCount,
    sessionCount,
    createdAt: toIso(data.createdAt) ?? '',
    updatedAt: toIso(data.updatedAt) ?? '',
  };
}

async function resolveNames(uids: unknown[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids.filter((v): v is string => typeof v === 'string' && v !== ''))];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (uid) => {
      const snap = await adminDb().collection('users').doc(uid).get();
      const name = snap.get('displayName');
      map.set(uid, typeof name === 'string' ? name : 'Unknown');
    }),
  );
  return map;
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

/**
 * Paginated family directory.
 *
 * Offset pagination (fetch page*size, slice the tail) rather than cursors:
 * the directory is filter-and-jump, not infinite scroll, and a household
 * count in the low thousands keeps the over-fetch cheap. Cursor pagination
 * becomes worthwhile if this grows an order of magnitude.
 */
export async function findFamilies(filters: FamilyFilters): Promise<PaginatedFamilies> {
  const page = filters.page ?? 1;
  let query: Query = adminDb().collection('families').where('deletedAt', '==', null);

  if (filters.source) query = query.where('source', '==', filters.source);
  if (filters.conversionStatus) {
    query = query.where('conversionStatus', '==', filters.conversionStatus);
  }

  const term = filters.q?.trim().toLowerCase() ?? '';
  if (term.length >= 2) {
    const digits = term.replace(/\D/g, '');
    const token =
      digits.length >= 4 ? digits.slice(-Math.min(digits.length, 10)) : term.slice(0, 20);
    query = query.where('searchTokens', 'array-contains', token);
  }

  const [countSnap, pageSnap] = await Promise.all([
    query.count().get(),
    query
      .orderBy('familyName')
      .limit(page * FAMILY_PAGE_SIZE)
      .get(),
  ]);

  const total = countSnap.data().count;
  const rows = pageSnap.docs.slice((page - 1) * FAMILY_PAGE_SIZE).map((doc): FamilyListItem => {
    const data = doc.data();
    return {
      id: doc.id,
      familyName: asString(data.familyName),
      primaryContactName: asString(data.primaryContactName),
      primaryContactPhone: asString(data.primaryContactPhone),
      source: data.source as FamilyListItem['source'],
      linkedParticipantCount: Array.isArray(data.linkedParticipantIds)
        ? data.linkedParticipantIds.length
        : 0,
      conversionStatus: (data.conversionStatus as ParentConversionStatus) ?? 'not_converted',
      updatedAt: toIso(data.updatedAt) ?? '',
    };
  });

  return {
    rows,
    page,
    pageSize: FAMILY_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / FAMILY_PAGE_SIZE)),
  };
}

export async function findFamilyById(familyId: string): Promise<Family | null> {
  const ref = adminDb().collection('families').doc(familyId);
  const snap = await ref.get();
  if (!snap.exists || snap.get('deletedAt') !== null) return null;

  const [parents, sessions] = await Promise.all([
    ref.collection('parents').count().get(),
    ref.collection('sessions').count().get(),
  ]);

  return toFamily(snap, parents.data().count, sessions.data().count);
}

export async function findParents(familyId: string): Promise<Parent[]> {
  const snap = await adminDb()
    .collection('families')
    .doc(familyId)
    .collection('parents')
    .orderBy('name')
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: asString(data.name),
      phone: asString(data.phone),
      email: asStringOrNull(data.email),
      relation: data.relation as Parent['relation'],
      occupation: asStringOrNull(data.occupation),
      conversionStatus: (data.conversionStatus as ParentConversionStatus) ?? 'not_converted',
      leadId: asStringOrNull(data.leadId),
      participantId: asStringOrNull(data.participantId),
    };
  });
}

export async function findParentSessions(familyId: string): Promise<ParentSession[]> {
  const ref = adminDb().collection('families').doc(familyId);
  const [snap, parents] = await Promise.all([
    ref.collection('sessions').orderBy('heldAt', 'desc').get(),
    ref.collection('parents').get(),
  ]);

  const parentNames = new Map(parents.docs.map((d) => [d.id, asString(d.get('name'))]));
  const counsellorNames = await resolveNames(snap.docs.map((d) => d.get('counsellorUid')));

  return snap.docs.map((doc) => {
    const data = doc.data();
    const parentId = asString(data.parentId);
    const counsellorUid = asString(data.counsellorUid);
    return {
      id: doc.id,
      parentId,
      parentName: parentNames.get(parentId) ?? null,
      heldAt: asString(data.heldAt),
      mode: data.mode as ParentSession['mode'],
      notes: asString(data.notes),
      outcome: data.outcome as ParentSession['outcome'],
      recommendedProgrammeId: asStringOrNull(data.recommendedProgrammeId),
      nextFollowUpAt: asStringOrNull(data.nextFollowUpAt),
      counsellorUid,
      counsellorName: counsellorNames.get(counsellorUid) ?? null,
    };
  });
}

/**
 * Family Programme History — every enrolment across the household, whether
 * it belongs to a child or to a parent who enrolled themselves.
 *
 * This is the payoff of modelling the family as its own record: without it,
 * answering "what has this household done with us" means guessing from
 * matching surnames or phone numbers.
 */
export async function findFamilyProgrammeHistory(
  familyId: string,
): Promise<FamilyProgrammeHistoryRow[]> {
  const db = adminDb();
  const family = await db.collection('families').doc(familyId).get();
  if (!family.exists) return [];

  const linked = Array.isArray(family.get('linkedParticipantIds'))
    ? (family.get('linkedParticipantIds') as string[])
    : [];

  // Parents who enrolled themselves appear alongside the children.
  const parents = await db.collection('families').doc(familyId).collection('parents').get();
  const parentParticipantIds = parents.docs
    .map((d) => asStringOrNull(d.get('participantId')))
    .filter((id): id is string => id !== null);

  const memberKind = new Map<string, 'participant' | 'parent'>();
  for (const id of linked) memberKind.set(id, 'participant');
  for (const id of parentParticipantIds) memberKind.set(id, 'parent');

  const programmes = await db.collection('programmes').get();
  const programmeNames = new Map(programmes.docs.map((d) => [d.id, asString(d.get('name'))]));

  const rows = await Promise.all(
    [...memberKind.keys()].map(async (participantId) => {
      const participant = await db.collection('participants').doc(participantId).get();
      if (!participant.exists) return [];
      const personal = (participant.get('personal') ?? {}) as Record<string, unknown>;
      const enrolments = await participant.ref.collection('enrolments').get();

      return enrolments.docs.map((enrolment): FamilyProgrammeHistoryRow => {
        const programmeId = asString(enrolment.get('programmeId'));
        return {
          participantId,
          participantName: asString(personal.fullName),
          memberKind: memberKind.get(participantId) ?? 'participant',
          programmeId,
          programmeName: programmeNames.get(programmeId) ?? null,
          batchId: asStringOrNull(enrolment.get('batchId')),
          status: asString(enrolment.get('status')),
          enrolledAt: toIso(enrolment.get('enrolledAt')) ?? '',
          certificateId: asStringOrNull(enrolment.get('certificateId')),
        };
      });
    }),
  );

  return rows.flat().sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface FamilyWriteModel {
  familyName: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail?: string | undefined;
  relation: string;
  source: string;
  address?: string | undefined;
  notes?: string | undefined;
}

function familyFields(input: FamilyWriteModel) {
  return {
    familyName: input.familyName,
    primaryContactName: input.primaryContactName,
    primaryContactPhone: input.primaryContactPhone,
    primaryContactEmail: input.primaryContactEmail ?? null,
    relation: input.relation,
    source: input.source,
    address: input.address ?? null,
    notes: input.notes ?? null,
    searchTokens: buildFamilySearchTokens(
      input.familyName,
      input.primaryContactName,
      input.primaryContactPhone,
    ),
  };
}

export async function createFamilyRecord(
  input: FamilyWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const db = adminDb();
  const now = new Date();
  const ref = db.collection('families').doc();

  const batch = db.batch();
  batch.set(ref, {
    schemaVersion: 1,
    branchId,
    ...familyFields(input),
    linkedParticipantIds: [],
    conversionStatus: 'not_converted',
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
    deletedAt: null,
    deletedBy: null,
  });

  // The primary contact is a parent record from the outset — otherwise the
  // first counselling session has no one to attach to.
  batch.set(ref.collection('parents').doc(), {
    schemaVersion: 1,
    name: input.primaryContactName,
    phone: input.primaryContactPhone,
    email: input.primaryContactEmail ?? null,
    relation: input.relation,
    occupation: null,
    conversionStatus: 'not_converted',
    leadId: null,
    participantId: null,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });

  await batch.commit();
  return ref.id;
}

export async function updateFamilyRecord(
  familyId: string,
  input: FamilyWriteModel,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('families')
    .doc(familyId)
    .update({ ...familyFields(input), updatedAt: new Date(), updatedBy: actorUid });
}

export async function addParentRecord(
  familyId: string,
  input: {
    name: string;
    phone: string;
    email?: string | undefined;
    relation: string;
    occupation?: string | undefined;
  },
  actorUid: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('families').doc(familyId).collection('parents').doc();
  await ref.set({
    schemaVersion: 1,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    relation: input.relation,
    occupation: input.occupation ?? null,
    conversionStatus: 'not_converted',
    leadId: null,
    participantId: null,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return ref.id;
}

/** Links an existing participant to the household (BR-01: link, never copy). */
export async function linkParticipantRecord(
  familyId: string,
  participantId: string,
  actorUid: string,
): Promise<void> {
  const db = adminDb();
  const now = new Date();

  const batch = db.batch();
  batch.update(db.collection('families').doc(familyId), {
    linkedParticipantIds: FieldValue.arrayUnion(participantId),
    updatedAt: now,
    updatedBy: actorUid,
  });
  // Mirrors onto the participant so the reserved `family.familyRecordId`
  // field (Doc 03 §1.4) finally carries its intended value.
  batch.update(db.collection('participants').doc(participantId), {
    'family.familyRecordId': familyId,
    updatedAt: now,
    updatedBy: actorUid,
  });
  await batch.commit();
}

export async function logParentSessionRecord(
  familyId: string,
  input: {
    parentId: string;
    heldAt: string;
    mode: string;
    notes: string;
    outcome: string;
    recommendedProgrammeId: string | null;
    nextFollowUpAt: string | null;
  },
  actorUid: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('families').doc(familyId).collection('sessions').doc();
  await ref.set({
    schemaVersion: 1,
    parentId: input.parentId,
    heldAt: input.heldAt,
    mode: input.mode,
    notes: input.notes,
    outcome: input.outcome,
    recommendedProgrammeId: input.recommendedProgrammeId,
    nextFollowUpAt: input.nextFollowUpAt,
    counsellorUid: actorUid,
    createdAt: now,
    createdBy: actorUid,
  });
  return ref.id;
}

/**
 * Records that a parent has been converted into a lead, and rolls the
 * household's conversion status up to the furthest state any parent reached.
 */
export async function markParentConverted(
  familyId: string,
  parentId: string,
  leadId: string,
  actorUid: string,
): Promise<void> {
  const db = adminDb();
  const familyRef = db.collection('families').doc(familyId);
  const now = new Date();

  await familyRef.collection('parents').doc(parentId).update({
    conversionStatus: 'lead_created',
    leadId,
    updatedAt: now,
    updatedBy: actorUid,
  });

  const parents = await familyRef.collection('parents').get();
  const rollup = highestConversionStatus(
    parents.docs.map(
      (d) => (d.get('conversionStatus') as ParentConversionStatus) ?? 'not_converted',
    ),
  );

  await familyRef.update({ conversionStatus: rollup, updatedAt: now, updatedBy: actorUid });
}

export async function findParentById(familyId: string, parentId: string): Promise<Parent | null> {
  const snap = await adminDb()
    .collection('families')
    .doc(familyId)
    .collection('parents')
    .doc(parentId)
    .get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    name: asString(data.name),
    phone: asString(data.phone),
    email: asStringOrNull(data.email),
    relation: data.relation as Parent['relation'],
    occupation: asStringOrNull(data.occupation),
    conversionStatus: (data.conversionStatus as ParentConversionStatus) ?? 'not_converted',
    leadId: asStringOrNull(data.leadId),
    participantId: asStringOrNull(data.participantId),
  };
}

/** Counts for the Parent Conversion Report (module 5). */
export async function countFamilyConversions(): Promise<{
  total: number;
  leadCreated: number;
  enrolled: number;
}> {
  const base = adminDb().collection('families').where('deletedAt', '==', null);
  const [total, leadCreated, enrolled] = await Promise.all([
    base.count().get(),
    base.where('conversionStatus', '==', 'lead_created').count().get(),
    base.where('conversionStatus', '==', 'enrolled').count().get(),
  ]);
  return {
    total: total.data().count,
    leadCreated: leadCreated.data().count,
    enrolled: enrolled.data().count,
  };
}
