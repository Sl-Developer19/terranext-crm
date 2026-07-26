import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { emailSignature, smsSignature } from '@/config/organisation';
import { adminDb } from '@/lib/firebase/admin';
import { renderBrandedEmailHtml } from '@/lib/messaging/email-template';
import { getEmailProvider, getSmsProvider, getWhatsAppProvider } from '@/lib/messaging/providers';
import type { SendOutcome } from '@/lib/messaging/types';

import { decideNext, isDue } from './dispatch-logic';
import type { Channel, RefType } from './schema';

/**
 * Communications dispatch worker (FR-10.3, Doc 19).
 *
 * Runs on a schedule and drains the queue the send path wrote. The log doc
 * always exists before this runs — the worker's only job is to move a message
 * from `queued` to `sent` or `failed` and to say why.
 *
 * Ordering guarantee this deliberately does not make: messages are not sent in
 * a strict sequence. They are independent notifications, and serialising them
 * would let one slow recipient hold up everyone else's.
 */

const BATCH_SIZE = 25;

export interface DispatchSummary {
  examined: number;
  sent: number;
  failed: number;
  requeued: number;
  skipped: number;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Resolves the destination address for the row's ref, or null if unreachable. */
async function resolveAddress(
  refType: RefType,
  refId: string,
  channel: Channel,
): Promise<string | null> {
  const collection = refType === 'lead' ? 'leads' : refType === 'staff' ? 'users' : 'participants';
  const doc = await adminDb().collection(collection).doc(refId).get();
  if (!doc.exists) return null;

  if (refType === 'staff') {
    // Internal digests are email-only; a staff member's phone is not a
    // notification channel we have consent to use.
    return channel === 'email' ? asString(doc.get('email')) || null : null;
  }

  if (refType === 'lead') {
    return channel === 'email'
      ? asString(doc.get('email')) || null
      : asString(doc.get('phone')) || null;
  }

  const personal = (doc.get('personal') ?? {}) as Record<string, unknown>;
  return channel === 'email' ? asString(personal.email) || null : asString(personal.phone) || null;
}

/**
 * The single outbound chokepoint, which is why the signature is appended here
 * rather than baked into template bodies. Every message — templated, manually
 * composed, or a system digest — leaves signed, and changing the contact
 * number is a one-line config edit rather than a sweep through every template.
 * Stored bodies stay clean of presentation.
 */
async function send(
  channel: Channel,
  to: string,
  subject: string,
  body: string,
  appOrigin: string,
) {
  if (channel === 'email') {
    return getEmailProvider().send({
      to,
      subject,
      body: `${body}\n${emailSignature()}`,
      // bodyText is the raw message only — the branded layout has its own
      // footer with the same org identity, so the plain-text emailSignature()
      // above is not duplicated into the HTML alternative.
      html: renderBrandedEmailHtml({
        heading: subject || 'Message from TerraNext Global Ventures',
        bodyText: body,
        appOrigin,
      }),
    });
  }
  const provider = channel === 'whatsapp' ? getWhatsAppProvider() : getSmsProvider();
  return provider.send({ to, body: `${body}${smsSignature()}` });
}

export async function dispatchQueuedCommunications(
  now: Date = new Date(),
  appOrigin = 'https://terranextglobal.com',
): Promise<DispatchSummary> {
  const db = adminDb();
  const summary: DispatchSummary = { examined: 0, sent: 0, failed: 0, requeued: 0, skipped: 0 };

  const snap = await db
    .collection('communications')
    .where('status', '==', 'queued')
    .where('direction', '==', 'outbound')
    .limit(BATCH_SIZE)
    .get();

  for (const doc of snap.docs) {
    summary.examined += 1;

    const nextAttemptRaw = doc.get('nextAttemptAt');
    const nextAttemptAt = nextAttemptRaw instanceof Timestamp ? nextAttemptRaw.toDate() : null;
    if (!isDue(nextAttemptAt, now)) {
      summary.skipped += 1;
      continue;
    }

    const channel = (asString(doc.get('channel')) || 'email') as Channel;
    const refType = (asString(doc.get('refType')) || 'lead') as RefType;
    const refId = asString(doc.get('refId'));
    const attempts = typeof doc.get('attempts') === 'number' ? (doc.get('attempts') as number) : 0;

    // Isolate one row's failure from the rest of the batch — a provider call
    // that throws (rather than resolving to a SendOutcome) or a transient
    // Firestore write error must not abort every other queued message this
    // pass, and must not silently strand a row whose email may already have
    // gone out. The row is left untouched on error so the next pass retries
    // it rather than reporting a false status.
    try {
      // The body is held transiently for exactly this moment; if it is gone
      // the preview is all that survives, and sending a truncated message
      // would be worse than reporting the problem.
      const body = asString(doc.get('pendingBody'));
      const address = await resolveAddress(refType, refId, channel);

      let outcome: SendOutcome;
      if (!address) {
        outcome = {
          status: 'failed',
          reason: `No ${channel === 'email' ? 'email address' : 'phone number'} on file for this ${refType}.`,
        };
      } else if (!body) {
        outcome = { status: 'failed', reason: 'Message body is no longer available to send.' };
      } else {
        outcome = await send(channel, address, asString(doc.get('subject')), body, appOrigin);
      }

      const decision = decideNext(outcome, attempts, now);

      await doc.ref.update({
        status: decision.status,
        failureReason: decision.failureReason,
        attempts: FieldValue.increment(1),
        nextAttemptAt: decision.nextAttemptAt,
        ...(decision.status === 'sent'
          ? {
              sentAt: now,
              // Body deleted on success: the provider is the system of record
              // from here on, and the log keeps its preview (Doc 14 §19).
              pendingBody: FieldValue.delete(),
            }
          : {}),
        ...(decision.status === 'failed' ? { pendingBody: FieldValue.delete() } : {}),
        updatedAt: now,
        updatedBy: 'system',
      });

      if (decision.status === 'sent') summary.sent += 1;
      else if (decision.status === 'failed') summary.failed += 1;
      else summary.requeued += 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('dispatchQueuedCommunications: row failed, leaving it queued for retry', {
        communicationId: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });
      summary.skipped += 1;
    }
  }

  return summary;
}
