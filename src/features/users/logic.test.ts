import { describe, expect, it } from 'vitest';

import { isSelfTargeting, wouldStrandPlatform } from './logic';

describe('user-management governance rules', () => {
  it('blocks removing the last active system_admin', () => {
    expect(wouldStrandPlatform(0)).toBe(true);
    expect(wouldStrandPlatform(1)).toBe(false);
    expect(wouldStrandPlatform(2)).toBe(false);
  });

  it('detects self-targeting role/status changes', () => {
    expect(isSelfTargeting('uid_1', 'uid_1')).toBe(true);
    expect(isSelfTargeting('uid_1', 'uid_2')).toBe(false);
  });
});
