import 'server-only';

import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type { LeadershipLevelDefinition, LevelStatus } from './schema';

/** Leadership level data access — mirrors `catalogue/repository.ts`'s shape exactly. */

const SCAN_CAP = 500;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toLevel(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  partnerCount: number,
): LeadershipLevelDefinition {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    name: asString(data.name),
    slug: asString(data.slug),
    description: asStringOrNull(data.description),
    displayOrder: asNumber(data.displayOrder),
    badgeColor: asStringOrNull(data.badgeColor),
    badgeIcon: asStringOrNull(data.badgeIcon),
    status: (data.status as LevelStatus) ?? 'active',
    partnerCount,
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function findLeadershipLevels(): Promise<LeadershipLevelDefinition[]> {
  const db = adminDb();
  const [levels, partners] = await Promise.all([
    db.collection('leadershipLevels').limit(SCAN_CAP).get(),
    db.collection('growthPartners').where('deletedAt', '==', null).limit(SCAN_CAP).get(),
  ]);

  const counts = new Map<string, number>();
  for (const doc of partners.docs) {
    const levelSlug = asString(doc.get('leadershipLevel'));
    counts.set(levelSlug, (counts.get(levelSlug) ?? 0) + 1);
  }

  return levels.docs
    .map((doc) => toLevel(doc, counts.get(asString(doc.get('slug'))) ?? 0))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

export async function findLeadershipLevelById(
  levelId: string,
): Promise<LeadershipLevelDefinition | null> {
  const snap = await adminDb().collection('leadershipLevels').doc(levelId).get();
  if (!snap.exists) return null;
  const slugValue = asString(snap.get('slug'));
  const partners = await adminDb()
    .collection('growthPartners')
    .where('leadershipLevel', '==', slugValue)
    .where('deletedAt', '==', null)
    .get();
  return toLevel(snap, partners.size);
}

/** Resolves a level by its slug — used wherever a partner's own level is
 * displayed (partner-detail-view, partner dashboard). Returns null for an
 * unrecognised/legacy slug rather than throwing — a partner record must
 * never fail to render just because its level definition was since removed. */
export async function findLeadershipLevelBySlug(
  levelSlug: string,
): Promise<LeadershipLevelDefinition | null> {
  const snap = await adminDb()
    .collection('leadershipLevels')
    .where('slug', '==', levelSlug)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return null;
  return toLevel(doc, 0);
}

/** The entry-level tier for a newly registered partner — the active level
 * with the lowest display order, not a hardcoded slug like the old "bronze"
 * literal. Null if no active level exists yet (registration still succeeds;
 * the partner simply has no resolvable level until one is created). */
export async function findDefaultLeadershipLevelSlug(): Promise<string | null> {
  const snap = await adminDb()
    .collection('leadershipLevels')
    .where('status', '==', 'active')
    .orderBy('displayOrder', 'asc')
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? asString(doc.get('slug')) : null;
}

export async function isLevelSlugTaken(levelSlug: string, exceptId?: string): Promise<boolean> {
  const snap = await adminDb()
    .collection('leadershipLevels')
    .where('slug', '==', levelSlug)
    .limit(2)
    .get();
  return snap.docs.some((doc) => doc.id !== exceptId);
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface LeadershipLevelWriteModel {
  name: string;
  slug: string;
  description?: string | undefined;
  displayOrder: number;
  badgeColor?: string | undefined;
  badgeIcon?: string | undefined;
}

export async function createLeadershipLevelRecord(
  input: LeadershipLevelWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('leadershipLevels').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    displayOrder: input.displayOrder,
    badgeColor: input.badgeColor ?? null,
    badgeIcon: input.badgeIcon ?? null,
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

export async function updateLeadershipLevelRecord(
  levelId: string,
  input: LeadershipLevelWriteModel,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('leadershipLevels')
    .doc(levelId)
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      displayOrder: input.displayOrder,
      badgeColor: input.badgeColor ?? null,
      badgeIcon: input.badgeIcon ?? null,
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
}

export async function setLeadershipLevelStatusRecord(
  levelId: string,
  status: LevelStatus,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('leadershipLevels')
    .doc(levelId)
    .update({ status, updatedAt: new Date(), updatedBy: actorUid });
}
