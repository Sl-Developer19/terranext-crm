import type { RewardRuleKind } from './schema';

/**
 * Pure reward computation (Doc 25 §10/§11), no I/O. Amounts are never
 * hardcoded — every call takes the matched rule's configured value.
 */
export function computeRewardAmount(
  rule: { kind: RewardRuleKind; amountPaise: number | null; percentBps: number | null },
  paymentAmountPaise: number,
): number {
  if (rule.kind === 'flat') return rule.amountPaise ?? 0;
  const percentBps = rule.percentBps ?? 0;
  return Math.round((paymentAmountPaise * percentBps) / 10_000);
}
