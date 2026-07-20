/**
 * Roles feature logic (Doc 16 S51, ADR-011).
 * Framework-free. Computes the role matrix from the authoritative
 * ROLE_PERMISSIONS map and generates a deterministic version hash
 * so the admin screen can display whether the map has changed.
 *
 * The version hash is a hex digest of the JSON-serialised map
 * (keys sorted for determinism). CI will compare this against a
 * committed baseline as part of condition C-1 once codegen lands.
 */

import { createHash } from 'node:crypto';

import { MODULES, ROLE_PERMISSIONS, type Action, type Module } from '@/lib/rbac/permissions';
import { STAFF_ROLES, type StaffRole } from '@/types/common';

import type { RoleMatrixRow } from './schema';

/**
 * Returns the permissions map version hash (SHA-256, first 8 hex chars).
 * Changing any grant produces a different hash — visible on the roles screen
 * so auditors can confirm whether the map has been modified since last review.
 */
export function permissionsMapVersion(): string {
  const stable = JSON.stringify(ROLE_PERMISSIONS, Object.keys(ROLE_PERMISSIONS).sort());
  return createHash('sha256').update(stable).digest('hex').slice(0, 8).toUpperCase();
}

/**
 * Converts ROLE_PERMISSIONS into a row-per-module matrix suitable for
 * the read-only render on /admin/roles.
 */
export function buildRoleMatrix(): RoleMatrixRow[] {
  return MODULES.map((module: Module) => {
    const cells = {} as Record<StaffRole, Action[]>;
    for (const role of STAFF_ROLES) {
      const grants = ROLE_PERMISSIONS[role];
      const roleActions = grants
        .filter((p) => p.startsWith(`${module}:`))
        .map((p) => p.split(':')[1] as Action)
        .sort();
      cells[role] = roleActions;
    }
    return { module, cells };
  });
}
