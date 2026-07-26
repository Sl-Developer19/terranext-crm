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
