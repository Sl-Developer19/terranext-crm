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
  | 'report'
  | 'settings'
  | 'growth_partner'
  // TerraNext Community Growth Network — business/organisation referral
  // partner, a distinct bounded context from `growth_partner`.
  | 'community_partner'
  | 'reward_rule'
  | 'reward_ledger_entry'
  | 'wallet_transaction'
  | 'payout_request'
  // AI Intelligence Platform (AI Session Intelligence Proposal).
  | 'ai_session'
  | 'ai_processing_job'
  | 'ai_intelligence_settings';

export interface AuditChange {
  before: unknown;
  after: unknown;
}

export interface AuditEntryInput {
  actorUid: string;
  /** 'growth_partner' covers partner-initiated writes (Doc 25, ADR-014) — a
   * partner is never a StaffRole, but its actions are audited the same way. */
  actorRole: StaffRole | 'system' | 'growth_partner';
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
