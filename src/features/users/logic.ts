import { SUPER_ROLE } from '@/lib/rbac/permissions';
import type { StaffRole } from '@/types/common';

/**
 * Pure platform-governance rules for user management (Doc 09 §5.3 style —
 * no I/O, testable in isolation). These are not business rules BR-01..09;
 * they are the platform's own separation-of-duties guarantees (ADR-011).
 */

/**
 * Roles whose last active holder must never be demoted or disabled.
 *
 * `system_admin` owns user and role management; `founder` is the super
 * administrator (2026-07-22). Losing the final holder of either strands the
 * platform — with no Founder, nothing can reach every module; with no System
 * Administrator, nobody can provision the account that would fix it.
 */
export const PROTECTED_ROLES = ['system_admin', SUPER_ROLE] as const satisfies readonly StaffRole[];

export function isProtectedRole(role: StaffRole): boolean {
  return (PROTECTED_ROLES as readonly StaffRole[]).includes(role);
}

/**
 * Refuses to demote or disable the last active holder of a protected role —
 * the platform would otherwise lock itself out.
 * `remainingActiveHolders` excludes the target account being changed.
 */
export function wouldStrandPlatform(remainingActiveHolders: number): boolean {
  return remainingActiveHolders < 1;
}

/** A user may never change their own role or active status through this flow. */
export function isSelfTargeting(actorUid: string, targetUid: string): boolean {
  return actorUid === targetUid;
}

/**
 * Whether this change removes the account from a protected role.
 *
 * Note it is the *departure* that matters, not the destination: moving a
 * Founder to `system_admin` still needs the guard, because the Founder seat is
 * the one being vacated.
 */
export function leavesProtectedRole(before: StaffRole, after: StaffRole): boolean {
  return isProtectedRole(before) && before !== after;
}

/**
 * Only a Founder may hand out the Founder role.
 *
 * Without this, the super role is reachable by privilege escalation:
 * `system_admin` holds `users:create` and `users:update`, so it could simply
 * promote itself an accomplice — or a fresh account it controls — to Founder
 * and inherit unrestricted access. Guarding the *grant* is what makes Founder
 * genuinely held rather than merely configured.
 *
 * This is a separate axis from `can()`. The actor may hold `users:update` and
 * still be refused this particular assignment; a permission to manage users is
 * not a permission to mint super-administrators.
 */
export function canAssignRole(actorRole: StaffRole, targetRole: StaffRole): boolean {
  if (targetRole === SUPER_ROLE) return actorRole === SUPER_ROLE;
  return true;
}
