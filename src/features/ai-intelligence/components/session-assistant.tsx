'use client';

import { Bot, Send, User } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';

import { askSessionAssistant } from '../actions/ask-session-assistant';
import type { AssistantMessage } from '../assistant/schema';
import { MAX_QUESTION_LENGTH } from '../assistant/schema';
import { formatDuration } from '../logic';

const SUGGESTED_PROMPTS = [
  'What were the main topics?',
  'Summarize the session',
  'What questions did students ask?',
  'What did the trainer explain?',
  'Give me revision notes',
];

/** Optimistic local id for a user message not yet confirmed by the server —
 * replaced by the real persisted id once `askSessionAssistant` resolves, or
 * removed entirely if the request fails so the conversation never shows a
 * question the assistant never actually saw. */
function tempId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * AI Session Assistant (Phase 7) — a session-scoped, multi-turn chat over
 * this one session's transcript and summary. Every message round-trips
 * through `askSessionAssistant`, which re-checks permission, retrieves
 * relevant transcript excerpts server-side, and persists both sides of the
 * exchange — this component only renders what the server already decided
 * happened, plus the optimistic in-flight question.
 */
export function SessionAssistant({
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: AssistantMessage[];
}) {
  const [messages, setMessages] = React.useState<AssistantMessage[]>(initialMessages);
  const [question, setQuestion] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    if (trimmed.length > MAX_QUESTION_LENGTH) {
      toast.error('That question is too long — please shorten it.');
      return;
    }

    setPending(true);
    const optimisticId = tempId();
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: 'user',
        content: trimmed,
        sources: [],
        createdAt: new Date().toISOString(),
        createdBy: 'you',
      },
    ]);
    setQuestion('');

    try {
      const result = await askSessionAssistant({ sessionId, question: trimmed });
      if (!result.ok) {
        toast.error(result.error.message);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        return;
      }
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        result.data.userMessage,
        result.data.assistantMessage,
      ]);
    } catch {
      toast.error('Could not reach the AI Session Assistant. Please try again.');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(question);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-4 text-gold" aria-hidden />
          AI Session Assistant
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Answers are grounded in this session&apos;s transcript and summary only — it will say so
          when something wasn&apos;t covered, rather than guess.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={scrollRef} className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground">
              Hi! I can help you understand this recorded session — ask a question or try a
              suggestion below.
            </p>
          ) : (
            messages.map((message) => <ChatBubble key={message.id} message={message} />)
          )}
          {pending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="size-3.5 shrink-0" aria-hidden />
              Thinking…
            </div>
          ) : null}
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void send(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(question);
              }
            }}
            placeholder="Ask about this session…"
            maxLength={MAX_QUESTION_LENGTH}
            rows={1}
            disabled={pending}
            className="min-h-10 resize-none"
            aria-label="Ask the AI Session Assistant"
          />
          <Button type="submit" disabled={pending || !question.trim()}>
            <Send aria-hidden />
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ChatBubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-secondary text-foreground' : 'bg-gold/15 text-gold-hover',
        )}
        aria-hidden
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] space-y-1.5 rounded-lg px-3 py-2 text-sm leading-relaxed',
          isUser ? 'bg-secondary text-foreground' : 'border border-border/60 bg-card',
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.sources.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.sources.map((source, index) => (
              <span
                key={index}
                className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                Source: {formatDuration(source.startSec)} – {formatDuration(source.endSec)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
