import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type {
  Channel,
  CommStatus,
  Communication,
  Direction,
  RecipientOption,
  RefType,
} from './schema';

/** Communications log data access (Doc 03 §1.7, Doc 14 §19). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}
function toIsoOrNull(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

/** Names for both ref types in one pass — the log mixes leads and participants. */
async function refNames(): Promise<Map<string, string>> {
  const db = adminDb();
  const [leads, participants, users] = await Promise.all([
    db.collection('leads').get(),
    db.collection('participants').get(),
    db.collection('users').get(),
  ]);

  const names = new Map<string, string>();
  for (const doc of leads.docs) {
    names.set(`lead:${doc.id}`, asString(doc.get('name')));
  }
  for (const doc of participants.docs) {
    const personal = (doc.get('personal') ?? {}) as Record<string, unknown>;
    names.set(`participant:${doc.id}`, asString(personal.fullName));
  }
  // Staff rows exist for internal digests (follow-up digest, Doc 19 §4).
  for (const doc of users.docs) {
    names.set(`staff:${doc.id}`, asString(doc.get('displayName')));
  }
  return names;
}

export async function findCommunications(): Promise<Communication[]> {
  const [snap, names] = await Promise.all([
    adminDb().collection('communications').orderBy('createdAt', 'desc').limit(500).get(),
    refNames(),
  ]);

  return snap.docs.map((doc) => {
    const data = doc.data();
    const refType = (asString(data.refType) || 'lead') as RefType;
    const refId = asString(data.refId);
    return {
      id: doc.id,
      channel: (asString(data.channel) || 'email') as Channel,
      direction: (asString(data.direction) || 'outbound') as Direction,
      refType,
      refId,
      refName: names.get(`${refType}:${refId}`) || refId,
      templateKey: asStringOrNull(data.templateKey),
      subject: asStringOrNull(data.subject),
      bodyPreview: asString(data.bodyPreview),
      status: (asString(data.status) || 'queued') as CommStatus,
      sentAt: toIsoOrNull(data.sentAt),
      byUid: asString(data.byUid),
      createdAt: toIso(data.createdAt),
    };
  });
}

export async function findRecipientOptions(): Promise<RecipientOption[]> {
  const db = adminDb();
  const [leads, participants] = await Promise.all([
    db.collection('leads').orderBy('name').limit(500).get(),
    db.collection('participants').limit(500).get(),
  ]);

  const options: RecipientOption[] = leads.docs.map((doc) => ({
    id: doc.id,
    name: asString(doc.get('name')),
    refType: 'lead' as const,
  }));

  for (const doc of participants.docs) {
    const personal = (doc.get('personal') ?? {}) as Record<string, unknown>;
    options.push({ id: doc.id, name: asString(personal.fullName), refType: 'participant' });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export async function refExists(refType: RefType, refId: string): Promise<boolean> {
  const collection = refType === 'lead' ? 'leads' : 'participants';
  const snap = await adminDb().collection(collection).doc(refId).get();
  return snap.exists;
}

export interface CommunicationWriteModel {
  channel: Channel;
  direction: Direction;
  refType: RefType;
  refId: string;
  templateKey: string | null;
  subject: string | null;
  bodyPreview: string;
  status: CommStatus;
  sentAt: Date | null;
  /**
   * Full body, held only until dispatch succeeds and then deleted.
   *
   * Doc 14 §19 says the provider is the system of record for message bodies
   * and the log keeps a preview — but an asynchronous worker cannot send text
   * it does not have. Holding the body transiently satisfies both: dispatch
   * has what it needs, and the durable log still carries only the preview.
   */
  pendingBody?: string | null;
}

export async function createCommunicationRecord(
  input: CommunicationWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('communications').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    channel: input.channel,
    direction: input.direction,
    refType: input.refType,
    refId: input.refId,
    templateKey: input.templateKey,
    subject: input.subject,
    bodyPreview: input.bodyPreview,
    status: input.status,
    sentAt: input.sentAt,
    pendingBody: input.pendingBody ?? null,
    attempts: 0,
    nextAttemptAt: input.status === 'queued' ? new Date() : null,
    failureReason: null,
    byUid: actorUid,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return ref.id;
}
