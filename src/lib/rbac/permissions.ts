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
  /** Growth Partner identity, registration, and approval (Doc 25, ADR-014). */
  'growthPartners',
  /** Reward rules, ledger, wallet, and payouts (Doc 25). */
  'rewards',
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

/**
 * Every permission the system defines — the full `Module × Action` product.
 *
 * Derived rather than enumerated on purpose: a module added to `MODULES` or an
 * action added to `ACTIONS` is included here automatically, which is what makes
 * the Founder grant cover *future* modules without anyone remembering to come
 * back and widen it.
 */
export const ALL_PERMISSIONS: readonly Permission[] = MODULES.flatMap((module) =>
  ACTIONS.map((action) => `${module}:${action}` as Permission),
);

/**
 * The super-administrator role (owner decision, 2026-07-22).
 *
 * Founder is unrestricted by design: it holds every permission, is exempt from
 * `can()` entirely, and cannot be stranded by user management. It is defined in
 * code, so it cannot be deleted or edited at runtime — ADR-011 makes every role
 * change a reviewed PR, and there is no runtime role editor to weaken.
 *
 * What this deliberately does NOT do: weaken authentication. Founder still
 * signs in, still holds a session, and every Founder action is still audited.
 * Unrestricted authorization is not anonymous access.
 */
export const SUPER_ROLE = 'founder' as const satisfies StaffRole;

export function isSuperRole(role: StaffRole): boolean {
  return role === SUPER_ROLE;
}

/** Doc 04 §3 permission matrix, row by row. */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  /**
   * Super administrator (owner decision, 2026-07-22). Holds the complete
   * permission set, including every module added in future.
   *
   * This is spread from `ALL_PERMISSIONS` rather than listed row by row for a
   * concrete reason: the Firestore rules codegen reads this map, so an
   * enumerated list would silently omit Founder from the rule predicates for
   * any module added later. Founder would then pass server-side `can()` and be
   * refused by Firestore on the very same request — a split-brain that reads
   * like data corruption rather than a permissions bug.
   */
  founder: ALL_PERMISSIONS,
  system_admin: [
    ...p('dashboard', 'view'),
    ...p('programmes', 'configure'),
    ...p('certificates', 'configure'),
    // Narrow, deliberate exception (owner decision, 2026-07-25): the secure
    // delete feature restricts destructive lead/communication removal to
    // Founder + System Administrator. Founder already holds these via
    // ALL_PERMISSIONS; System Administrator needs `view` too, or the guarded
    // pages (`requirePermission('leads:view')` / `('communications:view')`)
    // would redirect them before the delete affordance is ever reachable.
    // This does not restore system_admin's other business powers — see the
    // ADR-011 test in permissions.test.ts, which pins the scope to exactly
    // view + delete on these two modules.
    ...p('leads', 'view', 'delete'),
    ...p('communications', 'view', 'configure', 'delete'),
    // The manual-alumni-grant override (BR-05) is system_admin only — kept
    // on 'configure', the verb this role already uses for every other
    // admin-only override, so it can never be confused with ops_manager's
    // routine 'alumni:create/update' (engagement recording).
    ...p('alumni', 'view', 'configure'),
    // Growth Partner onboarding (Doc 25): System Admin registers and approves
    // (mints the partner's account) and activates/deactivates post-approval.
    ...p('growthPartners', 'view', 'create', 'update', 'approve'),
    ...p('rewards', 'view', 'configure', 'export'),
    ...p('users', 'view', 'create', 'update'),
    ...p('roles', 'view', 'configure'),
    ...p('audit', 'view', 'export'),
    ...p('settings', 'view', 'configure'),
  ],
  ops_manager: [
    ...p('dashboard', 'view', 'export'),
    // 'delete' removed (owner decision, 2026-07-25): lead soft-deletion is now
    // Founder/System-Administrator only, not an ops_manager power.
    ...p('leads', 'view', 'create', 'update', 'assign', 'export'),
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
    // "Admission Team" and "Operations Admin" from the GPMS brief both map to
    // ops_manager (Doc 25 §2) — this role registers partners and reviews
    // their referred leads through the existing leads:view/assign grants.
    ...p('growthPartners', 'view', 'create'),
    ...p('rewards', 'view'),
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
    // Reward payouts are money leaving the organisation (Doc 25 §4) — Finance
    // reviews the ledger and approves payout requests, same separation of
    // duties as fees:approve above.
    ...p('growthPartners', 'view'),
    ...p('rewards', 'view', 'approve', 'export'),
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
  // Founder is exempt, not merely well-granted. `ROLE_PERMISSIONS.founder`
  // already contains everything, so this branch is redundant today — which is
  // exactly why it is here. It is the guarantee that survives someone editing
  // the map, and it means Founder cannot be locked out of the platform by a
  // permissions mistake.
  if (isSuperRole(role)) return true;

  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Modules a role may see at all — drives nav filtering (Doc 05 §1). */
export function visibleModules(role: StaffRole): Module[] {
  return MODULES.filter((m) => can(role, `${m}:view` as Permission));
}
