'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminBucket } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import { internalError, notFoundError, ok, permissionError, type Result } from '@/lib/utils/result';

import { findSessionChunks, findSessionMeta } from '../repository';
import { getSessionAudioSchema, type GetSessionAudioInput, type PlaybackChunk } from '../schema';

/**
 * Playback for a finalized session's recording. Mirrors the participants
 * document-download pattern (`manage-documents.ts#issueDocumentDownloadUrl`):
 * a fresh, short-lived v4 read URL is minted per request and never persisted
 * — nothing durable ever holds a signed URL, so there is no permanent link
 * to leak or revoke. Every chunk still in Storage (an upload can only ever
 * add chunks, never remove one) gets its own URL; the player sequences them
 * into one continuous timeline client-side using `startOffsetSec`.
 */
const PLAYBACK_URL_TTL_MS = 15 * 60 * 1_000;

export async function getSessionPlaybackManifest(
  input: GetSessionAudioInput,
): Promise<Result<{ chunks: PlaybackChunk[] }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:view')) return permissionError();

  const parsed = getSessionAudioSchema.safeParse(input);
  if (!parsed.success) return internalError('Invalid session reference.');
  const { sessionId } = parsed.data;

  try {
    const meta = await findSessionMeta(sessionId);
    if (!meta) return notFoundError('Session not found.');

    // Recording still in progress: nothing to play yet, and chunks aren't
    // necessarily final (a paused session's last chunk hasn't been uploaded
    // at all — that only happens at Stop). Draft never has audio either.
    if (meta.status === 'draft' || meta.status === 'recording' || meta.status === 'paused') {
      return ok({ chunks: [] });
    }

    const allChunks = await findSessionChunks(sessionId);
    const playable = allChunks
      .filter((chunk) => chunk.storagePath !== null)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    if (playable.length === 0) return ok({ chunks: [] });

    const chunks = await Promise.all(
      playable.map(async (chunk): Promise<PlaybackChunk> => {
        const [url] = await adminBucket()
          .file(chunk.storagePath!)
          .getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + PLAYBACK_URL_TTL_MS,
          });
        return {
          chunkIndex: chunk.chunkIndex,
          url,
          startOffsetSec: chunk.startOffsetSec,
          durationSeconds: chunk.durationSeconds ?? 0,
        };
      }),
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'export',
      entityType: 'ai_session',
      entityId: sessionId,
      entityPath: `aiSessions/${sessionId}`,
      context: {
        feature: 'ai-intelligence',
        reason: `playback_url_issued:${chunks.length}_chunks`,
      },
    });

    return ok({ chunks });
  } catch {
    return internalError('Could not load the recorded audio. Please try again.');
  }
}
