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
 * Roles allowed to hand out the Founder role (policy revised 2026-07-24 —
 * owner decision; originally Founder-only).
 *
 * This is a separate axis from `can()`: the actor may hold `users:update` and
 * still be refused this particular assignment for a role outside this list —
 * a permission to manage users is not, on its own, a permission to mint
 * super-administrators. `system_admin` is on the list by explicit request,
 * not because `users:update` implies it.
 *
 * Trade-off worth naming, because it is a real consequence of this policy and
 * not a bug: `system_admin` can now reach Founder in two hops even though
 * `isSelfTargeting` still blocks a direct self-promotion — provision or
 * promote a second account to Founder, then have *that* account promote the
 * original system_admin. Both hops are `canAssignRole`-legal individually,
 * both are audited (`writeAudit` on every grant), and the last-Founder guard
 * never blocks a *grant* — only a demotion of the last holder — so nothing
 * here stops the sequence. Accepted deliberately: the owner asked for
 * System Administrator to be a second trusted path to Founder, not merely a
 * checkbox that happens to be unreachable in practice.
 */
export const FOUNDER_ASSIGNERS = [
  SUPER_ROLE,
  'system_admin',
] as const satisfies readonly StaffRole[];

/**
 * Guards the Founder grant specifically — everything else passes through.
 * See `FOUNDER_ASSIGNERS` for who may assign Founder and why.
 */
export function canAssignRole(actorRole: StaffRole, targetRole: StaffRole): boolean {
  if (targetRole === SUPER_ROLE) {
    return (FOUNDER_ASSIGNERS as readonly StaffRole[]).includes(actorRole);
  }
  return true;
}
