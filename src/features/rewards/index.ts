/** Public API of the rewards feature (Doc 02 §3). */
export { RewardRulesTable } from './components/reward-rules-table';
export { CreateRewardRuleDialog } from './components/create-reward-rule-dialog';
export { RewardLedgerTable } from './components/reward-ledger-table';
export {
  listRewardRules,
  listPartnerRewardLedger,
  listAllRewardLedger,
  getWallet,
  listWalletTransactions,
} from './queries';
export { computeRewardAmount } from './logic';
export {
  REWARD_RULE_KINDS,
  REWARD_LEDGER_STATUSES,
  WALLET_TRANSACTION_KINDS,
  createRewardRuleSchema,
  setRewardRuleActiveSchema,
  type RewardRule,
  type RewardRuleKind,
  type RewardLedgerEntry,
  type RewardLedgerStatus,
  type Wallet,
  type WalletTransaction,
  type WalletTransactionKind,
  type CreateRewardRuleInput,
  type SetRewardRuleActiveInput,
} from './schema';
