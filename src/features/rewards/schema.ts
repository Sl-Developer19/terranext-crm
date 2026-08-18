import { z } from 'zod';

/**
 * Reward rule configuration (Doc 25 §3/§4). Reward *amounts* are never
 * hardcoded (GPMS brief requirement) — every reward computed in slice 4
 * reads the active rule matching the enrolment's programme (or the universal
 * `programmeId: null` rule) at payment time.
 */

export const REWARD_RULE_KINDS = ['flat', 'percent'] as const;
export type RewardRuleKind = (typeof REWARD_RULE_KINDS)[number];

export const createRewardRuleSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('flat'),
      programmeId: z.string().trim().min(1).nullable(),
      amountPaise: z.number().int().positive('Enter a positive amount'),
    }),
    z.object({
      kind: z.literal('percent'),
      programmeId: z.string().trim().min(1).nullable(),
      // Basis points: 500 = 5.00%.
      percentBps: z.number().int().min(1).max(10_000, 'Must be 100% or less'),
    }),
  ])
  .and(z.object({ effectiveFrom: z.string().datetime() }));

export type CreateRewardRuleInput = z.infer<typeof createRewardRuleSchema>;

export const setRewardRuleActiveSchema = z
  .object({
    ruleId: z.string().min(1),
    active: z.boolean(),
  })
  .strict();

export type SetRewardRuleActiveInput = z.infer<typeof setRewardRuleActiveSchema>;

export interface RewardRule {
  id: string;
  kind: RewardRuleKind;
  programmeId: string | null;
  programmeName: string | null;
  amountPaise: number | null;
  percentBps: number | null;
  active: boolean;
  effectiveFrom: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * A reward accrual (Doc 25 §4/§10) — one immutable entry per successful
 * payment that matched an active rule, same append-only posture as
 * `auditLogs` (ADR-007). `status` moves accrued -> paid (payout workflow,
 * slice 5) or accrued|paid -> clawed_back, when the payment that earned it
 * is later reversed (`reversePaymentRecord`, same transaction as the
 * reversal) — a bounced/refunded payment must not leave the partner holding
 * a reward for money the organisation no longer has.
 */
export const REWARD_LEDGER_STATUSES = ['accrued', 'paid', 'clawed_back'] as const;
export type RewardLedgerStatus = (typeof REWARD_LEDGER_STATUSES)[number];

export interface RewardLedgerEntry {
  id: string;
  partnerId: string;
  participantId: string;
  feeAccountId: string;
  paymentId: string;
  ruleId: string;
  amountPaise: number;
  status: RewardLedgerStatus;
  createdAt: string;
}

/** Doc 25 §12 — one wallet per partner; `balancePaise` moves only inside the
 * same transaction as a `walletTransactions` entry (never a bare counter write). */
export interface Wallet {
  partnerId: string;
  balancePaise: number;
  updatedAt: string;
}

export const WALLET_TRANSACTION_KINDS = ['credit', 'debit'] as const;
export type WalletTransactionKind = (typeof WALLET_TRANSACTION_KINDS)[number];

export interface WalletTransaction {
  id: string;
  kind: WalletTransactionKind;
  amountPaise: number;
  reason: string;
  refLedgerId: string | null;
  refPayoutId: string | null;
  createdAt: string;
}

/**
 * Payout requests (Doc 25 §13). A request is always for the partner's
 * *entire* current wallet balance at request time — never an arbitrary
 * partner-typed amount — so a paid payout can always debit the wallet by
 * exactly its own `amountPaise` with no partial-reconciliation logic
 * against individual reward ledger entries. `processing` is a valid status
 * for reporting; this build's workflow moves requested -> approved/rejected
 * -> paid directly (a manual "start processing" step is a natural
 * follow-up, not required for a correct payout).
 */
export const PAYOUT_STATUSES = ['requested', 'approved', 'rejected', 'processing', 'paid'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export interface PayoutRequest {
  id: string;
  partnerId: string;
  partnerName: string | null;
  amountPaise: number;
  status: PayoutStatus;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  paidAt: string | null;
  reason: string | null;
}

export const decidePayoutSchema = z
  .object({
    payoutId: z.string().min(1),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .strict();

export type DecidePayoutInput = z.infer<typeof decidePayoutSchema>;

export const markPayoutPaidSchema = z
  .object({
    payoutId: z.string().min(1),
  })
  .strict();

export type MarkPayoutPaidInput = z.infer<typeof markPayoutPaidSchema>;
