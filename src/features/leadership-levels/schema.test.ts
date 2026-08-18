import { describe, expect, it } from 'vitest';

import { leadershipLevelSchema } from './schema';

const base = {
  name: 'Gold',
  slug: 'gold',
  description: '',
  displayOrder: 20,
  badgeColor: '',
  badgeIcon: '',
};

describe('leadershipLevelSchema', () => {
  it('accepts a fully populated level', () => {
    const result = leadershipLevelSchema.safeParse({
      ...base,
      badgeColor: '#C9A227',
      badgeIcon: 'award',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a level with no badge colour/icon set (both optional)', () => {
    expect(leadershipLevelSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a slug with uppercase letters or spaces', () => {
    expect(leadershipLevelSchema.safeParse({ ...base, slug: 'Gold Tier' }).success).toBe(false);
  });

  it('rejects a negative display order', () => {
    expect(leadershipLevelSchema.safeParse({ ...base, displayOrder: -1 }).success).toBe(false);
  });

  it.each(['C9A227', '#C9A22', '#GGGGGG'])('rejects a malformed badge colour: %s', (badgeColor) => {
    expect(leadershipLevelSchema.safeParse({ ...base, badgeColor }).success).toBe(false);
  });

  it('rejects a name shorter than 2 characters', () => {
    expect(leadershipLevelSchema.safeParse({ ...base, name: 'G' }).success).toBe(false);
  });
});
