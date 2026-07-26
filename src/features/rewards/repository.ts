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
