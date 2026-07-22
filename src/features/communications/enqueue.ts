import 'server-only';

import { adminDb } from '@/lib/firebase/admin';

import { toBodyPreview } from './logic';
import type { Channel, RefType } from './schema';
import { findTemplate } from './templates';

/**
 * System-originated message enqueue (FR-10.3).
 *
 * The trigger behaviours in Doc 19 §3 (`onLeadCreate` acknowledgement,
 * `onCertificateIssued` notification) run inline at the write site rather than
 * as Firestore triggers. The codebase already does this for BR-05, and it buys
 * a property triggers do not have: the enqueue happens in the same request the
 * operator is watching, so a failure is visible immediately instead of hours
 * later in a log.
 *
 * Doc 19 requires these to be idempotent, keyed by ref + template. A re-run —
 * a retried request, a re-fired trigger — must not send the same person the
 * same acknowledgement twice.
 */
export async function enqueueTemplatedMessage(options: {
  templateKey: string;
  refType: RefType;
  refId: string;
  branchId: string;
  /** Overrides the template's own channel when the caller knows better. */
  channel?: Channel;
}): Promise<'queued' | 'already_queued' | 'unknown_template'> {
  const template = findTemplate(options.templateKey);
  if (!template) return 'unknown_template';

  const db = adminDb();

  const existing = await db
    .collection('communications')
    .where('refType', '==', options.refType)
    .where('refId', '==', options.refId)
    .where('templateKey', '==', options.templateKey)
    .limit(1)
    .get();
  if (!existing.empty) return 'already_queued';

  const now = new Date();
  await db.collection('communications').add({
    schemaVersion: 1,
    branchId: options.branchId,
    channel: options.channel ?? template.channel,
    direction: 'outbound',
    refType: options.refType,
    refId: options.refId,
    templateKey: options.templateKey,
    subject: template.subject,
    bodyPreview: toBodyPreview(template.body),
    pendingBody: template.body,
    status: 'queued',
    sentAt: null,
    attempts: 0,
    nextAttemptAt: now,
    failureReason: null,
    byUid: 'system',
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  });

  return 'queued';
}
