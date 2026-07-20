import { describe, expect, it } from 'vitest';

import { isLeadRowScoped, isStageTransition } from './logic';

describe('isLeadRowScoped (Doc 10 §2 row-level scope)', () => {
  it('denies a consultant acting on a lead assigned to someone else', () => {
    expect(isLeadRowScoped('consultant', 'other-uid', 'me')).toBe(true);
  });

  it('denies a consultant acting on an unassigned lead', () => {
    expect(isLeadRowScoped('consultant', null, 'me')).toBe(true);
  });

  it('allows a consultant acting on their own assigned lead', () => {
    expect(isLeadRowScoped('consultant', 'me', 'me')).toBe(false);
  });

  it('never scopes ops_manager or founder regardless of assignment', () => {
    expect(isLeadRowScoped('ops_manager', 'other-uid', 'me')).toBe(false);
    expect(isLeadRowScoped('founder', null, 'me')).toBe(false);
  });
});

describe('isStageTransition', () => {
  it('is false when no stage was requested', () => {
    expect(isStageTransition('new', undefined)).toBe(false);
  });

  it('is false when the requested stage matches the current one', () => {
    expect(isStageTransition('new', 'new')).toBe(false);
  });

  it('is true when the requested stage differs from the current one', () => {
    expect(isStageTransition('new', 'contacted')).toBe(true);
  });
});
