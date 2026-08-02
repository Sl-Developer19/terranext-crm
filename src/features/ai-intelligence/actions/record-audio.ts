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

import {
  findSessionMeta,
  findSessionUploadMeta,
  markSessionRecordedAndEnqueue,
  markSessionUploadFailed,
  reserveSessionAudioPath,
} from '../repository';
import {
  confirmAudioUploadSchema,
  requestAudioUploadSchema,
  type ConfirmAudioUploadInput,
  type RequestAudioUploadInput,
} from '../schema';

/**
 * Secure audio upload flow (mirrors Doc 10 §6): the browser never picks its
 * own Storage path. It asks for a signed PUT ticket bound to exactly this
 * session's audio path, uploads the bytes, then confirms — which is also
 * the moment the automatic processing pipeline is enqueued. The trainer
 * never sees an "Upload" or "Process" button; Stop Recording drives both
 * calls directly.
 */

const UPLOAD_URL_TTL_MS = 30 * 60 * 1_000;

export interface AudioUploadTicket {
  sessionId: string;
  uploadUrl: string;
  contentType: string;
}

export async function requestAudioUploadTicket(
  input: RequestAudioUploadInput,
): Promise<Result<AudioUploadTicket>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = requestAudioUploadSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }
  const { sessionId, contentType } = parsed.data;

  try {
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');
    if (meta.trainerUid !== session.uid && !can(session.role, 'aiIntelligence:configure')) {
      return permissionError('Only the session owner can record against it.');
    }
    if (meta.status !== 'draft') {
      return conflictError('This session has already started recording.');
    }

    const storagePath = await reserveSessionAudioPath(sessionId, contentType, session.uid);

    const [uploadUrl] = await adminBucket()
      .file(storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + UPLOAD_URL_TTL_MS,
        contentType,
      });

    return ok({ sessionId, uploadUrl, contentType });
  } catch {
    return internalError('Could not start the recording upload. Please try again.');
  }
}

export async function confirmAudioUpload(
  input: ConfirmAudioUploadInput,
): Promise<Result<{ status: 'processing' | 'failed'; jobId: string | null }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:create')) return permissionError();

  const parsed = confirmAudioUploadSchema.safeParse(input);
  if (!parsed.success) return validationError({ sessionId: 'Invalid session reference.' });
  const { sessionId, durationSeconds } = parsed.data;

  try {
    const meta = await findSessionUploadMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');
    if (meta.status !== 'recording') return conflictError('This session is not awaiting upload.');
    if (!meta.storagePath)
      return internalError('Recording path was not reserved for this session.');

    const file = adminBucket().file(meta.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      await markSessionUploadFailed(sessionId, session.uid);
      return ok({ status: 'failed', jobId: null });
    }

    const jobId = await markSessionRecordedAndEnqueue(
      sessionId,
      meta.title,
      durationSeconds,
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

    return ok({ status: 'processing', jobId });
  } catch {
    return internalError('Could not confirm the recording. Please try again.');
  }
}
