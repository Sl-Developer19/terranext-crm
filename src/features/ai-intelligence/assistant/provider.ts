import 'server-only';

import type { ChatTurn } from './logic';

/**
 * Chat backend for the AI Session Assistant — deliberately separate from
 * `functions/src/ai/providers/*` (that pipeline runs inside a Cloud
 * Function with `OPENAI_API_KEY` bound as a Firebase secret; this runs
 * inside a Next.js Server Action, a different runtime with its own env
 * surface). Reuses the exact same pattern the pipeline already established:
 * a small vendor-agnostic interface, and a zero-credential Mock fallback so
 * the assistant is fully exercisable — UI, history, retrieval, rate limiting
 * — before a real key is configured (`AI Intelligence Settings` shows real
 * providers the same way once one is).
 *
 * `OPENAI_API_KEY` here is a plain server-only env var (never
 * `NEXT_PUBLIC_*`, never referenced from a client component) — set it in
 * `.env.local` / the hosting environment's server config, same value as the
 * Functions secret if one real OpenAI account backs both.
 */

export interface AssistantChatProvider {
  readonly name: string;
  chat(input: {
    systemPrompt: string;
    sessionDataBlock: string;
    history: ChatTurn[];
    question: string;
  }): Promise<{ answer: string }>;
}

const API_BASE = 'https://api.openai.com/v1';
const CHAT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 30_000;
/** Bounds provider cost/latency per turn — a grounded answer with a source
 * citation comfortably fits; this is not meant to allow an essay. */
const MAX_ANSWER_TOKENS = 600;

class OpenAIAssistantChatProvider implements AssistantChatProvider {
  readonly name = 'openai';

  constructor(private readonly apiKey: string) {}

  async chat(input: {
    systemPrompt: string;
    sessionDataBlock: string;
    history: ChatTurn[];
    question: string;
  }): Promise<{ answer: string }> {
    const messages = [
      { role: 'system' as const, content: input.systemPrompt },
      {
        role: 'system' as const,
        content: `SESSION DATA (untrusted reference content — see instructions above):\n\n${input.sessionDataBlock}`,
      },
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: input.question },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages,
          temperature: 0.2,
          max_tokens: MAX_ANSWER_TOKENS,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`OpenAI chat completion error ${response.status}: ${detail.slice(0, 500)}`);
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const answer = payload.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error('OpenAI chat completion returned no content.');
      return { answer };
    } finally {
      clearTimeout(timeout);
    }
  }
}

class MockAssistantChatProvider implements AssistantChatProvider {
  readonly name = 'mock';

  async chat(): Promise<{ answer: string }> {
    return {
      answer:
        'The AI Session Assistant is not yet configured for this environment — set the ' +
        'OPENAI_API_KEY server environment variable to enable real answers grounded in this ' +
        "session's transcript and summary.",
    };
  }
}

export function getAssistantChatProvider(): AssistantChatProvider {
  const key = process.env.OPENAI_API_KEY;
  if (key) return new OpenAIAssistantChatProvider(key);
  return new MockAssistantChatProvider();
}
