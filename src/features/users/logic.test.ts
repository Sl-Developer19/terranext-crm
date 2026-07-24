import { describe, expect, it } from 'vitest';

import { can } from '@/lib/rbac/permissions';
import { STAFF_ROLES } from '@/types/common';

import {
  canAssignRole,
  isProtectedRole,
  isSelfTargeting,
  leavesProtectedRole,
  PROTECTED_ROLES,
  wouldStrandPlatform,
} from './logic';

describe('user-management governance rules', () => {
  it('blocks removing the last active holder of a protected role', () => {
    expect(wouldStrandPlatform(0)).toBe(true);
    expect(wouldStrandPlatform(1)).toBe(false);
    expect(wouldStrandPlatform(2)).toBe(false);
  });

  it('detects self-targeting role/status changes', () => {
    expect(isSelfTargeting('uid_1', 'uid_1')).toBe(true);
    expect(isSelfTargeting('uid_1', 'uid_2')).toBe(false);
  });
});

describe('protected roles', () => {
  it('protects both the super role and the platform administrator', () => {
    expect(isProtectedRole('founder')).toBe(true);
    expect(isProtectedRole('system_admin')).toBe(true);
  });

  it('leaves ordinary roles unprotected', () => {
    for (const role of STAFF_ROLES) {
      if (role === 'founder' || role === 'system_admin') continue;
      expect(isProtectedRole(role), role).toBe(false);
    }
  });

  it('lists exactly the two seats whose loss strands the platform', () => {
    expect([...PROTECTED_ROLES].sort()).toEqual(['founder', 'system_admin']);
  });
});

describe('leavesProtectedRole', () => {
  it('guards a Founder being demoted, even to another privileged role', () => {
    // The seat being vacated is what matters — system_admin cannot reach every
    // module, so this still strands the super-admin function.
    expect(leavesProtectedRole('founder', 'system_admin')).toBe(true);
    expect(leavesProtectedRole('founder', 'ops_manager')).toBe(true);
  });

  it('guards a System Administrator being demoted', () => {
    expect(leavesProtectedRole('system_admin', 'trainer')).toBe(true);
  });

  it('does not fire when the role is unchanged', () => {
    // Re-saving a Founder as Founder is not a demotion and must not trip the
    // last-holder guard.
    expect(leavesProtectedRole('founder', 'founder')).toBe(false);
    expect(leavesProtectedRole('system_admin', 'system_admin')).toBe(false);
  });

  it('does not fire when promoting into a protected role', () => {
    expect(leavesProtectedRole('trainer', 'founder')).toBe(false);
    expect(leavesProtectedRole('ops_manager', 'system_admin')).toBe(false);
  });

  it('ignores changes between ordinary roles', () => {
    expect(leavesProtectedRole('trainer', 'coordinator')).toBe(false);
  });
});

describe('canAssignRole — Founder or System Administrator may hand out Founder', () => {
  // Policy revised 2026-07-24 (owner decision): system_admin joins founder as
  // a trusted grantor. Everyone else stays refused.
  const OTHER_ROLES = STAFF_ROLES.filter((role) => role !== 'founder' && role !== 'system_admin');

  it('✅ lets a Founder assign Founder', () => {
    expect(canAssignRole('founder', 'founder')).toBe(true);
  });

  it('✅ lets a System Administrator assign Founder', () => {
    expect(canAssignRole('system_admin', 'founder')).toBe(true);
  });

  it('❌ refuses an ordinary administrator role (ops_manager) assigning Founder', () => {
    // "Administrator" in the requirements has no dedicated role in this
    // system — STAFF_ROLES has no entry named that — so ops_manager stands
    // in as the ordinary day-to-day administrator role. It has never been
    // able to mint Founders and this policy change does not touch that.
    expect(canAssignRole('ops_manager', 'founder')).toBe(false);
  });

  it('❌ refuses every other role assigning Founder', () => {
    for (const role of OTHER_ROLES) {
      expect(canAssignRole(role, 'founder'), role).toBe(false);
    }
  });

  it('supports ownership transfer: a Founder promotes a successor', () => {
    // Transfer is two audited steps — promote the successor, then demote the
    // outgoing Founder. Both are permitted while two Founders exist, which is
    // what keeps the last-holder guard from blocking a legitimate handover.
    expect(canAssignRole('founder', 'founder')).toBe(true);
    expect(leavesProtectedRole('founder', 'ops_manager')).toBe(true);
    expect(wouldStrandPlatform(1)).toBe(false);
  });

  it('supports System Administrator provisioning a Founder the same way', () => {
    expect(canAssignRole('system_admin', 'founder')).toBe(true);
  });

  it('does not restrict assigning ordinary roles', () => {
    // The guard is narrow on purpose: it protects the super role only, and
    // must not turn system_admin or founder into roles that cannot manage
    // ordinary staff.
    const ordinaryTargets = STAFF_ROLES.filter((role) => role !== 'founder');
    for (const target of ordinaryTargets) {
      expect(canAssignRole('system_admin', target), target).toBe(true);
      expect(canAssignRole('founder', target), target).toBe(true);
      expect(canAssignRole('ops_manager', target), target).toBe(true);
    }
  });

  it('is independent of who holds users:update — grant list is explicit, not implied', () => {
    // Every non-founder, non-system_admin role in this map holds no
    // users:update grant at all, so the interesting case is system_admin:
    // it holds users:update AND is now on the Founder-assigner list, but
    // for an explicit reason (FOUNDER_ASSIGNERS), not because the permission
    // implies it.
    expect(can('system_admin', 'users:update')).toBe(true);
    expect(canAssignRole('system_admin', 'founder')).toBe(true);
  });
});

describe('anti-lockout, end to end', () => {
  /** Mirrors the action guard: block when the seat is vacated and nobody is left. */
  const blocked = (
    before: (typeof STAFF_ROLES)[number],
    after: (typeof STAFF_ROLES)[number],
    othersRemaining: number,
  ) => leavesProtectedRole(before, after) && wouldStrandPlatform(othersRemaining);

  it('refuses to demote the only Founder', () => {
    expect(blocked('founder', 'ops_manager', 0)).toBe(true);
  });

  it('permits demoting a Founder when another Founder is active', () => {
    expect(blocked('founder', 'ops_manager', 1)).toBe(false);
  });

  it('refuses to demote the only System Administrator', () => {
    expect(blocked('system_admin', 'trainer', 0)).toBe(true);
  });

  it('never blocks an ordinary role change, however few remain', () => {
    expect(blocked('trainer', 'coordinator', 0)).toBe(false);
  });
});
