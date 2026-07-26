/** Public API of the rewards feature (Doc 02 §3). */
export { RewardRulesTable } from './components/reward-rules-table';
export { CreateRewardRuleDialog } from './components/create-reward-rule-dialog';
export { listRewardRules } from './queries';
export {
  REWARD_RULE_KINDS,
  createRewardRuleSchema,
  setRewardRuleActiveSchema,
  type RewardRule,
  type RewardRuleKind,
  type CreateRewardRuleInput,
  type SetRewardRuleActiveInput,
} from './schema';
