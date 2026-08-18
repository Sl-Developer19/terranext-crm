import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type { AlumniRecord, EngagementField } from './schema';

/** Alumni registry data access (Doc 03 §1.6, Doc 14 §17, BR-05). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}

/** Resolves only the participant ids on this page — never a full collection scan. */
async function resolveParticipantNames(ids: Iterable<string>): Promise<Map<string, string>> {
  const db = adminDb();
  const unique = [...new Set(ids)].filter((id) => id.length > 0);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const snap = await db.collection('participants').doc(id).get();
      const personal = (snap.get('personal') ?? {}) as Record<string, unknown>;
      map.set(id, asString(personal.fullName) || id);
    }),
  );
  return map;
}

export async function findAlumniRecords(): Promise<AlumniRecord[]> {
  const db = adminDb();
  const alumni = await db
    .collection('alumniRecords')
    .orderBy('memberSince', 'desc')
    .limit(500)
    .get();
  const names = await resolveParticipantNames(alumni.docs.map((d) => d.id));

  return alumni.docs.map((doc) => {
    const data = doc.data();
    const engagement = (data.engagement ?? {}) as Record<string, unknown>;
    return {
      participantId: doc.id,
      participantName: names.get(doc.id) ?? doc.id,
      memberSince: toIso(data.memberSince),
      triggeredByCertificateId: asStringOrNull(data.triggeredByCertificateId),
      engagement: {
        referrals: asNumber(engagement.referrals),
        eventsAttended: asNumber(engagement.eventsAttended),
      },
      consentForSuccessStory: data.consentForSuccessStory === true,
      nextStepEnrolled: data.nextStepEnrolled === true,
      updatedAt: toIso(data.updatedAt),
    };
  });
}

export async function findAlumniRecordById(participantId: string): Promise<AlumniRecord | null> {
  const db = adminDb();
  const snap = await db.collection('alumniRecords').doc(participantId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};

  const participantSnap = await db.collection('participants').doc(participantId).get();
  const personal = (participantSnap.get('personal') ?? {}) as Record<string, unknown>;
  const participantName = participantSnap.exists ? asString(personal.fullName) : participantId;

  const engagement = (data.engagement ?? {}) as Record<string, unknown>;
  return {
    participantId: snap.id,
    participantName,
    memberSince: toIso(data.memberSince),
    triggeredByCertificateId: asStringOrNull(data.triggeredByCertificateId),
    engagement: {
      referrals: asNumber(engagement.referrals),
      eventsAttended: asNumber(engagement.eventsAttended),
    },
    consentForSuccessStory: data.consentForSuccessStory === true,
    nextStepEnrolled: data.nextStepEnrolled === true,
    updatedAt: toIso(data.updatedAt),
  };
}

export async function recordEngagementDelta(
  participantId: string,
  field: EngagementField,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('alumniRecords')
    .doc(participantId)
    .update({
      [`engagement.${field}`]: FieldValue.increment(1),
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
}

export async function setConsentRecord(
  participantId: string,
  consent: boolean,
  actorUid: string,
): Promise<void> {
  await adminDb().collection('alumniRecords').doc(participantId).update({
    consentForSuccessStory: consent,
    updatedAt: new Date(),
    updatedBy: actorUid,
  });
}

export async function setNextStepStatusRecord(
  participantId: string,
  enrolled: boolean,
  actorUid: string,
): Promise<void> {
  await adminDb().collection('alumniRecords').doc(participantId).update({
    nextStepEnrolled: enrolled,
    updatedAt: new Date(),
    updatedBy: actorUid,
  });
}

/** BR-05 manual override — `system_admin` only, always audited with a reason. */
/**
 * Manual override path for BR-05 (no triggering certificate). Same
 * transactional all-or-nothing shape as `certificates/repository.ts`'s
 * `ensureAlumniRecord` and for the same reason: without a transaction, a
 * crash between the two writes leaves an alumni record whose participant
 * never actually flipped to `alumni`, and the existence check on retry would
 * then treat the step as already done, permanently skipping the update.
 */
export async function createAlumniOverrideRecord(
  participantId: string,
  actorUid: string,
  branchId: string,
): Promise<boolean> {
  const db = adminDb();
  const alumniRef = db.collection('alumniRecords').doc(participantId);
  const participantRef = db.collection('participants').doc(participantId);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(alumniRef);
    if (existing.exists) return false;

    const now = new Date();
    tx.set(alumniRef, {
      schemaVersion: 1,
      branchId,
      participantId,
      memberSince: now,
      triggeredByCertificateId: null,
      engagement: { referrals: 0, eventsAttended: 0 },
      consentForSuccessStory: false,
      nextStepEnrolled: false,
      createdAt: now,
      createdBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
    });

    tx.update(participantRef, {
      status: 'alumni',
      updatedAt: now,
      updatedBy: actorUid,
    });

    return true;
  });
}
