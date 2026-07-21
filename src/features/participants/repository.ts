import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type {
  DocumentSnapshot,
  Query,
  QueryDocumentSnapshot,
  Transaction,
} from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { DEFAULT_BRANCH_ID } from '@/types/common';

import { buildSearchTokens, formatParticipantId, normalizeSearchTerm } from './logic';
import type {
  Enrolment,
  Participant,
  ParticipantDocument,
  ParticipantFilters,
  ParticipantListItem,
  ParticipantStatus,
  TimelineEntry,
} from './schema';

/**
 * Participant data access (Doc 02 §3). Every Firestore read/write for the
 * lifetime record goes through here — actions own permission + audit, this
 * module owns document shape, so the two concerns stay separable and the
 * shape logic is reused when `convertLead` lands (Doc 19, M3).
 */

const COUNTER_ID = 'participantId';
const DEFAULT_ID_PREFIX = 'TNX';

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/* ── Mapping ───────────────────────────────────────────────────────────── */

export function toParticipant(doc: DocumentSnapshot | QueryDocumentSnapshot): Participant {
  const data = doc.data() ?? {};
  const personal = (data.personal ?? {}) as Record<string, unknown>;
  const emergency = (personal.emergencyContact ?? {}) as Record<string, unknown>;
  const family = (data.family ?? {}) as Record<string, unknown>;

  return {
    id: doc.id,
    leadId: asStringOrNull(data.leadId),
    personal: {
      fullName: asString(personal.fullName),
      dob: toIso(personal.dob),
      gender: (asStringOrNull(personal.gender) as Participant['personal']['gender']) ?? null,
      phone: asString(personal.phone),
      email: asStringOrNull(personal.email),
      address: asStringOrNull(personal.address),
      emergencyContact: {
        name: asString(emergency.name),
        phone: asString(emergency.phone),
        relation: asString(emergency.relation),
      },
    },
    family: {
      parentName: asStringOrNull(family.parentName),
      parentPhone: asStringOrNull(family.parentPhone),
    },
    status: data.status as ParticipantStatus,
    currentEnrolmentId: asStringOrNull(data.currentEnrolmentId),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    createdAt: toIso(data.createdAt) ?? '',
    updatedAt: toIso(data.updatedAt) ?? '',
  };
}

function toListItem(doc: QueryDocumentSnapshot): ParticipantListItem {
  const data = doc.data();
  const personal = (data.personal ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    fullName: asString(personal.fullName),
    phone: asString(personal.phone),
    status: data.status as ParticipantStatus,
    // Denormalized from the current enrolment so the directory renders
    // without an N+1 read per row (Doc 03 §0 denormalization rule).
    academyId: asStringOrNull(data.currentAcademyId),
    batchId: asStringOrNull(data.currentBatchId),
    updatedAt: toIso(data.updatedAt) ?? '',
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function findParticipants(
  filters: ParticipantFilters,
): Promise<ParticipantListItem[]> {
  let query: Query = adminDb().collection('participants').where('deletedAt', '==', null);

  if (filters.status) query = query.where('status', '==', filters.status);
  if (filters.academyId) query = query.where('currentAcademyId', '==', filters.academyId);
  if (filters.batchId) query = query.where('currentBatchId', '==', filters.batchId);

  const term = filters.q ? normalizeSearchTerm(filters.q) : '';
  if (term.length >= 2) {
    query = query.where('searchTokens', 'array-contains', term);
  }

  // `array-contains` + `orderBy` on a different field needs a composite index
  // per filter combination; ordering by name keeps one index serving all of
  // them and reads more naturally in a directory than "recently updated".
  const snap = await query.orderBy('personal.fullName').limit(200).get();
  return snap.docs.map(toListItem);
}

export async function findParticipantById(participantId: string): Promise<Participant | null> {
  const snap = await adminDb().collection('participants').doc(participantId).get();
  if (!snap.exists) return null;
  if (snap.get('deletedAt') !== null) return null;
  return toParticipant(snap);
}

export async function findEnrolments(participantId: string): Promise<Enrolment[]> {
  const snap = await adminDb()
    .collection('participants')
    .doc(participantId)
    .collection('enrolments')
    .orderBy('enrolledAt', 'desc')
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    const summary = (data.assessmentSummary ?? {}) as Record<string, unknown>;
    return {
      id: doc.id,
      academyId: asString(data.academyId),
      programmeId: asString(data.programmeId),
      batchId: asStringOrNull(data.batchId),
      status: data.status as Enrolment['status'],
      enrolledAt: toIso(data.enrolledAt) ?? '',
      completedAt: toIso(data.completedAt),
      attendancePct: asNumber(data.attendancePct),
      assessmentSummary: {
        attempted: asNumber(summary.attempted),
        passed: asNumber(summary.passed),
        avgScore: asNumber(summary.avgScore),
      },
      certificateId: asStringOrNull(data.certificateId),
    };
  });
}

export async function findTimeline(
  participantId: string,
  resolveNames: (uids: unknown[]) => Promise<Map<string, string>>,
): Promise<TimelineEntry[]> {
  const snap = await adminDb()
    .collection('participants')
    .doc(participantId)
    .collection('timeline')
    .orderBy('at', 'desc')
    .limit(100)
    .get();

  const names = await resolveNames(snap.docs.map((d) => d.get('byUid')));
  return snap.docs.map((doc) => {
    const data = doc.data();
    const byUid = asString(data.byUid);
    return {
      id: doc.id,
      type: asString(data.type),
      refPath: asString(data.refPath),
      summary: asString(data.summary),
      at: toIso(data.at) ?? '',
      byUid,
      byName: names.get(byUid) ?? 'System',
    };
  });
}

export async function findDocuments(participantId: string): Promise<ParticipantDocument[]> {
  const snap = await adminDb()
    .collection('participants')
    .doc(participantId)
    .collection('documents')
    .orderBy('uploadedAt', 'desc')
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      kind: data.kind as ParticipantDocument['kind'],
      fileName: asString(data.fileName),
      sizeBytes: asNumber(data.sizeBytes),
      contentType: asString(data.contentType),
      status: data.status as ParticipantDocument['status'],
      storagePath: asString(data.storagePath),
      uploadedBy: asString(data.uploadedBy),
      uploadedAt: toIso(data.uploadedAt) ?? '',
    };
  });
}

export async function findByPhone(phone: string): Promise<{ id: string } | null> {
  const snap = await adminDb()
    .collection('participants')
    .where('personal.phone', '==', phone)
    .limit(1)
    .get();
  const first = snap.docs[0];
  return first ? { id: first.id } : null;
}

/* ── Writes ────────────────────────────────────────────────────────────── */

/**
 * Reserves the next Participant ID inside a transaction (Doc 14 §3).
 * The counter is the BR-01 uniqueness guarantee: two concurrent conversions
 * cannot mint the same ID because the read-modify-write is transactional.
 * Known throughput ceiling (~1 write/sec/counter) is documented in Doc 13
 * §4.1 and is orders of magnitude above admission volume.
 */
export async function reserveParticipantId(tx: Transaction, year: number): Promise<string> {
  const ref = adminDb().collection('counters').doc(COUNTER_ID);
  const snap = await tx.get(ref);

  const prefix = (snap.exists ? asStringOrNull(snap.get('prefix')) : null) ?? DEFAULT_ID_PREFIX;
  const storedYear = snap.exists ? asNumber(snap.get('year')) : 0;
  // Participant IDs embed the year but the sequence is continuous — a new
  // year does not reset it (unlike receiptNo, which resets per FY by design).
  const current = snap.exists ? asNumber(snap.get('current')) : 0;
  const next = current + 1;

  tx.set(
    ref,
    { current: next, prefix, year: storedYear === 0 ? year : storedYear },
    { merge: true },
  );
  return formatParticipantId(prefix, year, next);
}

export interface ParticipantWriteModel {
  fullName: string;
  dob: string;
  gender?: string | undefined;
  phone: string;
  email?: string | undefined;
  address?: string | undefined;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  parentName?: string | undefined;
  parentPhone?: string | undefined;
}

/** Document body shared by create and update — one shape definition. */
function personalFields(input: ParticipantWriteModel) {
  return {
    personal: {
      fullName: input.fullName,
      dob: new Date(input.dob),
      gender: input.gender ?? null,
      phone: input.phone,
      email: input.email ?? null,
      address: input.address ?? null,
      emergencyContact: {
        name: input.emergencyContactName,
        phone: input.emergencyContactPhone,
        relation: input.emergencyContactRelation,
      },
    },
    family: {
      parentName: input.parentName ?? null,
      parentPhone: input.parentPhone ?? null,
    },
    searchTokens: buildSearchTokens(input.fullName, input.phone),
  };
}

export interface CreateParticipantRecord {
  input: ParticipantWriteModel;
  leadId: string | null;
  actorUid: string;
  branchId: string;
}

/**
 * Creates the lifetime record with a transactionally minted ID (BR-01).
 * `convertLead` (M3) will call this inside its own transaction rather than
 * duplicating the shape — hence the transaction parameter.
 */
export async function createParticipantRecord(record: CreateParticipantRecord): Promise<string> {
  const db = adminDb();
  const now = new Date();

  return db.runTransaction(async (tx) => {
    const participantId = await reserveParticipantId(tx, now.getFullYear());
    const ref = db.collection('participants').doc(participantId);

    tx.set(ref, {
      schemaVersion: 1,
      branchId: record.branchId,
      leadId: record.leadId,
      ...personalFields(record.input),
      status: 'enrolled' satisfies ParticipantStatus,
      currentEnrolmentId: null,
      currentAcademyId: null,
      currentBatchId: null,
      tags: [],
      createdAt: now,
      createdBy: record.actorUid,
      updatedAt: now,
      updatedBy: record.actorUid,
      deletedAt: null,
      deletedBy: null,
    });

    tx.set(ref.collection('timeline').doc(), {
      type: 'participant_created',
      refPath: `participants/${participantId}`,
      summary: record.leadId
        ? 'Participant record created from lead'
        : 'Participant record created',
      at: now,
      byUid: record.actorUid,
    });

    return participantId;
  });
}

export async function updateParticipantRecord(
  participantId: string,
  input: ParticipantWriteModel,
  actorUid: string,
): Promise<void> {
  const now = new Date();
  await adminDb()
    .collection('participants')
    .doc(participantId)
    .update({ ...personalFields(input), updatedAt: now, updatedBy: actorUid });
}

export async function updateParticipantStatus(
  participantId: string,
  status: ParticipantStatus,
  clearCurrentEnrolment: boolean,
  actorUid: string,
  summary: string,
): Promise<void> {
  const db = adminDb();
  const ref = db.collection('participants').doc(participantId);
  const now = new Date();

  const batch = db.batch();
  batch.update(ref, {
    status,
    ...(clearCurrentEnrolment ? { currentEnrolmentId: null } : {}),
    updatedAt: now,
    updatedBy: actorUid,
  });
  batch.set(ref.collection('timeline').doc(), {
    type: 'status_change',
    refPath: `participants/${participantId}`,
    summary,
    at: now,
    byUid: actorUid,
  });
  await batch.commit();
}

export interface EnrolmentWriteModel {
  academyId: string;
  programmeId: string;
  batchId: string | null;
  status: Enrolment['status'];
}

/**
 * Adds an enrolment and promotes it to the participant's current one
 * (Doc 03 §1.4: re-enrolment is a NEW enrolment doc, never a new participant
 * — BR-01/FR-03.3). The denormalized `currentAcademyId`/`currentBatchId`
 * exist so the directory can filter without a collection-group join.
 */
export async function addEnrolmentRecord(
  participantId: string,
  input: EnrolmentWriteModel,
  actorUid: string,
  /** Next participant status, or null to leave it untouched (decided by the action). */
  nextStatus: ParticipantStatus | null,
): Promise<string> {
  const db = adminDb();
  const ref = db.collection('participants').doc(participantId);
  const enrolmentRef = ref.collection('enrolments').doc();
  const now = new Date();

  const batch = db.batch();
  batch.set(enrolmentRef, {
    schemaVersion: 1,
    academyId: input.academyId,
    programmeId: input.programmeId,
    batchId: input.batchId,
    status: input.status,
    enrolledAt: now,
    completedAt: null,
    attendancePct: 0,
    assessmentSummary: { attempted: 0, passed: 0, avgScore: 0 },
    certificateId: null,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  batch.update(ref, {
    currentEnrolmentId: enrolmentRef.id,
    currentAcademyId: input.academyId,
    currentBatchId: input.batchId,
    ...(nextStatus ? { status: nextStatus } : {}),
    updatedAt: now,
    updatedBy: actorUid,
  });
  batch.set(ref.collection('timeline').doc(), {
    type: 'enrolment_added',
    refPath: `participants/${participantId}/enrolments/${enrolmentRef.id}`,
    summary: `Enrolled in ${input.programmeId}${input.batchId ? ` (batch ${input.batchId})` : ''}`,
    at: now,
    byUid: actorUid,
  });
  await batch.commit();

  return enrolmentRef.id;
}

export async function updateEnrolmentStatus(
  participantId: string,
  enrolmentId: string,
  status: Enrolment['status'],
  batchId: string | null,
  actorUid: string,
): Promise<void> {
  const db = adminDb();
  const ref = db.collection('participants').doc(participantId);
  const enrolmentRef = ref.collection('enrolments').doc(enrolmentId);
  const now = new Date();

  const batch = db.batch();
  batch.update(enrolmentRef, {
    status,
    ...(batchId !== null ? { batchId } : {}),
    ...(status === 'completed' ? { completedAt: now } : {}),
    updatedAt: now,
    updatedBy: actorUid,
  });
  if (batchId !== null) {
    batch.update(ref, { currentBatchId: batchId, updatedAt: now, updatedBy: actorUid });
  }
  batch.set(ref.collection('timeline').doc(), {
    type: 'enrolment_updated',
    refPath: `participants/${participantId}/enrolments/${enrolmentId}`,
    summary: `Enrolment status changed to ${status}`,
    at: now,
    byUid: actorUid,
  });
  await batch.commit();
}

export async function appendTimelineEntry(
  participantId: string,
  entry: { type: string; summary: string; byUid: string },
): Promise<void> {
  await adminDb()
    .collection('participants')
    .doc(participantId)
    .collection('timeline')
    .add({
      type: entry.type,
      refPath: `participants/${participantId}`,
      summary: entry.summary,
      at: new Date(),
      byUid: entry.byUid,
    });
}

export interface DocumentWriteModel {
  kind: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  storagePath: string;
  uploadedBy: string;
}

/** Creates the `pending` metadata doc that anchors the upload (Doc 10 §6). */
export async function createDocumentRecord(
  participantId: string,
  documentId: string,
  input: DocumentWriteModel,
): Promise<void> {
  await adminDb()
    .collection('participants')
    .doc(participantId)
    .collection('documents')
    .doc(documentId)
    .set({
      schemaVersion: 1,
      branchId: DEFAULT_BRANCH_ID,
      kind: input.kind,
      fileName: input.fileName,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      storagePath: input.storagePath,
      status: 'pending',
      uploadedBy: input.uploadedBy,
      uploadedAt: new Date(),
    });
}

export async function setDocumentStatus(
  participantId: string,
  documentId: string,
  status: 'ready' | 'rejected',
): Promise<void> {
  await adminDb()
    .collection('participants')
    .doc(participantId)
    .collection('documents')
    .doc(documentId)
    .update({ status });
}

export async function findDocumentById(
  participantId: string,
  documentId: string,
): Promise<ParticipantDocument | null> {
  const snap = await adminDb()
    .collection('participants')
    .doc(participantId)
    .collection('documents')
    .doc(documentId)
    .get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    kind: data.kind as ParticipantDocument['kind'],
    fileName: asString(data.fileName),
    sizeBytes: asNumber(data.sizeBytes),
    contentType: asString(data.contentType),
    status: data.status as ParticipantDocument['status'],
    storagePath: asString(data.storagePath),
    uploadedBy: asString(data.uploadedBy),
    uploadedAt: toIso(data.uploadedAt) ?? '',
  };
}
