import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { emailSignature, smsSignature } from '@/config/organisation';
import { getBrandingSettings } from '@/features/settings/queries';
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
 *
 * `dispatchQueuedCommunications`'s `limit(BATCH_SIZE)` has no `orderBy`, so on
 * a queue with more than `BATCH_SIZE` rows due at once, any given pass only
 * examines an arbitrary subset — a message sent interactively is not
 * guaranteed a slot just because it is new. `dispatchOneCommunication` exists
 * for exactly that case: the send path calls it with the row it just wrote,
 * so that row always gets attempted immediately regardless of backlog size,
 * while the scheduled sweep above still owns bulk draining and retries.
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
  emailLogoUrl: string,
) {
  if (channel === 'email') {
    // eslint-disable-next-line no-console
    console.log('[email] sending communication to recipient:', to);
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
        ...(emailLogoUrl ? { logoUrl: emailLogoUrl } : {}),
      }),
    });
  }
  const provider = channel === 'whatsapp' ? getWhatsAppProvider() : getSmsProvider();
  return provider.send({ to, body: `${body}${smsSignature()}` });
}

type RowOutcome = 'sent' | 'failed' | 'requeued' | 'skipped';

/**
 * Attempts one row and writes its resulting status. Shared by the scheduled
 * batch sweep and the single-row immediate dispatch so both follow the exact
 * same due-check, send, backoff, and error-isolation behaviour.
 */
async function processRow(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  now: Date,
  appOrigin: string,
  emailLogoUrl: string,
): Promise<RowOutcome> {
  const nextAttemptRaw = doc.get('nextAttemptAt');
  const nextAttemptAt = nextAttemptRaw instanceof Timestamp ? nextAttemptRaw.toDate() : null;
  if (!isDue(nextAttemptAt, now)) return 'skipped';

  const channel = (asString(doc.get('channel')) || 'email') as Channel;
  const refType = (asString(doc.get('refType')) || 'lead') as RefType;
  const refId = asString(doc.get('refId'));
  const attempts = typeof doc.get('attempts') === 'number' ? (doc.get('attempts') as number) : 0;

  // Isolate this row's failure from the rest of the batch — a provider call
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
      outcome = await send(
        channel,
        address,
        asString(doc.get('subject')),
        body,
        appOrigin,
        emailLogoUrl,
      );
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

    if (decision.status === 'sent') return 'sent';
    if (decision.status === 'failed') return 'failed';
    return 'requeued';
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('communications dispatch: row failed, leaving it queued for retry', {
      communicationId: doc.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'skipped';
  }
}

export async function dispatchQueuedCommunications(
  now: Date = new Date(),
  appOrigin = 'https://terranextglobal.com',
): Promise<DispatchSummary> {
  const db = adminDb();
  const summary: DispatchSummary = { examined: 0, sent: 0, failed: 0, requeued: 0, skipped: 0 };

  const [snap, branding] = await Promise.all([
    db
      .collection('communications')
      .where('status', '==', 'queued')
      .where('direction', '==', 'outbound')
      .limit(BATCH_SIZE)
      .get(),
    getBrandingSettings(),
  ]);

  for (const doc of snap.docs) {
    summary.examined += 1;
    summary[await processRow(doc, now, appOrigin, branding.emailLogoUrl)] += 1;
  }

  return summary;
}

/**
 * Dispatches exactly the row just written by the send action, immediately —
 * not a slice of whatever else happens to be queued. `dispatchQueuedCommunications`'s
 * `limit(BATCH_SIZE)` has no ordering, so on a backlog bigger than
 * `BATCH_SIZE` a fresh message is not guaranteed a slot in any given pass and
 * could sit for several 5-minute scheduler cycles before it is finally
 * examined. Targeting the one row this caller just created removes that
 * chance entirely, while leaving the scheduled sweep's bulk-drain/retry role
 * untouched for everything else.
 */
export async function dispatchOneCommunication(
  communicationId: string,
  now: Date = new Date(),
  appOrigin = 'https://terranextglobal.com',
): Promise<DispatchSummary> {
  const summary: DispatchSummary = { examined: 0, sent: 0, failed: 0, requeued: 0, skipped: 0 };

  const doc = await adminDb().collection('communications').doc(communicationId).get();
  if (!doc.exists) return summary;
  if (doc.get('status') !== 'queued' || doc.get('direction') !== 'outbound') return summary;

  const branding = await getBrandingSettings();
  summary.examined = 1;
  summary[await processRow(doc, now, appOrigin, branding.emailLogoUrl)] += 1;
  return summary;
}
