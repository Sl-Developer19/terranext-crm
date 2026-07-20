import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { DEFAULT_BRANCH_ID } from '@/types/common';

import type { AuditEntryInput } from './types';

/**
 * Server-side audit writer (BR-06). Every privileged mutation calls this
 * inside or immediately after its transaction; an unaudited business write
 * is a review-blocking defect (Doc 09 §5.3).
 *
 * `auditLogs` is create-only for everyone forever (ADR-007) — there is no
 * update or delete helper here by design, and none may ever be added.
 */
export async function writeAudit(entry: AuditEntryInput): Promise<void> {
  if (entry.action === 'override' && !entry.context.reason) {
    throw new Error('Audit "override" entries require context.reason (Doc 03 §6).');
  }
  await adminDb()
    .collection('auditLogs')
    .add({
      schemaVersion: 1,
      branchId: DEFAULT_BRANCH_ID,
      at: FieldValue.serverTimestamp(),
      actorUid: entry.actorUid,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityPath: entry.entityPath,
      changes: entry.changes ?? null,
      context: { feature: entry.context.feature, reason: entry.context.reason ?? null },
    });
}
