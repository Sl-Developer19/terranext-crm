import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type {
  CareerProfile,
  CareerProfileListItem,
  EligibilityState,
  GuidanceSession,
  PassportStatus,
  ResumeStatus,
} from './schema';

/** Career profile data access (Doc 03 §1.6). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
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

export async function findCareerProfiles(): Promise<CareerProfileListItem[]> {
  const db = adminDb();
  const snap = await db.collection('careerProfiles').limit(500).get();
  const names = await resolveParticipantNames(snap.docs.map((d) => d.id));

  return snap.docs
    .map((doc) => {
      const interest = (doc.get('interest') ?? {}) as Record<string, unknown>;
      return {
        participantId: doc.id,
        participantName: names.get(doc.id) ?? doc.id,
        jobCategories: Array.isArray(interest.jobCategories)
          ? (interest.jobCategories as string[])
          : [],
        eligibility: (doc.get('eligibility') as EligibilityState) ?? 'not_evaluated',
        readinessScore:
          typeof doc.get('readinessScore') === 'number'
            ? (doc.get('readinessScore') as number)
            : null,
        updatedAt: toIso(doc.get('updatedAt')) ?? '',
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findCareerProfileById(participantId: string): Promise<CareerProfile | null> {
  const snap = await adminDb().collection('careerProfiles').doc(participantId).get();
  if (!snap.exists) return null;

  const participant = await adminDb().collection('participants').doc(participantId).get();
  const personal = (participant.get('personal') ?? {}) as Record<string, unknown>;
  const interest = (snap.get('interest') ?? {}) as Record<string, unknown>;

  return {
    participantId,
    participantName: participant.exists ? asString(personal.fullName) : null,
    jobCategories: Array.isArray(interest.jobCategories)
      ? (interest.jobCategories as string[])
      : [],
    preferredCountries: Array.isArray(interest.preferredCountries)
      ? (interest.preferredCountries as string[])
      : [],
    passportStatus: (interest.passportStatus as PassportStatus) ?? 'none',
    willingToRelocate: interest.willingToRelocate === true,
    readinessScore:
      typeof snap.get('readinessScore') === 'number'
        ? (snap.get('readinessScore') as number)
        : null,
    eligibility: (snap.get('eligibility') as EligibilityState) ?? 'not_evaluated',
    eligibilityNote: asStringOrNull(snap.get('eligibilityNote')),
    evaluatedBy: asStringOrNull(snap.get('evaluatedBy')),
    evaluatedAt: toIso(snap.get('evaluatedAt')),
    resumeStatus: (snap.get('resumeStatus') as ResumeStatus) ?? 'none',
    updatedAt: toIso(snap.get('updatedAt')) ?? '',
  };
}

export async function findGuidanceSessions(participantId: string): Promise<GuidanceSession[]> {
  const snap = await adminDb()
    .collection('careerProfiles')
    .doc(participantId)
    .collection('guidanceSessions')
    .orderBy('heldAt', 'desc')
    .get();

  const names = await resolveNames(snap.docs.map((d) => d.get('officerUid')));
  return snap.docs.map((doc) => {
    const officerUid = asString(doc.get('officerUid'));
    return {
      id: doc.id,
      heldAt: asString(doc.get('heldAt')),
      notes: asString(doc.get('notes')),
      recommendation: asStringOrNull(doc.get('recommendation')),
      officerUid,
      officerName: names.get(officerUid) ?? null,
    };
  });
}

export interface CareerInterestWriteModel {
  jobCategories: string[];
  preferredCountries: string[];
  passportStatus: string;
  willingToRelocate: boolean;
  resumeStatus: string;
}

export async function upsertCareerProfileRecord(
  participantId: string,
  input: CareerInterestWriteModel,
  actorUid: string,
  branchId: string,
): Promise<void> {
  const ref = adminDb().collection('careerProfiles').doc(participantId);
  const existing = await ref.get();
  const now = new Date();

  await ref.set(
    {
      schemaVersion: 1,
      branchId,
      interest: {
        jobCategories: input.jobCategories,
        preferredCountries: input.preferredCountries,
        passportStatus: input.passportStatus,
        willingToRelocate: input.willingToRelocate,
      },
      resumeStatus: input.resumeStatus,
      ...(existing.exists
        ? {}
        : {
            readinessScore: null,
            eligibility: 'not_evaluated',
            eligibilityNote: null,
            evaluatedBy: null,
            evaluatedAt: null,
            createdAt: now,
            createdBy: actorUid,
          }),
      updatedAt: now,
      updatedBy: actorUid,
    },
    { merge: true },
  );
}

export async function evaluateEligibilityRecord(
  participantId: string,
  eligibility: 'eligible' | 'not_eligible',
  eligibilityNote: string,
  readinessScore: number | undefined,
  actorUid: string,
): Promise<void> {
  const now = new Date();
  await adminDb()
    .collection('careerProfiles')
    .doc(participantId)
    .update({
      eligibility,
      eligibilityNote,
      evaluatedBy: actorUid,
      evaluatedAt: now,
      ...(readinessScore !== undefined ? { readinessScore } : {}),
      updatedAt: now,
      updatedBy: actorUid,
    });
}

export async function logGuidanceSessionRecord(
  participantId: string,
  input: { heldAt: string; notes: string; recommendation: string | null },
  actorUid: string,
): Promise<string> {
  const ref = adminDb()
    .collection('careerProfiles')
    .doc(participantId)
    .collection('guidanceSessions')
    .doc();
  await ref.set({
    schemaVersion: 1,
    heldAt: input.heldAt,
    notes: input.notes,
    recommendation: input.recommendation,
    officerUid: actorUid,
    createdAt: new Date(),
    createdBy: actorUid,
  });
  return ref.id;
}
