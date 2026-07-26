import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot, DocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type { RewardLedgerEntry, RewardRule, Wallet, WalletTransaction } from './schema';

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

function toLedgerEntry(doc: QueryDocumentSnapshot | DocumentSnapshot): RewardLedgerEntry {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    partnerId: typeof data.partnerId === 'string' ? data.partnerId : '',
    participantId: typeof data.participantId === 'string' ? data.participantId : '',
    feeAccountId: typeof data.feeAccountId === 'string' ? data.feeAccountId : '',
    paymentId: typeof data.paymentId === 'string' ? data.paymentId : '',
    ruleId: typeof data.ruleId === 'string' ? data.ruleId : '',
    amountPaise: typeof data.amountPaise === 'number' ? data.amountPaise : 0,
    status: data.status,
    createdAt: toIso(data.createdAt) ?? '',
  };
}

/** Doc 25 §12 — a partner's own reward ledger, row-scoped by partnerId. */
export async function listPartnerRewardLedger(partnerId: string): Promise<RewardLedgerEntry[]> {
  const snap = await adminDb()
    .collection('rewardLedger')
    .where('partnerId', '==', partnerId)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  return snap.docs.map(toLedgerEntry);
}

/** Every reward ledger entry, org-wide (Doc 25 §13 accounting/reports). */
export async function listAllRewardLedger(): Promise<RewardLedgerEntry[]> {
  const snap = await adminDb()
    .collection('rewardLedger')
    .orderBy('createdAt', 'desc')
    .limit(1000)
    .get();
  return snap.docs.map(toLedgerEntry);
}

/** Doc 25 §12 — a partner's wallet; `null` balance reads as zero (no reward yet). */
export async function getWallet(partnerId: string): Promise<Wallet> {
  const snap = await adminDb().collection('wallets').doc(partnerId).get();
  return {
    partnerId,
    balancePaise:
      typeof snap.get('balancePaise') === 'number' ? (snap.get('balancePaise') as number) : 0,
    updatedAt: toIso(snap.get('updatedAt')) ?? '',
  };
}

export async function listWalletTransactions(partnerId: string): Promise<WalletTransaction[]> {
  const snap = await adminDb()
    .collection('wallets')
    .doc(partnerId)
    .collection('transactions')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      kind: data.kind,
      amountPaise: typeof data.amountPaise === 'number' ? data.amountPaise : 0,
      reason: typeof data.reason === 'string' ? data.reason : '',
      refLedgerId: typeof data.refLedgerId === 'string' ? data.refLedgerId : null,
      refPayoutId: typeof data.refPayoutId === 'string' ? data.refPayoutId : null,
      createdAt: toIso(data.createdAt) ?? '',
    };
  });
}
