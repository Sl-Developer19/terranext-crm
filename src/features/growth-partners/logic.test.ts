import { describe, expect, it } from 'vitest';

import { canDecide, canToggleStatus } from './logic';

describe('canDecide', () => {
  it('allows a decision only while pending approval', () => {
    expect(canDecide('pending_approval')).toBe(true);
    expect(canDecide('active')).toBe(false);
    expect(canDecide('suspended')).toBe(false);
    expect(canDecide('rejected')).toBe(false);
  });
});

describe('canToggleStatus', () => {
  it('allows suspend/reactivate only for already-decided partners', () => {
    expect(canToggleStatus('active')).toBe(true);
    expect(canToggleStatus('suspended')).toBe(true);
    expect(canToggleStatus('pending_approval')).toBe(false);
    expect(canToggleStatus('rejected')).toBe(false);
  });
});
