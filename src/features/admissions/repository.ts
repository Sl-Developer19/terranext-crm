import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { reserveParticipantId } from '@/features/participants/repository';
import { adminDb } from '@/lib/firebase/admin';

import type { DuplicateMatch } from './schema';

/** Admissions data access (S13/S14, BR-01). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}

export interface QueueLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  stage: string;
  source: string;
  assignedToUid: string | null;
  updatedAt: string;
}

export async function findQueueLeads(stages: readonly string[]): Promise<QueueLead[]> {
  const snap = await adminDb()
    .collection('leads')
    .where('stage', 'in', [...stages])
    .limit(500)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    name: asString(doc.get('fullName')),
    phone: asString(doc.get('phone')),
    email: asStringOrNull(doc.get('email')),
    stage: asString(doc.get('stage')),
    source: asString(doc.get('source')),
    assignedToUid: asStringOrNull(doc.get('assignedToUid')),
    updatedAt: toIso(doc.get('updatedAt')),
  }));
}

export async function findLeadForConversion(leadId: string): Promise<QueueLead | null> {
  const doc = await adminDb().collection('leads').doc(leadId).get();
  if (!doc.exists) return null;
  return {
    id: doc.id,
    name: asString(doc.get('fullName')),
    phone: asString(doc.get('phone')),
    email: asStringOrNull(doc.get('email')),
    stage: asString(doc.get('stage')),
    source: asString(doc.get('source')),
    assignedToUid: asStringOrNull(doc.get('assignedToUid')),
    updatedAt: toIso(doc.get('updatedAt')),
  };
}

export async function isLeadConverted(leadId: string): Promise<string | null> {
  const doc = await adminDb().collection('leads').doc(leadId).get();
  return doc.exists ? asStringOrNull(doc.get('participantId')) : null;
}

/** BR-01 duplicate surface: an existing lifetime record on the same phone. */
export async function findDuplicatesByPhone(phone: string): Promise<DuplicateMatch[]> {
  const snap = await adminDb()
    .collection('participants')
    .where('personal.phone', '==', phone)
    .limit(5)
    .get();

  return snap.docs.map((doc) => {
    const personal = (doc.get('personal') ?? {}) as Record<string, unknown>;
    return {
      participantId: doc.id,
      fullName: asString(personal.fullName),
      phone: asString(personal.phone),
      matchedOn: 'phone' as const,
    };
  });
}

export interface ConvertLeadRecord {
  leadId: string;
  personal: {
    fullName: string;
    dob: string;
    gender: string | null;
    phone: string;
    email: string | null;
    address: string | null;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;
    parentName: string | null;
    parentPhone: string | null;
  };
  academyId: string;
  programmeId: string;
  batchId: string | null;
  /** Copied onto the enrolment as the BR-02 evidence the admission rested on. */
  recommendationSnapshot: { sessionId: string; programmeId: string; remarks: string | null };
  actorUid: string;
  branchId: string;
}

export interface ConvertOutcome {
  participantId: string;
  enrolmentId: string;
}

function searchTokens(fullName: string, phone: string): string[] {
  const tokens = new Set<string>();
  for (const part of fullName.toLowerCase().split(/\s+/).filter(Boolean)) {
    tokens.add(part);
  }
  if (phone) tokens.add(phone.replace(/\D/g, '').slice(-10));
  return [...tokens];
}

/**
 * The conversion's atomic core (BR-01). ID minting, the participant record,
 * the first enrolment, and the lead's `participantId` back-link all commit
 * together or not at all — a minted ID with no record behind it, or a lead
 * that looks converted but has no participant, are both states BR-01's
 * "one ID for life" promise cannot survive.
 *
 * Batch allocation (BR-04) and the fee account are deliberately *outside*
 * this transaction: each owns its own transactional invariant (capacity,
 * account uniqueness), and a full batch must not roll back an admission that
 * is otherwise valid — the participant simply starts unallocated.
 */
export async function convertLeadRecord(record: ConvertLeadRecord): Promise<ConvertOutcome> {
  const db = adminDb();
  const now = new Date();

  return db.runTransaction(async (tx) => {
    const leadRef = db.collection('leads').doc(record.leadId);
    const leadSnap = await tx.get(leadRef);
    if (!leadSnap.exists) throw new Error('lead_missing');

    // Re-read inside the transaction: two operators on the same lead must not
    // both mint an ID. The first commit wins; the second sees the back-link.
    if (asStringOrNull(leadSnap.get('participantId'))) throw new Error('already_converted');

    const participantId = await reserveParticipantId(tx, now.getFullYear());
    const participantRef = db.collection('participants').doc(participantId);
    const enrolmentRef = participantRef.collection('enrolments').doc();

    tx.set(participantRef, {
      schemaVersion: 1,
      branchId: record.branchId,
      leadId: record.leadId,
      personal: {
        fullName: record.personal.fullName,
        dob: new Date(record.personal.dob),
        gender: record.personal.gender,
        phone: record.personal.phone,
        email: record.personal.email,
        address: record.personal.address,
        emergencyContact: {
          name: record.personal.emergencyContactName,
          phone: record.personal.emergencyContactPhone,
          relation: record.personal.emergencyContactRelation,
        },
      },
      family: {
        parentName: record.personal.parentName,
        parentPhone: record.personal.parentPhone,
      },
      searchTokens: searchTokens(record.personal.fullName, record.personal.phone),
      status: 'enrolled',
      currentEnrolmentId: enrolmentRef.id,
      currentAcademyId: record.academyId,
      currentBatchId: record.batchId,
      tags: [],
      createdAt: now,
      createdBy: record.actorUid,
      updatedAt: now,
      updatedBy: record.actorUid,
      deletedAt: null,
      deletedBy: null,
    });

    tx.set(enrolmentRef, {
      schemaVersion: 1,
      academyId: record.academyId,
      programmeId: record.programmeId,
      batchId: record.batchId,
      status: 'orientation',
      enrolledAt: now,
      completedAt: null,
      attendancePct: 0,
      assessmentSummary: { attempted: 0, passed: 0, avgScore: 0 },
      certificateId: null,
      // BR-02: the recommendation that justified this admission travels with
      // the enrolment, so the evidence survives even if the session is later
      // superseded by another one.
      recommendationSnapshot: record.recommendationSnapshot,
      createdAt: now,
      createdBy: record.actorUid,
      updatedAt: now,
      updatedBy: record.actorUid,
    });

    tx.set(participantRef.collection('timeline').doc(), {
      type: 'participant_created',
      refPath: `participants/${participantId}`,
      summary: 'Participant record created by lead conversion',
      at: now,
      byUid: record.actorUid,
    });

    tx.update(leadRef, {
      stage: 'admitted',
      participantId,
      updatedAt: now,
      updatedBy: record.actorUid,
    });

    return { participantId, enrolmentId: enrolmentRef.id };
  });
}
