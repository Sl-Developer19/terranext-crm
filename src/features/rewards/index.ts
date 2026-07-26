/** Public API of the rewards feature (Doc 02 §3). */
export { RewardRulesTable } from './components/reward-rules-table';
export { CreateRewardRuleDialog } from './components/create-reward-rule-dialog';
export { RewardLedgerTable } from './components/reward-ledger-table';
export { PayoutRequestsTable } from './components/payout-requests-table';
export { RequestPayoutButton } from './components/request-payout-button';
export { PartnerPayoutHistory } from './components/partner-payout-history';
export { LeaderboardTable } from './components/leaderboard-table';
export {
  listRewardRules,
  listPartnerRewardLedger,
  listAllRewardLedger,
  getWallet,
  listWalletTransactions,
  listPayoutRequests,
  listPartnerPayoutRequests,
  getRewardLeaderboard,
} from './queries';
export { computeRewardAmount, rankPartnersByRewards, type LeaderboardEntry } from './logic';
export {
  REWARD_RULE_KINDS,
  REWARD_LEDGER_STATUSES,
  WALLET_TRANSACTION_KINDS,
  PAYOUT_STATUSES,
  createRewardRuleSchema,
  setRewardRuleActiveSchema,
  decidePayoutSchema,
  markPayoutPaidSchema,
  type RewardRule,
  type RewardRuleKind,
  type RewardLedgerEntry,
  type RewardLedgerStatus,
  type Wallet,
  type WalletTransaction,
  type WalletTransactionKind,
  type PayoutRequest,
  type PayoutStatus,
  type CreateRewardRuleInput,
  type SetRewardRuleActiveInput,
  type DecidePayoutInput,
  type MarkPayoutPaidInput,
} from './schema';
