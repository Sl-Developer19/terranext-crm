'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { documentStoragePath } from '../logic';
import {
  createDocumentRecord,
  findDocumentById,
  findParticipantById,
  setDocumentStatus,
} from '../repository';
import {
  documentRefSchema,
  requestUploadTicketSchema,
  type DocumentRefInput,
  type RequestUploadTicketInput,
} from '../schema';

/**
 * Secure upload flow (Doc 10 §6). The client never writes to an arbitrary
 * Storage path: it asks for a ticket, receives a signed URL bound to exactly
 * one path + content type, PUTs the bytes, then calls `confirmDocumentUpload`
 * which verifies the object actually landed before marking it `ready`.
 * Storage rules stay default-deny — the signed URL is the only write path.
 */

const UPLOAD_URL_TTL_MS = 15 * 60 * 1_000;
const DOWNLOAD_URL_TTL_MS = 15 * 60 * 1_000;

export interface UploadTicket {
  documentId: string;
  uploadUrl: string;
  /** The client must send exactly this header or the signature will not match. */
  contentType: string;
}

export async function requestUploadTicket(
  input: RequestUploadTicketInput,
): Promise<Result<UploadTicket>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:update')) return permissionError();

  const parsed = requestUploadTicketSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { participantId, kind, fileName, sizeBytes, contentType } = parsed.data;

  try {
    const participant = await findParticipantById(participantId);
    if (!participant) return notFoundError('Participant not found.');

    // The metadata doc id is generated server-side and becomes part of the
    // storage path — that coupling is the authorization anchor (Doc 10 §6).
    const documentId = adminDb()
      .collection('participants')
      .doc(participantId)
      .collection('documents')
      .doc().id;
    const storagePath = documentStoragePath(participantId, documentId);

    await createDocumentRecord(participantId, documentId, {
      kind,
      fileName,
      sizeBytes,
      contentType,
      storagePath,
      uploadedBy: session.uid,
    });

    const [uploadUrl] = await adminBucket()
      .file(storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + UPLOAD_URL_TTL_MS,
        contentType,
      });

    return ok({ documentId, uploadUrl, contentType });
  } catch {
    return internalError('Could not start the upload. Please try again.');
  }
}

/**
 * Verifies the uploaded object against its metadata doc and flips it to
 * `ready` (the server-action equivalent of Doc 19's `onUploadFinalize`
 * trigger — a mismatch deletes the object and marks the record `rejected`,
 * so a client that lies about what it uploaded gains nothing).
 */
export async function confirmDocumentUpload(
  input: DocumentRefInput,
): Promise<Result<{ status: 'ready' | 'rejected' }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:update')) return permissionError();

  const parsed = documentRefSchema.safeParse(input);
  if (!parsed.success) return validationError({ documentId: 'Invalid document reference' });
  const { participantId, documentId } = parsed.data;

  try {
    const record = await findDocumentById(participantId, documentId);
    if (!record) return notFoundError('Document not found.');

    const file = adminBucket().file(record.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      await setDocumentStatus(participantId, documentId, 'rejected');
      return ok({ status: 'rejected' });
    }

    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size ?? 0);
    const actualType = metadata.contentType ?? '';
    const mismatched = actualType !== record.contentType || actualSize !== record.sizeBytes;

    if (mismatched) {
      await file.delete().catch(() => undefined);
      await setDocumentStatus(participantId, documentId, 'rejected');
      return ok({ status: 'rejected' });
    }

    await setDocumentStatus(participantId, documentId, 'ready');
    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'participant',
      entityId: participantId,
      entityPath: `participants/${participantId}/documents/${documentId}`,
      context: { feature: 'participants', reason: `document_upload:${record.kind}` },
    });

    return ok({ status: 'ready' });
  } catch {
    return internalError('Could not confirm the upload. Please try again.');
  }
}

/**
 * Issues a short-lived download URL. Every issuance is audited as an
 * `export` action — participant documents are Confidential data and the
 * SOP 17.16 System Access Log is what makes exfiltration reviewable (RR-09).
 */
export async function issueDocumentDownloadUrl(
  input: DocumentRefInput,
): Promise<Result<{ url: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'participants:view')) return permissionError();

  const parsed = documentRefSchema.safeParse(input);
  if (!parsed.success) return validationError({ documentId: 'Invalid document reference' });
  const { participantId, documentId } = parsed.data;

  try {
    const record = await findDocumentById(participantId, documentId);
    if (!record) return notFoundError('Document not found.');
    if (record.status !== 'ready') {
      return validationError({ documentId: 'This document is not available for download.' });
    }

    const [url] = await adminBucket()
      .file(record.storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + DOWNLOAD_URL_TTL_MS,
      });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'export',
      entityType: 'participant',
      entityId: participantId,
      entityPath: `participants/${participantId}/documents/${documentId}`,
      context: { feature: 'participants', reason: `document_download:${record.fileName}` },
    });

    return ok({ url });
  } catch {
    return internalError('Could not prepare the download. Please try again.');
  }
}
