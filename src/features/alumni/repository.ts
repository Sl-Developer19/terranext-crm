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

export async function findAlumniRecords(): Promise<AlumniRecord[]> {
  const db = adminDb();
  const [alumni, participants] = await Promise.all([
    db.collection('alumniRecords').orderBy('memberSince', 'desc').get(),
    db.collection('participants').get(),
  ]);

  const names = new Map(
    participants.docs.map((d) => {
      const personal = (d.get('personal') ?? {}) as Record<string, unknown>;
      return [d.id, asString(personal.fullName)];
    }),
  );

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
      updatedAt: toIso(data.updatedAt),
    };
  });
}

export async function findAlumniRecordById(participantId: string): Promise<AlumniRecord | null> {
  const all = await findAlumniRecords();
  return all.find((r) => r.participantId === participantId) ?? null;
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

/** BR-05 manual override — `system_admin` only, always audited with a reason. */
export async function createAlumniOverrideRecord(
  participantId: string,
  actorUid: string,
  branchId: string,
): Promise<boolean> {
  const ref = adminDb().collection('alumniRecords').doc(participantId);
  const existing = await ref.get();
  if (existing.exists) return false;

  const now = new Date();
  await ref.set({
    schemaVersion: 1,
    branchId,
    participantId,
    memberSince: now,
    triggeredByCertificateId: null,
    engagement: { referrals: 0, eventsAttended: 0 },
    consentForSuccessStory: false,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });

  await adminDb().collection('participants').doc(participantId).update({
    status: 'alumni',
    updatedAt: now,
    updatedBy: actorUid,
  });

  return true;
}
