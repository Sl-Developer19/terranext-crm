import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import type { AuditAction, AuditEntityType } from '@/lib/audit/types';

import type { AuditLogEntry, AuditLogFilters } from './schema';

// index: auditLogs — [entityType ASC, entityId ASC, at DESC] (Doc 03 §3)
// index: auditLogs — [actorUid ASC, at DESC]
// index: auditLogs — [action ASC, at DESC]

const MAX_ENTRIES = 500; // safety ceiling; UI virtualizes (Doc 11 §7)

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Reads the audit log stream with optional filter dimensions (Doc 16 S52).
 * Server-only: only system_admin and founder may view auditLogs (Doc 04 §3).
 *
 * Composite index strategy:
 * - Base query always orders by `at DESC` (single-field index)
 * - Single filter + at DESC uses a composite index
 * - Multiple simultaneous filters fall back to client-side filtering after
 *   the primary server-side filter; Firestore inequality limits apply.
 */
export async function listAuditLogs(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
  const db = adminDb();
  let query = db.collection('auditLogs').orderBy('at', 'desc');

  // Apply the most selective single server-side filter first
  if (filters.action) {
    query = query.where('action', '==', filters.action as AuditAction);
  } else if (filters.entityType) {
    query = query.where('entityType', '==', filters.entityType as AuditEntityType);
  } else if (filters.actorUid) {
    query = query.where('actorUid', '==', filters.actorUid);
  }

  // Date range — applied client-side when another filter already constrains the query,
  // applied server-side on the base at-ordered query when there is no other filter.
  if (!filters.action && !filters.entityType && !filters.actorUid) {
    if (filters.dateFrom) {
      query = query.where(
        'at',
        '>=',
        Timestamp.fromDate(new Date(`${filters.dateFrom}T00:00:00Z`)),
      );
    }
    if (filters.dateTo) {
      query = query.where('at', '<=', Timestamp.fromDate(new Date(`${filters.dateTo}T23:59:59Z`)));
    }
  }

  const snap = await query.limit(MAX_ENTRIES).get();

  const results: AuditLogEntry[] = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      at: toIso(d.at),
      actorUid: safeString(d.actorUid),
      actorRole: safeString(d.actorRole),
      action: (d.action ?? 'create') as AuditAction,
      entityType: (d.entityType ?? 'user') as AuditEntityType,
      entityId: safeString(d.entityId),
      entityPath: safeString(d.entityPath),
      changes:
        d.changes && typeof d.changes === 'object'
          ? (d.changes as Record<string, { before: unknown; after: unknown }>)
          : null,
      context: {
        feature: safeString(d.context?.feature),
        reason: typeof d.context?.reason === 'string' ? d.context.reason : null,
      },
    };
  });

  // Client-side secondary filters (when the primary server filter was already applied)
  return results.filter((entry) => {
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.entityType && entry.entityType !== filters.entityType) return false;
    if (filters.actorUid && entry.actorUid !== filters.actorUid) return false;
    if (filters.dateFrom && entry.at < `${filters.dateFrom}T00:00:00.000Z`) return false;
    if (filters.dateTo && entry.at > `${filters.dateTo}T23:59:59.999Z`) return false;
    return true;
  });
}
