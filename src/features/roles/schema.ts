/**
 * Roles feature schema (Doc 16 S51, ADR-011).
 * Framework-free. The permission map itself lives in lib/rbac/permissions.ts
 * (the only authoritative source); this file only defines display-layer types.
 */

import type { Action, Module, Permission } from '@/lib/rbac/permissions';
import type { StaffRole } from '@/types/common';

export interface PermissionCell {
  granted: boolean;
  actions: Action[];
}

/** A row of the role matrix as rendered on /admin/roles. */
export interface RoleMatrixRow {
  module: Module;
  cells: Record<StaffRole, Action[]>;
}

export type { Permission, StaffRole, Module, Action };
