import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type { Placement, PlacementStatus, PlacementStatusEvent } from './schema';

/** Placements pipeline data access (Doc 03 §1.6, Doc 14 §16). Actions own permission + audit. */

/** Bounded history — the SOP tracks the pipeline journey, not an unlimited log. */
const MAX_STATUS_HISTORY = 50;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
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

function toStatusHistory(value: unknown, names: Map<string, string>): PlacementStatusEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const byUid = asString(entry.byUid);
    return {
      status: entry.status as PlacementStatus,
      at: toIso(entry.at),
      byUid,
      byName: names.get(byUid) ?? null,
      note: asStringOrNull(entry.note),
    };
  });
}

export async function findPlacements(): Promise<Placement[]> {
  const db = adminDb();
  const [placements, participants, employers] = await Promise.all([
    db.collection('placements').limit(500).get(),
    db.collection('participants').get(),
    db.collection('employers').get(),
  ]);

  const participantNames = new Map(
    participants.docs.map((d) => {
      const personal = (d.get('personal') ?? {}) as Record<string, unknown>;
      return [d.id, asString(personal.fullName)];
    }),
  );
  const employerNames = new Map(employers.docs.map((d) => [d.id, asString(d.get('name'))]));
  const byUids = placements.docs.flatMap((d) => {
    const history = (d.get('statusHistory') ?? []) as Record<string, unknown>[];
    return history.map((h) => h.byUid);
  });
  const names = await resolveNames(byUids);

  return placements.docs
    .map((doc) => {
      const data = doc.data();
      const feeDisclosure = (data.feeDisclosure ?? {}) as Record<string, unknown>;
      return {
        id: doc.id,
        participantId: asString(data.participantId),
        participantName:
          participantNames.get(asString(data.participantId)) ?? asString(data.participantId),
        employerId: asString(data.employerId),
        employerName: employerNames.get(asString(data.employerId)) ?? asString(data.employerId),
        jobCategory: asString(data.jobCategory),
        country: asString(data.country),
        status: (data.status as PlacementStatus) ?? 'under_review',
        statusHistory: toStatusHistory(data.statusHistory, names),
        feeDisclosure: {
          terranextFeePaise: 0 as const,
          thirdPartyNotes: asStringOrNull(feeDisclosure.thirdPartyNotes),
        },
        updatedAt: toIso(data.updatedAt),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findPlacementById(placementId: string): Promise<Placement | null> {
  const db = adminDb();
  const snap = await db.collection('placements').doc(placementId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};

  const participantId = asString(data.participantId);
  const employerId = asString(data.employerId);
  const [participantSnap, employerSnap] = await Promise.all([
    participantId ? db.collection('participants').doc(participantId).get() : null,
    employerId ? db.collection('employers').doc(employerId).get() : null,
  ]);
  const personal = (participantSnap?.get('personal') ?? {}) as Record<string, unknown>;
  const participantName = participantSnap?.exists ? asString(personal.fullName) : participantId;
  const employerName = employerSnap?.exists ? asString(employerSnap.get('name')) : employerId;

  const byUids = ((data.statusHistory ?? []) as Record<string, unknown>[]).map((h) => h.byUid);
  const names = await resolveNames(byUids);

  const feeDisclosure = (data.feeDisclosure ?? {}) as Record<string, unknown>;
  return {
    id: snap.id,
    participantId,
    participantName,
    employerId,
    employerName,
    jobCategory: asString(data.jobCategory),
    country: asString(data.country),
    status: (data.status as PlacementStatus) ?? 'under_review',
    statusHistory: toStatusHistory(data.statusHistory, names),
    feeDisclosure: {
      terranextFeePaise: 0 as const,
      thirdPartyNotes: asStringOrNull(feeDisclosure.thirdPartyNotes),
    },
    updatedAt: toIso(data.updatedAt),
  };
}

export async function createPlacementRecord(
  input: {
    participantId: string;
    employerId: string;
    jobCategory: string;
    country: string;
    thirdPartyNotes: string | null;
  },
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('placements').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    participantId: input.participantId,
    employerId: input.employerId,
    jobCategory: input.jobCategory,
    country: input.country,
    status: 'under_review',
    statusHistory: [{ status: 'under_review', at: now, byUid: actorUid, note: null }],
    feeDisclosure: { terranextFeePaise: 0, thirdPartyNotes: input.thirdPartyNotes },
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return ref.id;
}

export async function advancePlacementRecord(
  placementId: string,
  status: PlacementStatus,
  note: string | null,
  actorUid: string,
): Promise<void> {
  const ref = adminDb().collection('placements').doc(placementId);
  const now = new Date();

  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const history = (snap.get('statusHistory') ?? []) as Record<string, unknown>[];
    const nextHistory = [...history, { status, at: now, byUid: actorUid, note }].slice(
      -MAX_STATUS_HISTORY,
    );
    tx.update(ref, {
      status,
      statusHistory: nextHistory,
      updatedAt: now,
      updatedBy: actorUid,
    });
  });
}
