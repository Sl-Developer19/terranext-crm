import { z } from 'zod';

/**
 * Growth Partner leadership/recognition tiers (Settings §3) — admin-defined,
 * not hardcoded. Previously `bronze | silver | gold | platinum` was a fixed
 * TypeScript union in `growth-partners/schema.ts`; `GrowthPartner.leadershipLevel`
 * is now a free-text slug referencing a document here, so a Founder can add,
 * rename, reorder, or archive tiers with no code change or redeploy.
 *
 * Archived (not deleted) — same "never hard-delete reference data" posture
 * as `catalogue`'s academies/programmes (Doc 03 §4): an archived level stays
 * resolvable for any partner already on it, it's just excluded from the
 * picker when assigning a level going forward.
 */

export const LEVEL_STATUSES = ['active', 'archived'] as const;
export type LevelStatus = (typeof LEVEL_STATUSES)[number];

const slug = z
  .string()
  .trim()
  .min(2, 'Slug is required')
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only');

const badgeColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a 6-digit hex colour, e.g. #C9A227')
  .optional()
  .or(z.literal(''));

/** Lucide icon name — not validated against a hardcoded icon allow-list,
 * same reasoning as `catalogue/schema.ts`'s academy icon field. */
const badgeIcon = z.string().trim().max(60).optional().or(z.literal(''));

export const leadershipLevelSchema = z
  .object({
    name: z.string().trim().min(2, 'Level name is required').max(60),
    slug,
    description: z.string().trim().max(300).optional().or(z.literal('')),
    displayOrder: z.number().int().min(0).max(9999),
    badgeColor,
    badgeIcon,
  })
  .strict();

export type LeadershipLevelInput = z.infer<typeof leadershipLevelSchema>;

export const updateLeadershipLevelSchema = leadershipLevelSchema
  .extend({ levelId: z.string().min(1) })
  .strict();
export type UpdateLeadershipLevelInput = z.infer<typeof updateLeadershipLevelSchema>;

export const setLeadershipLevelStatusSchema = z
  .object({ levelId: z.string().min(1), status: z.enum(LEVEL_STATUSES) })
  .strict();
export type SetLeadershipLevelStatusInput = z.infer<typeof setLeadershipLevelStatusSchema>;

/** Staff assigning/changing a specific partner's level — separate from
 * defining what levels exist (this schema), see growth-partners feature. */

/* ── Read model ────────────────────────────────────────────────────────── */

export interface LeadershipLevelDefinition {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  badgeColor: string | null;
  badgeIcon: string | null;
  status: LevelStatus;
  /** How many Growth Partners currently reference this level's slug. */
  partnerCount: number;
}
