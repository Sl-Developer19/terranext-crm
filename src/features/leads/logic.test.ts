import { describe, expect, it } from 'vitest';

import { computeLeadTimeline, isLeadRowScoped, isStageTransition } from './logic';

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

describe('computeLeadTimeline (Doc 25 §5)', () => {
  it('marks only "submitted" complete for a brand-new, unassigned lead', () => {
    const steps = computeLeadTimeline({ stage: 'new', assignedToUid: null, participantId: null });
    expect(steps[0]).toMatchObject({ id: 'submitted', status: 'complete' });
    expect(steps[1]).toMatchObject({ id: 'assigned', status: 'current' });
    expect(steps.slice(2).every((s) => s.status === 'pending')).toBe(true);
  });

  it('marks admission complete once a participant exists, payment/reward still pending', () => {
    const steps = computeLeadTimeline({
      stage: 'admitted',
      assignedToUid: 'uid-1',
      participantId: 'P-2026-000123',
    });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s.status]));
    expect(byId.submitted).toBe('complete');
    expect(byId.assigned).toBe('complete');
    expect(byId.counselling).toBe('complete');
    expect(byId.application).toBe('complete');
    expect(byId.admission).toBe('complete');
    expect(byId.payment_pending).toBe('current');
    expect(byId.reward_generated).toBe('pending');
  });

  it('marks every step complete once payment succeeds and the reward is paid', () => {
    const steps = computeLeadTimeline({
      stage: 'admitted',
      assignedToUid: 'uid-1',
      participantId: 'P-2026-000123',
      paymentStatus: 'successful',
      rewardStatus: 'paid',
    });
    expect(steps.every((s) => s.status === 'complete')).toBe(true);
  });
});
