import type { StaffRole } from '@/types/common';

/**
 * THE authoritative role→permission map (Doc 04 §3, ADR-011).
 *
 * This file is the single source of truth for authorization:
 * - server guards (`requirePermission`) and UI (`useCan`) read it directly;
 * - the Firestore rules codegen (condition C-1) generates rule predicates
 *   from it, with a CI drift-check against firestore.rules;
 * - /admin/roles renders it read-only.
 *
 * Changing any grant is a security change (Tier 1 workflow) and requires
 * two approvals (Doc 09 §5). Row-level scopes (trainer↔assigned batches,
 * consultant↔assigned leads) are contextual refinements enforced in rules
 * and feature logic — a grant here is the *widest* the role can reach.
 */

export const MODULES = [
  'dashboard',
  'leads',
  'counselling',
  'admissions',
  'participants',
  /** Parent & family records — the parent-first acquisition path. */
  'parents',
  'programmes',
  'batches',
  'attendance',
  'assessments',
  'certificates',
  'career',
  'placements',
  'employers',
  'alumni',
  'fees',
  'communications',
  'reports',
  'colleges',
  'users',
  'roles',
  'audit',
  'settings',
] as const;

export type Module = (typeof MODULES)[number];

export const ACTIONS = [
  'view',
  'create',
  'update',
  'delete', // soft delete only (ADR-009)
  'assign',
  'approve',
  'export',
  'configure',
] as const;

export type Action = (typeof ACTIONS)[number];

export type Permission = `${Module}:${Action}`;

const p = (module: Module, ...actions: Action[]): Permission[] =>
  actions.map((a) => `${module}:${a}` as Permission);

/** Doc 04 §3 permission matrix, row by row. */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  founder: [
    ...p('dashboard', 'view', 'export'),
    ...p('leads', 'view', 'export'),
    ...p('counselling', 'view'),
    ...p('admissions', 'view'),
    ...p('participants', 'view', 'export'),
    ...p('parents', 'view', 'export'),
    ...p('programmes', 'view'),
    ...p('batches', 'view'),
    ...p('attendance', 'view', 'export'),
    ...p('assessments', 'view'),
    ...p('certificates', 'view'),
    ...p('career', 'view'),
    ...p('placements', 'view', 'export'),
    ...p('employers', 'view'),
    // Founder can also record engagement and toggle success-story consent
    // (S33) — the same 'update' grant ops_manager holds for this module.
    ...p('alumni', 'view', 'update', 'export'),
    ...p('fees', 'view', 'export', 'approve'),
    ...p('communications', 'view'),
    ...p('reports', 'view', 'export'),
    ...p('colleges', 'view'),
    ...p('users', 'view'),
    ...p('roles', 'view'),
    ...p('audit', 'view'),
    ...p('settings', 'view'),
  ],
  system_admin: [
    ...p('dashboard', 'view'),
    ...p('programmes', 'configure'),
    ...p('certificates', 'configure'),
    ...p('communications', 'configure'),
    // The manual-alumni-grant override (BR-05) is system_admin only — kept
    // on 'configure', the verb this role already uses for every other
    // admin-only override, so it can never be confused with ops_manager's
    // routine 'alumni:create/update' (engagement recording).
    ...p('alumni', 'view', 'configure'),
    ...p('users', 'view', 'create', 'update'),
    ...p('roles', 'view', 'configure'),
    ...p('audit', 'view', 'export'),
    ...p('settings', 'view', 'configure'),
  ],
  ops_manager: [
    ...p('dashboard', 'view', 'export'),
    ...p('leads', 'view', 'create', 'update', 'delete', 'assign', 'export'),
    ...p('counselling', 'view'),
    ...p('admissions', 'view', 'create'),
    ...p('participants', 'view', 'create', 'update', 'export'),
    ...p('parents', 'view', 'create', 'update', 'export'),
    ...p('programmes', 'view', 'create', 'update'),
    ...p('batches', 'view', 'create', 'update', 'assign'),
    ...p('attendance', 'view', 'export'),
    ...p('assessments', 'view'),
    ...p('certificates', 'view', 'approve'),
    ...p('career', 'view'),
    ...p('placements', 'view'),
    ...p('employers', 'view'),
    ...p('alumni', 'view', 'create', 'update', 'export'),
    ...p('fees', 'view', 'approve'),
    ...p('communications', 'view', 'create'),
    ...p('reports', 'view', 'export'),
    ...p('colleges', 'view', 'create', 'update'),
  ],
  consultant: [
    ...p('dashboard', 'view'),
    ...p('leads', 'view', 'create', 'update'),
    ...p('counselling', 'view', 'create', 'update'),
    ...p('participants', 'view'),
    // Consultants run parent counselling — the parent-first path is theirs.
    ...p('parents', 'view', 'create', 'update'),
    ...p('programmes', 'view'),
    ...p('career', 'view'),
    ...p('alumni', 'view'),
    ...p('communications', 'view', 'create'),
    ...p('reports', 'view'),
    ...p('colleges', 'view', 'update'),
  ],
  coordinator: [
    ...p('dashboard', 'view'),
    ...p('participants', 'view', 'update'),
    ...p('parents', 'view'),
    ...p('programmes', 'view', 'create', 'update'),
    ...p('batches', 'view', 'create', 'update', 'assign'),
    ...p('attendance', 'view', 'update'),
    ...p('assessments', 'view', 'create', 'update'),
    ...p('certificates', 'view', 'create'),
    ...p('alumni', 'view'),
    ...p('communications', 'view', 'create'),
    ...p('reports', 'view'),
  ],
  trainer: [
    ...p('dashboard', 'view'),
    ...p('participants', 'view'),
    ...p('programmes', 'view'),
    ...p('batches', 'view'),
    ...p('attendance', 'view', 'create', 'update'),
    ...p('assessments', 'view', 'create', 'update'),
    ...p('certificates', 'view'),
    ...p('communications', 'view', 'create'),
    ...p('reports', 'view'),
  ],
  finance: [
    ...p('dashboard', 'view'),
    ...p('participants', 'view'),
    ...p('fees', 'view', 'create', 'update', 'export'),
    ...p('communications', 'view', 'create'),
    ...p('reports', 'view', 'export'),
  ],
  placement: [
    ...p('dashboard', 'view'),
    ...p('participants', 'view'),
    ...p('programmes', 'view'),
    ...p('batches', 'view'),
    ...p('assessments', 'view'),
    ...p('certificates', 'view'),
    ...p('career', 'view', 'create', 'update'),
    ...p('placements', 'view', 'create', 'update', 'export'),
    ...p('employers', 'view', 'create', 'update'),
    ...p('alumni', 'view'),
    ...p('communications', 'view', 'create'),
    ...p('reports', 'view', 'export'),
  ],
};

export function can(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Modules a role may see at all — drives nav filtering (Doc 05 §1). */
export function visibleModules(role: StaffRole): Module[] {
  return MODULES.filter((m) => can(role, `${m}:view` as Permission));
}
