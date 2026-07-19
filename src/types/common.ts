/**
 * Cross-feature identity and tenancy types (Doc 02 §3).
 * Framework-free by rule — nothing here imports React, Next, or Firebase.
 */

/** Tenancy scope, "HQ" until multi-branch activates (ADR-010). */
export type BranchId = string;
export const DEFAULT_BRANCH_ID: BranchId = 'HQ';

/** Staff role claim values (Doc 04 §1). Flat, no hierarchy (ADR-011). */
export const STAFF_ROLES = [
  'founder',
  'system_admin',
  'ops_manager',
  'consultant',
  'coordinator',
  'trainer',
  'finance',
  'placement',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/** Attached to a fetched document: Firestore doc id + data. */
export type WithId<T> = T & { id: string };

/** Integer paise (ADR-012). Type alias documents intent at signatures. */
export type Paise = number;
