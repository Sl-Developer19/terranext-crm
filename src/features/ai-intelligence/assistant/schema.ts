import { z } from 'zod';

/**
 * AI Session Assistant (session-scoped conversational assistant over a
 * completed session's transcript + summary). New collection only
 * (`aiSessionChats/{sessionId}/messages`) — no existing AI Intelligence
 * collection is touched. See `logic.ts` for the retrieval/prompt-budget
 * rules referenced by the constants below.
 */

export const ASSISTANT_MESSAGE_ROLES = ['user', 'assistant'] as const;
export type AssistantMessageRole = (typeof ASSISTANT_MESSAGE_ROLES)[number];

/** A user question longer than this is rejected before it ever reaches a
 * provider — generous enough for a genuine follow-up question, far short of
 * what would let a trainer paste in unrelated text to burn tokens. */
export const MAX_QUESTION_LENGTH = 1000;

/** How many prior turns (user + assistant messages combined) are replayed
 * as conversation history on each new question — bounds both the token cost
 * of every request and how far back "explain the second point" can
 * reasonably reach. 12 messages = 6 user/assistant exchanges. */
export const MAX_HISTORY_MESSAGES = 12;

/** How many transcript windows (see `logic.ts#buildTranscriptWindows`) are
 * ever included as retrieved context for one question — the cap that keeps
 * a 90-minute session from being resent in full on every turn (Phase 9). */
export const MAX_CONTEXT_WINDOWS = 6;

/** Per-window character ceiling once selected — a window's raw text is
 * truncated to this before being placed in the prompt, so one unusually
 * dense window can't crowd out the others in the context budget. */
export const MAX_WINDOW_CHARS = 700;

/** Fixed-window request cap: at most this many questions per session per
 * rolling window (Phase 13 cost/performance protection), tracked per
 * (uid, sessionId) so one runaway tab can't be attributed to every trainer
 * using the assistant elsewhere. */
export const RATE_LIMIT_MAX_REQUESTS = 12;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

export const askSessionAssistantSchema = z.object({
  sessionId: z.string().min(1),
  question: z
    .string()
    .trim()
    .min(1, 'Ask a question first.')
    .max(MAX_QUESTION_LENGTH, 'That question is too long — please shorten it.'),
});
export type AskSessionAssistantInput = z.infer<typeof askSessionAssistantSchema>;

/** One retrieved transcript excerpt cited as the basis for an answer —
 * rendered as "Source: 00:42:18 – 00:43:51" under the assistant's reply
 * (Phase 9). Never present on a `'user'` message. */
export interface AssistantSource {
  startSec: number;
  endSec: number;
  /** Dominant speaker label across the window, for display only. */
  speakerLabel: string;
}

export interface AssistantMessage {
  id: string;
  role: AssistantMessageRole;
  content: string;
  sources: AssistantSource[];
  createdAt: string;
  createdBy: string;
}
