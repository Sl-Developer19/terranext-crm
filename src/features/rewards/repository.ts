import 'server-only';

import { FieldValue, type Transaction } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { computeRewardAmount } from './logic';
import type { RewardRuleKind } from './schema';

/** Reward-engine data access (Doc 25 §10) — called from inside the fees
 * feature's own payment transaction (`recordPaymentRecord`), never a
 * separate transaction, so a reward and the payment that earned it always
 * commit or fail together. */

interface MatchedRule {
  id: string;
  kind: RewardRuleKind;
  amountPaise: number | null;
  percentBps: number | null;
}

/**
 * Reads (only — no writes) the active reward rule for a programme, if any.
 * Must run before any write in the caller's transaction (Firestore requires
 * every read to precede every write). Programme-specific rules win over the
 * universal (`programmeId: null`) rule.
 */
export async function matchActiveRewardRuleInTx(
  tx: Transaction,
  programmeId: string,
): Promise<MatchedRule | null> {
  const db = adminDb();
  const rules = db.collection('rewardRules');

  const specific = await tx.get(
    rules.where('programmeId', '==', programmeId).where('active', '==', true).limit(1),
  );
  const doc =
    specific.docs[0] ??
    (await tx.get(rules.where('programmeId', '==', null).where('active', '==', true).limit(1)))
      .docs[0];
  if (!doc) return null;

  return {
    id: doc.id,
    kind: doc.get('kind'),
    amountPaise: typeof doc.get('amountPaise') === 'number' ? doc.get('amountPaise') : null,
    percentBps: typeof doc.get('percentBps') === 'number' ? doc.get('percentBps') : null,
  };
}

export interface RewardWriteInput {
  partnerId: string;
  participantId: string;
  feeAccountId: string;
  paymentId: string;
  rule: MatchedRule;
  paymentAmountPaise: number;
}

/**
 * Writes the reward ledger entry, credits the wallet, and logs the wallet
 * transaction — all inside the caller's transaction (write-only; every read
 * this needs already happened in `matchActiveRewardRuleInTx`).
 */
export function writeRewardInTx(
  tx: Transaction,
  input: RewardWriteInput,
): { ledgerId: string; amountPaise: number } {
  const amountPaise = computeRewardAmount(input.rule, input.paymentAmountPaise);
  const db = adminDb();
  const now = new Date();

  const ledgerRef = db.collection('rewardLedger').doc();
  tx.set(ledgerRef, {
    schemaVersion: 1,
    partnerId: input.partnerId,
    participantId: input.participantId,
    feeAccountId: input.feeAccountId,
    paymentId: input.paymentId,
    ruleId: input.rule.id,
    amountPaise,
    status: 'accrued',
    createdAt: now,
  });

  const walletRef = db.collection('wallets').doc(input.partnerId);
  tx.set(
    walletRef,
    { partnerId: input.partnerId, balancePaise: FieldValue.increment(amountPaise), updatedAt: now },
    { merge: true },
  );

  const txRef = walletRef.collection('transactions').doc();
  tx.set(txRef, {
    schemaVersion: 1,
    kind: 'credit',
    amountPaise,
    reason: 'reward_generated',
    refLedgerId: ledgerRef.id,
    refPayoutId: null,
    createdAt: now,
  });

  return { ledgerId: ledgerRef.id, amountPaise };
}

/**
 * Reverses (claws back) the reward earned by a payment, when that payment
 * is itself reversed — called from inside `reversePaymentRecord`'s own
 * transaction (fees feature), same pattern as `writeRewardInTx`: reads
 * first (Firestore transaction rule), then writes alongside the reversal.
 *
 * A payment earns at most one reward, so this looks it up by `paymentId`
 * (no index needed beyond Firestore's automatic single-field index). Debits
 * the wallet by the reward's own amount regardless of whether it was still
 * `accrued` or already `paid` out — money already paid to the partner via a
 * payout still needs to come back out of their running balance; a wallet
 * can go negative from a clawback, representing an amount owed back,
 * netted against future earnings. Idempotent: a reward already
 * `clawed_back` (e.g. transaction retry, or double-reversal guarded
 * upstream by `reversePaymentRecord`'s own `already_reversed` check) is
 * left untouched rather than debited twice.
 */
export async function clawbackRewardInTx(
  tx: Transaction,
  paymentId: string,
): Promise<{ partnerId: string; amountPaise: number } | null> {
  const db = adminDb();
  const ledgerSnap = await tx.get(
    db.collection('rewardLedger').where('paymentId', '==', paymentId).limit(1),
  );
  const ledgerDoc = ledgerSnap.docs[0];
  if (!ledgerDoc) return null;
  if (ledgerDoc.get('status') === 'clawed_back') return null;

  const partnerId = ledgerDoc.get('partnerId') as string;
  const amountPaise = ledgerDoc.get('amountPaise') as number;
  const now = new Date();

  tx.update(ledgerDoc.ref, { status: 'clawed_back' });

  const walletRef = db.collection('wallets').doc(partnerId);
  tx.set(
    walletRef,
    { partnerId, balancePaise: FieldValue.increment(-amountPaise), updatedAt: now },
    { merge: true },
  );

  const walletTxRef = walletRef.collection('transactions').doc();
  tx.set(walletTxRef, {
    schemaVersion: 1,
    kind: 'debit',
    amountPaise,
    reason: 'reward_clawback',
    refLedgerId: ledgerDoc.id,
    refPayoutId: null,
    createdAt: now,
  });

  return { partnerId, amountPaise };
}

/**
 * Requests a payout for the partner's entire current balance (Doc 25 §13).
 * Transactional: the balance read and the request-doc write must see the
 * same balance, and a second concurrent request must not be allowed to slip
 * in against the same funds before the first is decided.
 */
export async function createPayoutRequestRecord(
  partnerId: string,
): Promise<
  | { kind: 'created'; payoutId: string; amountPaise: number }
  | { kind: 'no_balance' }
  | { kind: 'already_pending' }
> {
  const db = adminDb();
  const walletRef = db.collection('wallets').doc(partnerId);

  return db.runTransaction(async (tx) => {
    const [walletSnap, pendingSnap] = await Promise.all([
      tx.get(walletRef),
      tx.get(
        db
          .collection('payoutRequests')
          .where('partnerId', '==', partnerId)
          .where('status', 'in', ['requested', 'approved', 'processing'])
          .limit(1),
      ),
    ]);

    if (!pendingSnap.empty) return { kind: 'already_pending' };

    const balancePaise =
      typeof walletSnap.get('balancePaise') === 'number'
        ? (walletSnap.get('balancePaise') as number)
        : 0;
    if (balancePaise <= 0) return { kind: 'no_balance' };

    const ref = db.collection('payoutRequests').doc();
    tx.set(ref, {
      schemaVersion: 1,
      partnerId,
      amountPaise: balancePaise,
      status: 'requested',
      requestedAt: new Date(),
      decidedBy: null,
      decidedAt: null,
      paidAt: null,
      reason: null,
    });

    return { kind: 'created', payoutId: ref.id, amountPaise: balancePaise };
  });
}

/**
 * Approves or rejects a requested payout (Doc 25 §9/§13) — no wallet
 * movement either way. Transactional so two concurrent decisions on the
 * same payout (e.g. two approvers clicking at once) can't both win: the
 * `status === 'requested'` check and the update happen atomically, matching
 * the same TOCTOU-avoidance pattern as `markPayoutPaidRecord` below.
 */
export async function decidePayoutRecord(
  payoutId: string,
  decision: 'approve' | 'reject',
  actorUid: string,
  reason: string | undefined,
): Promise<'decided' | 'not_found' | 'not_pending'> {
  const db = adminDb();
  const ref = db.collection('payoutRequests').doc(payoutId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'not_found';
    if (snap.get('status') !== 'requested') return 'not_pending';

    tx.update(ref, {
      status: decision === 'approve' ? 'approved' : 'rejected',
      decidedBy: actorUid,
      decidedAt: new Date(),
      reason: reason ?? null,
    });
    return 'decided';
  });
}

/**
 * Finalizes an approved payout (Doc 25 §13): debits the wallet by exactly
 * the payout's own amount, logs the debit transaction, and marks every
 * `accrued` ledger entry for this partner as `paid` — all in one
 * transaction, so the wallet and the ledger can never disagree about what's
 * been paid.
 */
export async function markPayoutPaidRecord(
  payoutId: string,
): Promise<
  | { kind: 'paid'; partnerId: string; amountPaise: number }
  | { kind: 'not_found' }
  | { kind: 'not_approved' }
> {
  const db = adminDb();
  const payoutRef = db.collection('payoutRequests').doc(payoutId);

  return db.runTransaction(async (tx) => {
    const payoutSnap = await tx.get(payoutRef);
    if (!payoutSnap.exists) return { kind: 'not_found' };
    if (payoutSnap.get('status') !== 'approved') return { kind: 'not_approved' };

    const partnerId = payoutSnap.get('partnerId') as string;
    const amountPaise = payoutSnap.get('amountPaise') as number;
    const requestedAt = payoutSnap.get('requestedAt');
    const walletRef = db.collection('wallets').doc(partnerId);

    // A request always covers the partner's *entire* balance at request time
    // (schema.ts's own documented invariant) — so only ledger entries that
    // already existed then may be flipped to `paid` here. Without this bound,
    // a reward accrued after the request (but before this mark-paid step
    // runs) would be marked `paid` even though its amount was never part of
    // `amountPaise` and was never actually disbursed.
    const accruedSnap = await tx.get(
      db
        .collection('rewardLedger')
        .where('partnerId', '==', partnerId)
        .where('status', '==', 'accrued')
        .where('createdAt', '<=', requestedAt),
    );

    const now = new Date();
    tx.update(walletRef, { balancePaise: FieldValue.increment(-amountPaise), updatedAt: now });

    const walletTxRef = walletRef.collection('transactions').doc();
    tx.set(walletTxRef, {
      schemaVersion: 1,
      kind: 'debit',
      amountPaise,
      reason: 'payout_paid',
      refLedgerId: null,
      refPayoutId: payoutId,
      createdAt: now,
    });

    for (const doc of accruedSnap.docs) {
      tx.update(doc.ref, { status: 'paid' });
    }

    tx.update(payoutRef, { status: 'paid', paidAt: now });

    return { kind: 'paid', partnerId, amountPaise };
  });
}
