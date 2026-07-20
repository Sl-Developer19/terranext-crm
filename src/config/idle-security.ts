import { MFA_REQUIRED_ROLES } from '@/config/auth-security';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;

/**
 * Idle-timeout re-auth policy (Doc 10 §1 addendum, M1-B, Doc 22 M1).
 * Applies only to the roles already treated as high-privilege for MFA
 * enforcement (Doc 10 §1) — one definition of "high-privilege," not two.
 */
export const IDLE_SECURITY = {
  /** No tracked activity for this long triggers the lock. */
  timeoutMs: 15 * MINUTE_MS,
  /** Warning toast shown starting this long before the lock. */
  warningMs: 60 * SECOND_MS,
  /** Roles the idle timer runs for; all other roles are never locked. */
  lockRoles: MFA_REQUIRED_ROLES,
} as const;
