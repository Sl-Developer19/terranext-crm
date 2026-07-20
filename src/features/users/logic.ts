/**
 * Pure platform-governance rules for user management (Doc 09 §5.3 style —
 * no I/O, testable in isolation). These are not business rules BR-01..09;
 * they are the platform's own separation-of-duties guarantees (ADR-011).
 */

/**
 * Refuses to demote or disable the last active System Administrator — the
 * platform would otherwise lock itself out of user/role management.
 * `remainingActiveAdmins` excludes the target account being changed.
 */
export function wouldStrandPlatform(remainingActiveAdmins: number): boolean {
  return remainingActiveAdmins < 1;
}

/** A user may never change their own role or active status through this flow. */
export function isSelfTargeting(actorUid: string, targetUid: string): boolean {
  return actorUid === targetUid;
}
