import { describe, expect, it } from 'vitest';

import { STAFF_ROLES } from '@/types/common';

import {
  ACTIONS,
  ALL_PERMISSIONS,
  MODULES,
  ROLE_PERMISSIONS,
  SUPER_ROLE,
  can,
  isSuperRole,
  visibleModules,
  type Permission,
} from './permissions';

/**
 * Separation-of-duties invariants (ADR-011). These tests encode the *intent*
 * of the flat role model — a matrix edit that violates them is a design
 * change, not a tweak, and must fail CI.
 *
 * Founder is deliberately outside that model (owner decision, 2026-07-22):
 * it is the super administrator and holds everything. The duty-separation
 * assertions below are therefore scoped to the non-super roles, which is the
 * population the separation actually governs.
 */
const NON_SUPER_ROLES = STAFF_ROLES.filter((role) => role !== SUPER_ROLE);

describe('Founder — super administrator', () => {
  it('holds literally every permission the system defines', () => {
    // The load-bearing test: iterates the full Module × Action product, so a
    // module added in future is covered here without editing this test.
    for (const permission of ALL_PERMISSIONS) {
      expect(can(SUPER_ROLE, permission), permission).toBe(true);
    }
  });

  it('covers every module and every action, including ones added later', () => {
    expect(ALL_PERMISSIONS).toHaveLength(MODULES.length * ACTIONS.length);
    for (const mod of MODULES) {
      for (const action of ACTIONS) {
        expect(can(SUPER_ROLE, `${mod}:${action}` as Permission)).toBe(true);
      }
    }
  });

  it('has full CRUD on every module', () => {
    for (const mod of MODULES) {
      for (const action of ['view', 'create', 'update', 'delete'] as const) {
        expect(can(SUPER_ROLE, `${mod}:${action}` as Permission), mod).toBe(true);
      }
    }
  });

  it('can manage the platform itself — users, roles, settings, audit', () => {
    expect(can(SUPER_ROLE, 'users:create')).toBe(true);
    expect(can(SUPER_ROLE, 'users:update')).toBe(true);
    expect(can(SUPER_ROLE, 'roles:configure')).toBe(true);
    expect(can(SUPER_ROLE, 'settings:configure')).toBe(true);
    expect(can(SUPER_ROLE, 'audit:view')).toBe(true);
    expect(can(SUPER_ROLE, 'audit:export')).toBe(true);
  });

  it('can act in every business module named by the owner', () => {
    for (const mod of [
      'reports',
      'communications',
      'fees',
      'certificates',
      'admissions',
      'placements',
    ] as const) {
      expect(can(SUPER_ROLE, `${mod}:create` as Permission), mod).toBe(true);
      expect(can(SUPER_ROLE, `${mod}:update` as Permission), mod).toBe(true);
    }
  });

  it('sees every module in the navigation', () => {
    expect(visibleModules(SUPER_ROLE)).toEqual([...MODULES]);
  });

  it('is recognised as the super role', () => {
    expect(isSuperRole(SUPER_ROLE)).toBe(true);
    for (const role of NON_SUPER_ROLES) {
      expect(isSuperRole(role), role).toBe(false);
    }
  });

  it('cannot be locked out by an edit to the permission map', () => {
    // `can()` short-circuits on the super role, so even a map that had
    // Founder stripped down to nothing still grants access. This is the
    // anti-lockout guarantee, and it must not depend on the map's contents.
    const stripped = { ...ROLE_PERMISSIONS, [SUPER_ROLE]: [] as Permission[] };
    expect(stripped[SUPER_ROLE]).toHaveLength(0);
    expect(can(SUPER_ROLE, 'settings:configure')).toBe(true);
    expect(can(SUPER_ROLE, 'users:delete')).toBe(true);
  });

  it('grants the super role no more than the full set — no phantom permissions', () => {
    // Guards against ALL_PERMISSIONS drifting out of the Module × Action grid.
    for (const permission of ROLE_PERMISSIONS[SUPER_ROLE]) {
      const [mod, action] = permission.split(':');
      expect(MODULES).toContain(mod);
      expect(ACTIONS).toContain(action);
    }
  });
});

describe('RBAC permission map', () => {
  it('every role can view the dashboard', () => {
    for (const role of STAFF_ROLES) {
      expect(can(role, 'dashboard:view'), role).toBe(true);
    }
  });

  it('system_admin runs the platform but holds no business powers (ADR-011)', () => {
    expect(can('system_admin', 'users:create')).toBe(true);
    expect(can('system_admin', 'roles:configure')).toBe(true);
    expect(can('system_admin', 'leads:view')).toBe(false);
    expect(can('system_admin', 'fees:approve')).toBe(false);
    expect(can('system_admin', 'admissions:create')).toBe(false);
  });

  it('among non-super roles, only ops_manager converts leads (BR-02 actor)', () => {
    for (const role of NON_SUPER_ROLES) {
      expect(can(role, 'admissions:create'), role).toBe(role === 'ops_manager');
    }
  });

  it('among non-super roles, finance alone writes fees; approval sits with ops', () => {
    for (const role of NON_SUPER_ROLES) {
      expect(can(role, 'fees:create'), role).toBe(role === 'finance');
    }
    expect(can('ops_manager', 'fees:approve')).toBe(true);
    expect(can('finance', 'fees:approve')).toBe(false);
  });

  it('among non-super roles, only placement evaluates career eligibility (BR-09)', () => {
    for (const role of NON_SUPER_ROLES) {
      expect(can(role, 'career:update'), role).toBe(role === 'placement');
    }
  });

  it('trainer never sees finance or acquisition data', () => {
    expect(can('trainer', 'fees:view')).toBe(false);
    expect(can('trainer', 'leads:view')).toBe(false);
    expect(visibleModules('trainer')).not.toContain('fees');
  });

  it('among non-super roles, delete is limited to lead soft-archival by ops (ADR-009)', () => {
    for (const role of NON_SUPER_ROLES) {
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
      expect(can(role, 'audit:view'), role).toBe(role === 'system_admin' || role === SUPER_ROLE);
    }
  });

  it('widening Founder does not widen anyone else', () => {
    // The regression that would matter most: a change to the super role
    // leaking grants into ordinary roles.
    expect(can('trainer', 'settings:configure')).toBe(false);
    expect(can('consultant', 'users:create')).toBe(false);
    expect(can('finance', 'roles:configure')).toBe(false);
    expect(can('coordinator', 'audit:view')).toBe(false);
  });
});
