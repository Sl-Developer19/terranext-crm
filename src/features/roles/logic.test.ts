import { describe, expect, it } from 'vitest';

import { MODULES } from '@/lib/rbac/permissions';
import { STAFF_ROLES } from '@/types/common';

import { buildRoleMatrix, permissionsMapVersion } from './logic';

describe('buildRoleMatrix', () => {
  const matrix = buildRoleMatrix();

  it('produces one row per module', () => {
    expect(matrix).toHaveLength(MODULES.length);
    expect(matrix.map((r) => r.module)).toEqual([...MODULES]);
  });

  it('every row has a cell for each role', () => {
    for (const row of matrix) {
      for (const role of STAFF_ROLES) {
        expect(Array.isArray(row.cells[role])).toBe(true);
      }
    }
  });

  it('founder has view on all modules they are documented to have access to', () => {
    const dashboardRow = matrix.find((r) => r.module === 'dashboard');
    expect(dashboardRow?.cells.founder).toContain('view');
  });

  it('system_admin has no access to leads module', () => {
    const leadsRow = matrix.find((r) => r.module === 'leads');
    expect(leadsRow?.cells.system_admin).toHaveLength(0);
  });

  it('trainer has attendance create permission', () => {
    const attendanceRow = matrix.find((r) => r.module === 'attendance');
    expect(attendanceRow?.cells.trainer).toContain('create');
  });
});

describe('permissionsMapVersion', () => {
  it('returns an 8-char uppercase hex string', () => {
    const version = permissionsMapVersion();
    expect(version).toMatch(/^[0-9A-F]{8}$/);
  });

  it('returns the same value on repeated calls (deterministic)', () => {
    expect(permissionsMapVersion()).toBe(permissionsMapVersion());
  });
});
