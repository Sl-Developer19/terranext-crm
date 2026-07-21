import type { StaffRole } from '@/types/common';

/**
 * Audit log document shape (Doc 03 §6, Doc 14 §4 — immutable, ADR-007).
 * Framework-free so Functions and portals reuse it.
 */

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'soft_delete',
  'status_change',
  'permission_change',
  'login',
  'export',
  'override',
  'migration',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntityType =
  | 'user'
  | 'session'
  | 'lead'
  | 'counselling_session'
  | 'participant'
  // Parent-first acquisition path (families, their parents, and counselling).
  | 'family'
  | 'parent'
  | 'parent_session'
  | 'enrolment'
  | 'academy'
  | 'programme'
  | 'batch'
  | 'attendance'
  | 'assessment'
  | 'certificate'
  | 'career_profile'
  | 'placement'
  | 'employer'
  | 'alumni_record'
  | 'fee_account'
  | 'payment'
  | 'communication'
  | 'college'
  | 'settings';

export interface AuditChange {
  before: unknown;
  after: unknown;
}

export interface AuditEntryInput {
  actorUid: string;
  actorRole: StaffRole | 'system';
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityPath: string;
  /** Field-level diff — never full document snapshots (Doc 03 §6). */
  changes?: Record<string, AuditChange>;
  context: {
    feature: string;
    /** Mandatory when action === 'override' (rules-enforced). */
    reason?: string;
  };
}
