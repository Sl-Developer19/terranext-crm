import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

/**
 * `followUpDigest` (Doc 19 §4, daily 08:00 IST).
 *
 * One internal digest per assignee listing the leads whose follow-up falls
 * today. Written through the communications log like every other message
 * (FR-10.3) so the digest is as auditable as anything sent to a customer.
 *
 * Assignees with nothing due get no digest at all — a daily "you have 0
 * follow-ups" mail is the fastest way to train people to ignore the digest.
 */

export interface DigestSummary {
  leadsDue: number;
  digestsQueued: number;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function endOfDay(now: Date): Date {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

export async function buildFollowUpDigests(now: Date = new Date()): Promise<DigestSummary> {
  const db = adminDb();
  const summary: DigestSummary = { leadsDue: 0, digestsQueued: 0 };

  const snap = await db
    .collection('leads')
    .where('nextFollowUpAt', '<=', Timestamp.fromDate(endOfDay(now)))
    .limit(1000)
    .get();

  const byAssignee = new Map<string, string[]>();

  for (const doc of snap.docs) {
    const stage = asString(doc.get('stage'));
    // A converted or lost lead needs no chasing, whatever its stale
    // follow-up date says.
    if (stage === 'admitted' || stage === 'lost') continue;
    if (doc.get('deletedAt')) continue;

    const assignee = asString(doc.get('assignedToUid'));
    if (!assignee) continue;

    summary.leadsDue += 1;
    byAssignee.set(assignee, [...(byAssignee.get(assignee) ?? []), asString(doc.get('name'))]);
  }

  for (const [assignee, leadNames] of byAssignee) {
    const body = [
      `You have ${leadNames.length} lead${leadNames.length === 1 ? '' : 's'} to follow up today:`,
      ...leadNames.map((name) => `• ${name}`),
    ].join('\n');

    await db.collection('communications').add({
      schemaVersion: 1,
      branchId: 'main',
      channel: 'email',
      direction: 'outbound',
      // The digest is about the assignee's own workload; it is addressed to a
      // staff member, so it references them rather than a lead or participant.
      refType: 'staff',
      refId: assignee,
      templateKey: 'internal.follow_up_digest',
      subject: `Follow-ups due today (${leadNames.length})`,
      bodyPreview: body.slice(0, 300),
      pendingBody: body,
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
    summary.digestsQueued += 1;
  }

  return summary;
}
