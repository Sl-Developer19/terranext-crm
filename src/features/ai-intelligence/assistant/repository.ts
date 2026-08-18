import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { evaluateRateLimit, type RateLimitState } from './logic';
import type { AssistantMessage, AssistantMessageRole, AssistantSource } from './schema';

/** AI Session Assistant data access — new collections only
 * (`aiSessionChats/{sessionId}/messages`, `aiAssistantRateLimit`). Actions
 * own permission + audit, same split as `../repository.ts`. */

const CHATS_COLLECTION = 'aiSessionChats';
const MESSAGES_SUBCOLLECTION = 'messages';
const RATE_LIMIT_COLLECTION = 'aiAssistantRateLimit';

function messagesRef(sessionId: string) {
  return adminDb().collection(CHATS_COLLECTION).doc(sessionId).collection(MESSAGES_SUBCOLLECTION);
}

function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}

function toSources(raw: unknown): AssistantSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
    .map((s) => ({
      startSec: typeof s.startSec === 'number' ? s.startSec : 0,
      endSec: typeof s.endSec === 'number' ? s.endSec : 0,
      speakerLabel: typeof s.speakerLabel === 'string' ? s.speakerLabel : 'Unknown speaker',
    }));
}

function toMessage(doc: FirebaseFirestore.QueryDocumentSnapshot): AssistantMessage {
  const data = doc.data();
  const role = data.role === 'assistant' ? 'assistant' : 'user';
  return {
    id: doc.id,
    role,
    content: typeof data.content === 'string' ? data.content : '',
    sources: toSources(data.sources),
    createdAt: toIso(data.createdAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  };
}

/** Every message for a session, oldest first — a classroom Q&A session is
 * expected to stay short enough (bounded further by `MAX_HISTORY_MESSAGES`
 * for what's actually replayed to the model) that paging is unnecessary. */
export async function findAssistantMessages(sessionId: string): Promise<AssistantMessage[]> {
  const snap = await messagesRef(sessionId).orderBy('createdAt', 'asc').limit(500).get();
  return snap.docs.map(toMessage);
}

export async function appendAssistantMessage(
  sessionId: string,
  role: AssistantMessageRole,
  content: string,
  createdBy: string,
  sources: AssistantSource[] = [],
): Promise<AssistantMessage> {
  const now = new Date();
  const chatRef = adminDb().collection(CHATS_COLLECTION).doc(sessionId);
  const ref = messagesRef(sessionId).doc();
  await adminDb().runTransaction(async (tx) => {
    const chatSnap = await tx.get(chatRef);
    tx.set(
      chatRef,
      {
        schemaVersion: 1,
        sessionId,
        updatedAt: now,
        messageCount: (chatSnap.exists ? ((chatSnap.get('messageCount') as number) ?? 0) : 0) + 1,
      },
      { merge: true },
    );
    tx.set(ref, {
      schemaVersion: 1,
      sessionId,
      role,
      content,
      sources,
      createdAt: now,
      createdBy,
    });
  });

  return { id: ref.id, role, content, sources, createdAt: now.toISOString(), createdBy };
}

function rateLimitDocId(uid: string, sessionId: string): string {
  return `${uid}_${sessionId}`;
}

/**
 * Atomically checks and consumes one request against the fixed-window rate
 * limit (Phase 13) — read, decide, and write happen inside one transaction
 * so two concurrent requests from the same trainer (a double-click, two
 * open tabs) can never both slip through under the cap.
 */
export async function checkAndConsumeAssistantRateLimit(
  uid: string,
  sessionId: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const ref = adminDb().collection(RATE_LIMIT_COLLECTION).doc(rateLimitDocId(uid, sessionId));
  const now = Date.now();

  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const state: RateLimitState | null = snap.exists
      ? {
          windowStartAt: (snap.get('windowStartAt') as number) ?? now,
          count: (snap.get('count') as number) ?? 0,
        }
      : null;

    const decision = evaluateRateLimit(state, now);
    if (!decision.allowed) return { allowed: false, retryAfterMs: decision.retryAfterMs };

    tx.set(ref, {
      uid,
      sessionId,
      windowStartAt: decision.next.windowStartAt,
      count: decision.next.count,
      updatedAt: new Date(now),
    });
    return { allowed: true };
  });
}
