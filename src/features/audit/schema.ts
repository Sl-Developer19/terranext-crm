/**
 * Audit log schema for the admin screen (Doc 16 S52, SOP 17.16).
 * Framework-free. The audit write types live in lib/audit/types.ts;
 * this file defines the read-side shape and filter types used by the
 * audit-logs screen and its queries.
 */

import type { AuditAction, AuditEntityType } from '@/lib/audit/types';

export interface AuditLogEntry {
  id: string;
  at: string; // ISO 8601
  actorUid: string;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityPath: string;
  changes: Record<string, { before: unknown; after: unknown }> | null;
  context: { feature: string; reason: string | null };
}

/** Filter state for the audit log screen. */
export interface AuditLogFilters {
  action: AuditAction | '';
  entityType: AuditEntityType | '';
  actorUid: string;
  dateFrom: string; // YYYY-MM-DD or ''
  dateTo: string; // YYYY-MM-DD or ''
}

/**
 * SOP 17.16 register presets — each maps to a specific filter configuration
 * that surfaces the relevant subset of auditLogs for the named register.
 */
export interface RegisterPreset {
  id: string;
  label: string;
  description: string;
  /** Partial filter overrides applied when the preset is selected. */
  filters: Partial<AuditLogFilters>;
}

export const REGISTER_PRESETS: RegisterPreset[] = [
  {
    id: 'all',
    label: 'All Events',
    description: 'Full audit stream',
    filters: {},
  },
  {
    id: 'access_authorisation',
    label: 'Access Authorisation',
    description: 'SOP 17.16 — permission and role changes',
    filters: { action: 'permission_change' },
  },
  {
    id: 'system_access',
    label: 'System Access Log',
    description: 'SOP 17.16 — logins, session events',
    filters: { action: 'login' },
  },
  {
    id: 'overrides',
    label: 'Overrides',
    description: 'Admin overrides with recorded reason',
    filters: { action: 'override' },
  },
  {
    id: 'exports',
    label: 'Data Exports',
    description: 'SOP 17.16 — data export audit trail',
    filters: { action: 'export' },
  },
];
