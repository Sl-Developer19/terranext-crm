import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import {
  allocateInstallments,
  calculateBalance,
  dueDateFromOffset,
  financialYear,
  formatReceiptNo,
  isPaymentWithinBalance,
  nextDueDate,
  sumLedger,
} from './logic';
import type { FeeAccount, FeeInstallment, PaymentMethod, Payment, PendingFeeRow } from './schema';

/** Fee data access (Doc 03 §1.7, ADR-012). */

const RECEIPT_COUNTER = 'receiptNo';
const RECEIPT_PREFIX = 'RCP';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toInstallments(value: unknown): FeeInstallment[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    return {
      label: asString(entry.label),
      amountPaise: asNumber(entry.amountPaise),
      dueDate: asString(entry.dueDate),
      status: (entry.status as FeeInstallment['status']) ?? 'pending',
    };
  });
}

function toFeeAccount(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  participantName: string | null,
  programmeName: string | null,
): FeeAccount {
  const data = doc.data() ?? {};
  const plan = (data.plan ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    participantId: asString(data.participantId),
    participantName,
    programmeId: asString(data.programmeId),
    programmeName,
    totalPaise: asNumber(plan.totalPaise),
    discountPaise: asNumber(plan.discountPaise),
    discountApprovedBy: asStringOrNull(plan.discountApprovedBy),
    installments: toInstallments(plan.installments),
    paidPaise: asNumber(data.paidPaise),
    balancePaise: asNumber(data.balancePaise),
    nextDueDate: asStringOrNull(data.nextDueDate),
  };
}

/** Resolves only the participant/programme ids actually referenced — never a full collection scan. */
async function nameMaps(participantIds: Iterable<string>, programmeIds: Iterable<string>) {
  const db = adminDb();
  const uniqueParticipants = [...new Set(participantIds)].filter((id) => id.length > 0);
  const uniqueProgrammes = [...new Set(programmeIds)].filter((id) => id.length > 0);

  const [participantDocs, programmeDocs] = await Promise.all([
    Promise.all(uniqueParticipants.map((id) => db.collection('participants').doc(id).get())),
    Promise.all(uniqueProgrammes.map((id) => db.collection('programmes').doc(id).get())),
  ]);

  return {
    participants: new Map(
      participantDocs.map((d) => {
        const personal = (d.get('personal') ?? {}) as Record<string, unknown>;
        return [d.id, asString(personal.fullName)];
      }),
    ),
    programmes: new Map(programmeDocs.map((d) => [d.id, asString(d.get('name'))])),
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function findFeeAccounts(): Promise<FeeAccount[]> {
  const snap = await adminDb()
    .collection('feeAccounts')
    .orderBy('balancePaise', 'desc')
    .limit(200)
    .get();
  const names = await nameMaps(
    snap.docs.map((d) => asString(d.get('participantId'))),
    snap.docs.map((d) => asString(d.get('programmeId'))),
  );
  return snap.docs.map((doc) =>
    toFeeAccount(
      doc,
      names.participants.get(asString(doc.get('participantId'))) ?? null,
      names.programmes.get(asString(doc.get('programmeId'))) ?? null,
    ),
  );
}

export async function findFeeAccountById(feeAccountId: string): Promise<FeeAccount | null> {
  const snap = await adminDb().collection('feeAccounts').doc(feeAccountId).get();
  if (!snap.exists) return null;
  const names = await nameMaps(
    [asString(snap.get('participantId'))],
    [asString(snap.get('programmeId'))],
  );
  return toFeeAccount(
    snap,
    names.participants.get(asString(snap.get('participantId'))) ?? null,
    names.programmes.get(asString(snap.get('programmeId'))) ?? null,
  );
}

export async function findPayments(feeAccountId: string): Promise<Payment[]> {
  const snap = await adminDb()
    .collection('feeAccounts')
    .doc(feeAccountId)
    .collection('payments')
    .orderBy('receivedAt', 'desc')
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    amountPaise: asNumber(doc.get('amountPaise')),
    method: (doc.get('method') as PaymentMethod) ?? 'other',
    receivedAt: toIso(doc.get('receivedAt')) ?? '',
    receivedBy: asString(doc.get('receivedBy')),
    receiptNo: asString(doc.get('receiptNo')),
    note: asStringOrNull(doc.get('note')),
    reversesPaymentId: asStringOrNull(doc.get('reversesPaymentId')),
    reversedByPaymentId: asStringOrNull(doc.get('reversedByPaymentId')),
  }));
}

export async function findPendingFees(): Promise<PendingFeeRow[]> {
  const snap = await adminDb()
    .collection('feeAccounts')
    .where('balancePaise', '>', 0)
    .orderBy('balancePaise', 'desc')
    .limit(200)
    .get();
  const names = await nameMaps(
    snap.docs.map((d) => asString(d.get('participantId'))),
    snap.docs.map((d) => asString(d.get('programmeId'))),
  );

  const today = new Date().toISOString().slice(0, 10);
  return snap.docs.map((doc) => {
    const due = asStringOrNull(doc.get('nextDueDate'));
    return {
      feeAccountId: doc.id,
      participantId: asString(doc.get('participantId')),
      participantName: names.participants.get(asString(doc.get('participantId'))) ?? '',
      programmeName: names.programmes.get(asString(doc.get('programmeId'))) ?? null,
      balancePaise: asNumber(doc.get('balancePaise')),
      nextDueDate: due,
      overdue: due !== null && due < today,
    };
  });
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface CreateFeeAccountRecord {
  participantId: string;
  enrolmentId: string;
  programmeId: string;
  enrolledAt: Date;
  totalPaise: number;
  planInstallments: ReadonlyArray<{ label: string; amountPaise: number; dueOffsetDays: number }>;
  actorUid: string;
  branchId: string;
}

/**
 * Creates the fee account for an enrolment, seeded from the programme's
 * default plan. Doc ID = enrolment ID, so an enrolment can only ever have
 * one account — the uniqueness is structural, not enforced by a query.
 */
export async function createFeeAccountRecord(record: CreateFeeAccountRecord): Promise<boolean> {
  const ref = adminDb().collection('feeAccounts').doc(record.enrolmentId);
  const existing = await ref.get();
  if (existing.exists) return false;

  const installments: FeeInstallment[] = record.planInstallments.map((installment) => ({
    label: installment.label,
    amountPaise: installment.amountPaise,
    dueDate: dueDateFromOffset(record.enrolledAt, installment.dueOffsetDays),
    status: 'pending',
  }));

  const allocated = allocateInstallments(installments, 0, new Date());
  const now = new Date();

  await ref.set({
    schemaVersion: 1,
    branchId: record.branchId,
    participantId: record.participantId,
    enrolmentId: record.enrolmentId,
    programmeId: record.programmeId,
    plan: {
      totalPaise: record.totalPaise,
      discountPaise: 0,
      discountApprovedBy: null,
      installments: allocated,
    },
    paidPaise: 0,
    balancePaise: record.totalPaise,
    nextDueDate: nextDueDate(allocated),
    createdAt: now,
    createdBy: record.actorUid,
    updatedAt: now,
    updatedBy: record.actorUid,
  });

  return true;
}

export type PaymentOutcome =
  | { kind: 'recorded'; paymentId: string; receiptNo: string }
  | { kind: 'exceeds_balance'; balancePaise: number }
  | { kind: 'account_missing' };

/**
 * Records a payment (Doc 19 `recordPaymentAction`).
 *
 * Everything happens in one transaction: mint the receipt number from the
 * per-FY counter, append the ledger entry, then recompute paid/balance and
 * re-allocate installments from the ledger total. Recomputing rather than
 * incrementing means a retried transaction cannot double-count, and the
 * stored balance is always derivable from the ledger.
 */
export async function recordPaymentRecord(
  feeAccountId: string,
  input: {
    amountPaise: number;
    method: PaymentMethod;
    receivedAt: Date;
    note: string | null;
  },
  actorUid: string,
): Promise<PaymentOutcome> {
  const db = adminDb();
  const accountRef = db.collection('feeAccounts').doc(feeAccountId);
  const paymentsRef = accountRef.collection('payments');
  const counterRef = db.collection('counters').doc(RECEIPT_COUNTER);

  // Existing ledger is read outside the transaction (a subcollection query
  // is not transactional), then the new total is derived inside it from that
  // snapshot plus this payment. The account document read inside the
  // transaction is what serialises concurrent payments.
  const existingLedger = await paymentsRef.get();
  const priorPaid = sumLedger(
    existingLedger.docs.map((d) => ({ amountPaise: asNumber(d.get('amountPaise')) })),
  );

  const fy = financialYear(input.receivedAt);

  return db.runTransaction(async (tx) => {
    const accountSnap = await tx.get(accountRef);
    if (!accountSnap.exists) return { kind: 'account_missing' };

    const plan = (accountSnap.get('plan') ?? {}) as Record<string, unknown>;
    const totalPaise = asNumber(plan.totalPaise);
    const discountPaise = asNumber(plan.discountPaise);
    const balance = calculateBalance(totalPaise, discountPaise, priorPaid);

    if (!isPaymentWithinBalance(input.amountPaise, balance)) {
      return { kind: 'exceeds_balance', balancePaise: balance };
    }

    const counterSnap = await tx.get(counterRef);
    // The receipt sequence resets each financial year (Doc 14 §3), so a
    // counter left over from a previous FY restarts rather than continuing.
    const storedFy = counterSnap.exists ? asString(counterSnap.get('year')) : '';
    const current =
      counterSnap.exists && storedFy === fy ? asNumber(counterSnap.get('current')) : 0;
    const next = current + 1;
    const receiptNo = formatReceiptNo(RECEIPT_PREFIX, fy, next);

    tx.set(counterRef, { current: next, prefix: RECEIPT_PREFIX, year: fy }, { merge: true });

    const paymentRef = paymentsRef.doc();
    tx.set(paymentRef, {
      schemaVersion: 1,
      amountPaise: input.amountPaise,
      method: input.method,
      receivedAt: input.receivedAt,
      receivedBy: actorUid,
      receiptNo,
      note: input.note,
      reversesPaymentId: null,
      reversedByPaymentId: null,
      createdAt: new Date(),
      createdBy: actorUid,
    });

    const paidPaise = priorPaid + input.amountPaise;
    const allocated = allocateInstallments(
      toInstallments(plan.installments),
      paidPaise,
      new Date(),
    );

    tx.update(accountRef, {
      paidPaise,
      balancePaise: calculateBalance(totalPaise, discountPaise, paidPaise),
      'plan.installments': allocated,
      nextDueDate: nextDueDate(allocated),
      updatedAt: new Date(),
      updatedBy: actorUid,
    });

    return { kind: 'recorded', paymentId: paymentRef.id, receiptNo };
  });
}

/**
 * Reverses a payment with a compensating negative entry (Doc 03 §1.7:
 * payments are append-only — a correction is a new entry, never an edit or
 * a delete, so the ledger remains a complete record of what happened).
 */
export async function reversePaymentRecord(
  feeAccountId: string,
  paymentId: string,
  reason: string,
  actorUid: string,
): Promise<'reversed' | 'not_found' | 'already_reversed'> {
  const db = adminDb();
  const accountRef = db.collection('feeAccounts').doc(feeAccountId);
  const paymentsRef = accountRef.collection('payments');

  const original = await paymentsRef.doc(paymentId).get();
  if (!original.exists) return 'not_found';
  if (asStringOrNull(original.get('reversedByPaymentId'))) return 'already_reversed';

  const ledger = await paymentsRef.get();
  const priorPaid = sumLedger(
    ledger.docs.map((d) => ({ amountPaise: asNumber(d.get('amountPaise')) })),
  );
  const amount = asNumber(original.get('amountPaise'));
  const now = new Date();

  await db.runTransaction(async (tx) => {
    const accountSnap = await tx.get(accountRef);
    const plan = (accountSnap.get('plan') ?? {}) as Record<string, unknown>;
    const totalPaise = asNumber(plan.totalPaise);
    const discountPaise = asNumber(plan.discountPaise);

    const reversalRef = paymentsRef.doc();
    tx.set(reversalRef, {
      schemaVersion: 1,
      amountPaise: -amount,
      method: original.get('method'),
      receivedAt: now,
      receivedBy: actorUid,
      receiptNo: `${asString(original.get('receiptNo'))}-REV`,
      note: reason,
      reversesPaymentId: paymentId,
      reversedByPaymentId: null,
      createdAt: now,
      createdBy: actorUid,
    });
    tx.update(paymentsRef.doc(paymentId), { reversedByPaymentId: reversalRef.id });

    const paidPaise = priorPaid - amount;
    const allocated = allocateInstallments(toInstallments(plan.installments), paidPaise, now);

    tx.update(accountRef, {
      paidPaise,
      balancePaise: calculateBalance(totalPaise, discountPaise, paidPaise),
      'plan.installments': allocated,
      nextDueDate: nextDueDate(allocated),
      updatedAt: now,
      updatedBy: actorUid,
    });
  });

  return 'reversed';
}

export async function applyDiscountRecord(
  feeAccountId: string,
  discountPaise: number,
  approvedBy: string,
): Promise<void> {
  const db = adminDb();
  const accountRef = db.collection('feeAccounts').doc(feeAccountId);
  const now = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(accountRef);
    const plan = (snap.get('plan') ?? {}) as Record<string, unknown>;
    const totalPaise = asNumber(plan.totalPaise);
    const paidPaise = asNumber(snap.get('paidPaise'));

    tx.update(accountRef, {
      'plan.discountPaise': discountPaise,
      'plan.discountApprovedBy': approvedBy,
      balancePaise: calculateBalance(totalPaise, discountPaise, paidPaise),
      updatedAt: now,
      updatedBy: approvedBy,
    });
  });
}
