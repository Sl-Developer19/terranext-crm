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

import { planExpectedChunkKeys, planSessionChunks } from '../logic';
import {
  findChunkMeta,
  findSessionChunks,
  findSessionMeta,
  finalizeSessionAndEnqueue,
  markChunkUploadFailed,
  markChunkUploaded,
  markSessionPaused,
  markSessionRecordingStarted,
  markSessionRecordingStartedIfDraft,
  markSessionResumed,
  reserveChunkUploadPath,
} from '../repository';
import {
  confirmChunkUploadSchema,
  finalizeSessionRecordingSchema,
  pauseSessionRecordingSchema,
  requestChunkUploadSchema,
  resumeSessionRecordingSchema,
  startSessionRecordingSchema,
  type ConfirmChunkUploadInput,
  type FinalizeSessionRecordingInput,
  type PauseSessionRecordingInput,
  type RequestChunkUploadInput,
  type ResumeSessionRecordingInput,
  type StartSessionRecordingInput,
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

/** Diagnostic trail for the ticket → PUT → confirm cycle — deliberately never
 * includes the signed URL itself or audio bytes, only the metadata needed to
 * pinpoint which step of which chunk's upload failed (Engineering 04 §8's
 * debugging checklist). Errors are logged here specifically because every
 * catch block below already swallows the real cause into a generic message
 * for the client — without this, "Something went wrong on our side. The
 * issue has been recorded" (see `internalError`'s default message) was not
 * actually being recorded anywhere. */
function logChunkEvent(event: string, context: Record<string, unknown>) {
  console.warn(`[ai-intelligence:chunk-upload] ${event}`, context);
}
function logChunkError(event: string, error: unknown, context: Record<string, unknown>) {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  console.error(`[ai-intelligence:chunk-upload] ${event}`, {
    ...context,
    code,
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Flips the session `draft` -> `recording` the instant the trainer's
 * MediaRecorder has actually started — called from `handleStart` right
 * after `MediaRecorder.start()` succeeds, before any chunk exists. Pause and
 * Resume both require the server-side session to already be `recording`, so
 * this can no longer be deferred until chunk 0's upload ticket (which may
 * not happen for up to `CHUNK_DURATION_SECONDS`).
 */
export async function startSessionRecording(
  input: StartSessionRecordingInput,
): Promise<Result<{ status: 'recording' }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = startSessionRecordingSchema.safeParse(input);
  if (!parsed.success) return validationError({ sessionId: 'Invalid session reference.' });
  const { sessionId } = parsed.data;

  try {
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');
    if (meta.trainerUid !== session.uid) {
      return permissionError('Only the session owner can start its recording.');
    }

    const outcome = await markSessionRecordingStartedIfDraft(sessionId, session.uid);
    if (outcome === 'invalid') {
      return conflictError('This session cannot be started from its current state.');
    }

    logChunkEvent('session recording started', { sessionId, outcome });
    return ok({ status: 'recording' });
  } catch (error) {
    logChunkError('startSessionRecording failed', error, { sessionId });
    return internalError('Could not start the recording. Please try again.');
  }
}

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
  const { sessionId, chunkIndex, channelIndex, contentType, sizeBytes, startOffsetSec } =
    parsed.data;

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
      channelIndex,
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

    logChunkEvent('ticket issued', { sessionId, chunkIndex, storagePath, contentType, sizeBytes });
    return ok({ sessionId, chunkIndex, uploadUrl, contentType });
  } catch (error) {
    logChunkError('requestChunkUploadTicket failed', error, {
      sessionId,
      chunkIndex,
      contentType,
      sizeBytes,
    });
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
  const { sessionId, chunkIndex, channelIndex, durationSeconds } = parsed.data;

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

    const chunkMeta = await findChunkMeta(sessionId, chunkIndex, channelIndex);
    if (!chunkMeta) return notFoundError('Chunk not found.');
    if (!chunkMeta.storagePath) return internalError('Chunk path was not reserved.');

    const file = adminBucket().file(chunkMeta.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      logChunkEvent('confirm failed: object missing in Storage after PUT', {
        sessionId,
        chunkIndex,
        channelIndex,
        storagePath: chunkMeta.storagePath,
      });
      await markChunkUploadFailed(sessionId, chunkIndex, session.uid, channelIndex);
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
      logChunkEvent('confirm failed: content-type/size mismatch', {
        sessionId,
        chunkIndex,
        storagePath: chunkMeta.storagePath,
        expectedSizeBytes: chunkMeta.expectedSizeBytes,
        actualSize,
        expectedContentType: chunkMeta.contentType,
        actualContentType: actualType,
      });
      await file.delete().catch(() => undefined);
      await markChunkUploadFailed(sessionId, chunkIndex, session.uid, channelIndex);
      return ok({ status: 'failed' });
    }

    await markChunkUploaded(sessionId, chunkIndex, durationSeconds, session.uid, channelIndex);
    logChunkEvent('chunk confirmed uploaded', {
      sessionId,
      chunkIndex,
      channelIndex,
      storagePath: chunkMeta.storagePath,
      durationSeconds,
    });
    // No per-chunk audit entry — chunk upload is upload plumbing, not a
    // business event on its own. finalizeSessionRecording below is the
    // audited moment ("recording stopped, processing enqueued"), matching
    // what was previously a single audit point in the unchunked flow.
    return ok({ status: 'uploaded' });
  } catch (error) {
    logChunkError('confirmChunkUpload failed', error, { sessionId, chunkIndex });
    return internalError('Could not confirm the chunk. Please try again.');
  }
}

/**
 * Pauses an in-progress recording. The recorder itself (`MediaRecorder.
 * pause()`) is native and instantaneous, but the client waits for this call
 * to resolve `ok: true` before pausing it — that way, if this request is
 * lost to a network interruption, the mic keeps recording rather than the
 * browser and server disagreeing about whether the session is paused.
 */
export async function pauseSessionRecording(
  input: PauseSessionRecordingInput,
): Promise<Result<{ status: 'paused' }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = pauseSessionRecordingSchema.safeParse(input);
  if (!parsed.success) return validationError({ sessionId: 'Invalid session reference.' });
  const { sessionId } = parsed.data;

  try {
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');
    if (meta.trainerUid !== session.uid) {
      return permissionError('Only the session owner can pause its recording.');
    }

    const paused = await markSessionPaused(sessionId, session.uid);
    if (!paused) return conflictError('This session is not currently recording.');

    return ok({ status: 'paused' });
  } catch {
    return internalError('Could not pause the recording. Please try again.');
  }
}

/** Resumes a paused recording — see `pauseSessionRecording` for the same server-first ordering rationale. */
export async function resumeSessionRecording(
  input: ResumeSessionRecordingInput,
): Promise<Result<{ status: 'recording' }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = resumeSessionRecordingSchema.safeParse(input);
  if (!parsed.success) return validationError({ sessionId: 'Invalid session reference.' });
  const { sessionId } = parsed.data;

  try {
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');
    if (meta.trainerUid !== session.uid) {
      return permissionError('Only the session owner can resume its recording.');
    }

    const resumed = await markSessionResumed(sessionId, session.uid);
    if (!resumed) return conflictError('This session is not currently paused.');

    return ok({ status: 'recording' });
  } catch {
    return internalError('Could not resume the recording. Please try again.');
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
  const { sessionId, totalChunks, totalDurationSeconds, capturedChannelCount } = parsed.data;

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
    // Stop is valid from 'paused' too — MediaRecorder.stop() works from
    // either state, and finalizeSessionAndEnqueue closes any trailing open
    // pause event itself, so the trainer never has to click Resume first.
    if (meta.status !== 'recording' && meta.status !== 'paused') {
      return conflictError('This session is not currently recording.');
    }

    // Every chunk the client says it produced must actually be present and
    // uploaded before processing is enqueued — a dropped chunk upload must
    // never silently leave a gap in the transcript. `expectedKeys` is the
    // full (chunkIndex, channelIndex) matrix: exactly the old flat
    // `channelIndex: null` sequence when `capturedChannelCount <= 1` (every
    // session today), one key per physical channel per time-chunk otherwise.
    const chunks = await findSessionChunks(sessionId);
    const expectedKeys = planExpectedChunkKeys(totalDurationSeconds, capturedChannelCount);
    if (chunks.length !== expectedKeys.length) {
      logChunkEvent('finalize failed: chunk count mismatch', {
        sessionId,
        expectedTotalChunks: expectedKeys.length,
        foundChunks: chunks.length,
      });
      return conflictError(`Expected ${expectedKeys.length} chunks, found ${chunks.length}.`);
    }
    const chunkByKey = new Map(
      chunks.map((chunk) => [`${chunk.chunkIndex}:${chunk.channelIndex ?? 'null'}`, chunk]),
    );
    for (const key of expectedKeys) {
      const mapKey = `${key.chunkIndex}:${key.channelIndex ?? 'null'}`;
      const chunk = chunkByKey.get(mapKey);
      const label =
        key.channelIndex === null
          ? `${key.chunkIndex}`
          : `${key.chunkIndex} (channel ${key.channelIndex})`;
      if (!chunk) {
        logChunkEvent('finalize failed: chunk missing', {
          sessionId,
          chunkIndex: key.chunkIndex,
          channelIndex: key.channelIndex,
        });
        return conflictError(`Chunk ${label} is missing.`);
      }
      if (chunk.status !== 'uploaded') {
        logChunkEvent('finalize failed: chunk not uploaded', {
          sessionId,
          chunkIndex: key.chunkIndex,
          channelIndex: key.channelIndex,
          status: chunk.status,
        });
        return conflictError(`Chunk ${label} has not finished uploading yet.`);
      }
    }

    const jobId = await finalizeSessionAndEnqueue(
      sessionId,
      meta.title,
      totalChunks,
      totalDurationSeconds,
      session.uid,
      capturedChannelCount,
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

    logChunkEvent('session finalized', { sessionId, jobId, totalChunks, totalDurationSeconds });
    return ok({ jobId });
  } catch (error) {
    logChunkError('finalizeSessionRecording failed', error, {
      sessionId,
      totalChunks,
      totalDurationSeconds,
    });
    return internalError('Could not finalize the recording. Please try again.');
  }
}
