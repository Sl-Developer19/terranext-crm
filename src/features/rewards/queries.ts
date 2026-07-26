import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot, DocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type { RewardRule } from './schema';

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

async function resolveProgrammeNames(ids: unknown[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => typeof v === 'string'))];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const snap = await adminDb().collection('programmes').doc(id).get();
      map.set(id, typeof snap.get('name') === 'string' ? (snap.get('name') as string) : id);
    }),
  );
  return map;
}

function toRewardRule(
  doc: QueryDocumentSnapshot | DocumentSnapshot,
  programmeNames: Map<string, string>,
): RewardRule {
  const data = doc.data() ?? {};
  const programmeId = typeof data.programmeId === 'string' ? data.programmeId : null;
  return {
    id: doc.id,
    kind: data.kind,
    programmeId,
    programmeName: programmeId ? (programmeNames.get(programmeId) ?? programmeId) : null,
    amountPaise: typeof data.amountPaise === 'number' ? data.amountPaise : null,
    percentBps: typeof data.percentBps === 'number' ? data.percentBps : null,
    active: data.active === true,
    effectiveFrom: toIso(data.effectiveFrom) ?? '',
    createdAt: toIso(data.createdAt) ?? '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedAt: toIso(data.updatedAt) ?? '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  };
}

/** Directory read for /rewards (Doc 25 §3) — the full configured rule set. */
export async function listRewardRules(): Promise<RewardRule[]> {
  const snap = await adminDb().collection('rewardRules').orderBy('createdAt', 'desc').get();
  const programmeNames = await resolveProgrammeNames(snap.docs.map((d) => d.get('programmeId')));
  return snap.docs.map((doc) => toRewardRule(doc, programmeNames));
}
