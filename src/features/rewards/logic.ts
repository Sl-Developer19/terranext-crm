import type { RewardLedgerStatus, RewardRuleKind } from './schema';

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

export interface LeaderboardEntry {
  partnerId: string;
  partnerName: string;
  totalPaise: number;
  rank: number;
}

/**
 * Ranks partners by total reward earnings — accrued and paid combined, so a
 * partner isn't penalised in ranking for not having been paid out yet
 * (Doc 25 §6 "Top/Lowest Performing Partners"). Highest first; the full
 * ordered list doubles as both ends of the leaderboard, no separate
 * "lowest performing" query needed.
 */
export function rankPartnersByRewards(
  entries: readonly {
    partnerId: string;
    partnerName: string;
    amountPaise: number;
    status: RewardLedgerStatus;
  }[],
): LeaderboardEntry[] {
  const totals = new Map<string, { partnerName: string; totalPaise: number }>();
  for (const entry of entries) {
    // Accrued + paid only, per the leaderboard's own stated scope above — a
    // clawed-back reward was reversed (the wallet was debited back to zero
    // for it), so it must not still count toward the partner's ranking.
    if (entry.status === 'clawed_back') continue;
    const existing = totals.get(entry.partnerId) ?? {
      partnerName: entry.partnerName,
      totalPaise: 0,
    };
    existing.totalPaise += entry.amountPaise;
    totals.set(entry.partnerId, existing);
  }

  return [...totals.entries()]
    .map(([partnerId, v]) => ({ partnerId, partnerName: v.partnerName, totalPaise: v.totalPaise }))
    .sort((a, b) => b.totalPaise - a.totalPaise)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
