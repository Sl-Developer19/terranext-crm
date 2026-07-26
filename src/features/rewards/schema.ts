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
 * `auditLogs` (ADR-007). `status` only ever moves accrued -> paid, driven by
 * the payout workflow (slice 5), never edited directly.
 */
export const REWARD_LEDGER_STATUSES = ['accrued', 'paid'] as const;
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
