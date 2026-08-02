'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminBucket } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { planSessionChunks } from '../logic';
import {
  findChunkMeta,
  findSessionChunks,
  findSessionMeta,
  finalizeSessionAndEnqueue,
  markChunkUploadFailed,
  markChunkUploaded,
  markSessionRecordingStarted,
  reserveChunkUploadPath,
} from '../repository';
import {
  confirmChunkUploadSchema,
  finalizeSessionRecordingSchema,
  requestChunkUploadSchema,
  type ConfirmChunkUploadInput,
  type FinalizeSessionRecordingInput,
  type RequestChunkUploadInput,
} from '../schema';

/**
 * Secure, chunked audio upload flow (mirrors Doc 10 §6, extended for long
 * sessions): the browser never picks its own Storage path. The recorder
 * rolls over to a new ~10-minute chunk automatically, and each chunk goes
 * through the same ticket → PUT → confirm cycle independently while
 * recording continues in the background. `finalizeSessionRecording` is the
 * single point where "recording stopped" becomes "processing enqueued" —
 * the trainer never sees an "Upload" or "Process" control for the whole
 * session, let alone per chunk.
 */

const UPLOAD_URL_TTL_MS = 30 * 60 * 1_000;

export interface ChunkUploadTicket {
  sessionId: string;
  chunkIndex: number;
  uploadUrl: string;
  contentType: string;
}

export async function requestChunkUploadTicket(
  input: RequestChunkUploadInput,
): Promise<Result<ChunkUploadTicket>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = requestChunkUploadSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }
  const { sessionId, chunkIndex, contentType, sizeBytes, startOffsetSec } = parsed.data;

  try {
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');
    if (meta.trainerUid !== session.uid) {
      return permissionError('Only the session owner can record against it.');
    }

    // Chunk 0 is the Start-recording moment: the session is either still a
    // fresh draft (the normal case) or already 'recording' (a retried
    // ticket request after a transient failure on the *first* attempt's PUT
    // — that first attempt already flipped the status, so this one must
    // tolerate finding it already flipped rather than reject it). Every
    // later chunk is a rollover mid-recording, so the session must already
    // be actively recording.
    const statusIsAcceptable =
      chunkIndex === 0
        ? meta.status === 'draft' || meta.status === 'recording'
        : meta.status === 'recording';
    if (!statusIsAcceptable) {
      return conflictError(
        chunkIndex === 0
          ? 'This session has already finished recording.'
          : 'This session is not currently recording.',
      );
    }

    const storagePath = await reserveChunkUploadPath(
      sessionId,
      chunkIndex,
      contentType,
      sizeBytes,
      startOffsetSec,
      session.uid,
    );
    // Only the actual draft->recording transition sets startedAt — a retry
    // that finds the session already recording must not push the recorded
    // start time forward on every retried request.
    if (chunkIndex === 0 && meta.status === 'draft') {
      await markSessionRecordingStarted(sessionId, session.uid);
    }

    const [uploadUrl] = await adminBucket()
      .file(storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + UPLOAD_URL_TTL_MS,
        contentType,
      });

    return ok({ sessionId, chunkIndex, uploadUrl, contentType });
  } catch {
    return internalError('Could not start the chunk upload. Please try again.');
  }
}

export async function confirmChunkUpload(
  input: ConfirmChunkUploadInput,
): Promise<Result<{ status: 'uploaded' | 'failed' }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = confirmChunkUploadSchema.safeParse(input);
  if (!parsed.success) return validationError({ sessionId: 'Invalid chunk reference.' });
  const { sessionId, chunkIndex, durationSeconds } = parsed.data;

  try {
    const sessionMeta = await findSessionMeta(sessionId);
    if (!sessionMeta) return notFoundError('Session not found.');
    if (sessionMeta.trainerUid !== session.uid) {
      return permissionError('Only the session owner can confirm its recording.');
    }
    // Still true for the very last chunk too — the session doesn't move to
    // 'processing' until finalizeSessionRecording, after every chunk (this
    // one included) is confirmed.
    if (sessionMeta.status !== 'recording') {
      return conflictError('This session is not currently recording.');
    }

    const chunkMeta = await findChunkMeta(sessionId, chunkIndex);
    if (!chunkMeta) return notFoundError('Chunk not found.');
    if (!chunkMeta.storagePath) return internalError('Chunk path was not reserved.');

    const file = adminBucket().file(chunkMeta.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      await markChunkUploadFailed(sessionId, chunkIndex, session.uid);
      return ok({ status: 'failed' });
    }

    // Same verification as the participant-documents upload flow (Doc 10
    // §6): the signed URL constrains Content-Type but not size, so this is
    // the only backstop against a client that requested a ticket for one
    // payload and PUT a different one.
    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size ?? 0);
    const actualType = metadata.contentType ?? '';
    const mismatched =
      (chunkMeta.expectedSizeBytes !== null && actualSize !== chunkMeta.expectedSizeBytes) ||
      (chunkMeta.contentType !== null && actualType !== chunkMeta.contentType);
    if (mismatched) {
      await file.delete().catch(() => undefined);
      await markChunkUploadFailed(sessionId, chunkIndex, session.uid);
      return ok({ status: 'failed' });
    }

    await markChunkUploaded(sessionId, chunkIndex, durationSeconds, session.uid);
    // No per-chunk audit entry — chunk upload is upload plumbing, not a
    // business event on its own. finalizeSessionRecording below is the
    // audited moment ("recording stopped, processing enqueued"), matching
    // what was previously a single audit point in the unchunked flow.
    return ok({ status: 'uploaded' });
  } catch {
    return internalError('Could not confirm the chunk. Please try again.');
  }
}

export async function finalizeSessionRecording(
  input: FinalizeSessionRecordingInput,
): Promise<Result<{ jobId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = finalizeSessionRecordingSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }
  const { sessionId, totalChunks, totalDurationSeconds } = parsed.data;

  const expectedChunkCount = planSessionChunks(totalDurationSeconds).length;
  if (expectedChunkCount !== totalChunks) {
    return validationError({
      totalChunks: 'Chunk count does not match the reported recording length.',
    });
  }

  try {
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');
    if (meta.trainerUid !== session.uid) {
      return permissionError('Only the session owner can finalize its recording.');
    }
    if (meta.status !== 'recording') {
      return conflictError('This session is not currently recording.');
    }

    // Every chunk the client says it produced must actually be present and
    // uploaded before processing is enqueued — a dropped chunk upload must
    // never silently leave a gap in the transcript.
    const chunks = await findSessionChunks(sessionId);
    if (chunks.length !== totalChunks) {
      return conflictError(`Expected ${totalChunks} chunks, found ${chunks.length}.`);
    }
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      if (!chunk || chunk.chunkIndex !== i) {
        return conflictError(`Chunk ${i} is missing.`);
      }
      if (chunk.status !== 'uploaded') {
        return conflictError(`Chunk ${i} has not finished uploading yet.`);
      }
    }

    const jobId = await finalizeSessionAndEnqueue(
      sessionId,
      meta.title,
      totalChunks,
      totalDurationSeconds,
      session.uid,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'ai_session',
      entityId: sessionId,
      entityPath: `aiSessions/${sessionId}`,
      changes: { status: { before: 'recording', after: 'processing' } },
      context: { feature: 'ai-intelligence', reason: 'recording_stopped_auto_pipeline' },
    });

    return ok({ jobId });
  } catch {
    return internalError('Could not finalize the recording. Please try again.');
  }
}
