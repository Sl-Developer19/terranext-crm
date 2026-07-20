import { describe, expect, it } from 'vitest';

import { STAFF_ROLES } from '@/types/common';

import { ROLE_PERMISSIONS, can, visibleModules } from './permissions';

/**
 * Separation-of-duties invariants (ADR-011). These tests encode the
 * *intent* of the flat role model — a matrix edit that violates them
 * is a design change, not a tweak, and must fail CI.
 */
describe('RBAC permission map', () => {
  it('every role can view the dashboard', () => {
    for (const role of STAFF_ROLES) {
      expect(can(role, 'dashboard:view'), role).toBe(true);
    }
  });

  it('founder reads everything but manages nothing platform-level (ADR-011)', () => {
    expect(can('founder', 'users:view')).toBe(true);
    expect(can('founder', 'users:create')).toBe(false);
    expect(can('founder', 'roles:configure')).toBe(false);
    expect(can('founder', 'settings:configure')).toBe(false);
  });

  it('system_admin runs the platform but holds no business powers (ADR-011)', () => {
    expect(can('system_admin', 'users:create')).toBe(true);
    expect(can('system_admin', 'roles:configure')).toBe(true);
    expect(can('system_admin', 'leads:view')).toBe(false);
    expect(can('system_admin', 'fees:approve')).toBe(false);
    expect(can('system_admin', 'admissions:create')).toBe(false);
  });

  it('only ops_manager converts leads to participants (BR-02 actor)', () => {
    for (const role of STAFF_ROLES) {
      expect(can(role, 'admissions:create'), role).toBe(role === 'ops_manager');
    }
  });

  it('finance is the only role writing fees; approval sits with ops/founder', () => {
    for (const role of STAFF_ROLES) {
      expect(can(role, 'fees:create'), role).toBe(role === 'finance');
    }
    expect(can('ops_manager', 'fees:approve')).toBe(true);
    expect(can('founder', 'fees:approve')).toBe(true);
    expect(can('finance', 'fees:approve')).toBe(false);
  });

  it('only placement evaluates career eligibility (BR-09 actor)', () => {
    for (const role of STAFF_ROLES) {
      expect(can(role, 'career:update'), role).toBe(role === 'placement');
    }
  });

  it('trainer never sees finance or acquisition data', () => {
    expect(can('trainer', 'fees:view')).toBe(false);
    expect(can('trainer', 'leads:view')).toBe(false);
    expect(visibleModules('trainer')).not.toContain('fees');
  });

  it('nobody holds delete on anything except lead soft-archival by ops (ADR-009)', () => {
    for (const role of STAFF_ROLES) {
      const deletes = ROLE_PERMISSIONS[role].filter((perm) => perm.endsWith(':delete'));
      if (role === 'ops_manager') {
        expect(deletes).toEqual(['leads:delete']);
      } else {
        expect(deletes, role).toEqual([]);
      }
    }
  });

  it('audit logs are readable only by system_admin and founder (BR-06)', () => {
    for (const role of STAFF_ROLES) {
      expect(can(role, 'audit:view'), role).toBe(role === 'system_admin' || role === 'founder');
    }
  });
});
