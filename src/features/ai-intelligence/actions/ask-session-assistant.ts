'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  notFoundError,
  ok,
  permissionError,
  rateLimitedError,
  unavailableError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import {
  buildAssistantSystemPrompt,
  buildSessionDataBlock,
  buildTranscriptWindows,
  selectRecentHistory,
  selectRelevantWindows,
  windowToSource,
} from '../assistant/logic';
import { getAssistantChatProvider } from '../assistant/provider';
import {
  appendAssistantMessage,
  checkAndConsumeAssistantRateLimit,
  findAssistantMessages,
} from '../assistant/repository';
import { askSessionAssistantSchema, type AskSessionAssistantInput } from '../assistant/schema';
import type { AssistantMessage } from '../assistant/schema';
import { findSessionById, findSummaryBySessionId, findTranscriptBySessionId } from '../repository';
import type { AiSummary } from '../schema';

/**
 * AI Session Assistant — multi-turn Q&A grounded in one session's transcript
 * and summary (Phase 7). Every request re-verifies permission and session
 * access server-side (Phase 11: never trust a client-supplied sessionId,
 * uid, or role) and never forwards more than the retrieved excerpts +
 * bounded history for this one session to the provider (Phase 8/9) — the
 * server, not the browser, decides what "this session's authorized data"
 * means on each call.
 */

function logError(event: string, error: unknown, context: Record<string, unknown>) {
  console.error(`[ai-intelligence:assistant] ${event}`, {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  });
}

function formatSummaryForContext(summary: AiSummary | null): string | null {
  if (!summary) return null;
  const parts: string[] = [];
  if (summary.executiveSummary) parts.push(summary.executiveSummary);
  if (summary.trainerDiscussion) parts.push(`Trainer discussion: ${summary.trainerDiscussion}`);
  if (summary.studentParticipation) {
    parts.push(`Student participation: ${summary.studentParticipation}`);
  }
  if (summary.keyLearningPoints.length > 0) {
    parts.push(`Key learning points: ${summary.keyLearningPoints.join('; ')}`);
  }
  if (summary.importantQuestions.length > 0) {
    parts.push(`Important questions: ${summary.importantQuestions.join('; ')}`);
  }
  if (summary.actionItems.length > 0) {
    parts.push(`Action items: ${summary.actionItems.join('; ')}`);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

export async function askSessionAssistant(
  input: AskSessionAssistantInput,
): Promise<Result<{ userMessage: AssistantMessage; assistantMessage: AssistantMessage }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:view')) return permissionError();

  const parsed = askSessionAssistantSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }
  const { sessionId, question } = parsed.data;

  try {
    const aiSession = await findSessionById(sessionId);
    if (!aiSession) return notFoundError('Session not found.');

    const transcript = await findTranscriptBySessionId(sessionId);
    if (!transcript) {
      return conflictError(
        'This session does not have a transcript yet — the assistant needs transcription to finish first.',
      );
    }

    const rateLimit = await checkAndConsumeAssistantRateLimit(session.uid, sessionId);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000));
      return rateLimitedError(
        `Too many questions in a short time — please wait ${retryAfterSec}s and try again.`,
      );
    }

    const summary = await findSummaryBySessionId(sessionId);
    const windows = buildTranscriptWindows(transcript.segments);
    const selected = selectRelevantWindows(windows, question);
    const sessionDataBlock = buildSessionDataBlock(formatSummaryForContext(summary), selected);
    const systemPrompt = buildAssistantSystemPrompt(aiSession.title);

    const priorMessages = await findAssistantMessages(sessionId);
    const history = selectRecentHistory(priorMessages);

    const userMessage = await appendAssistantMessage(sessionId, 'user', question, session.uid);

    const provider = getAssistantChatProvider();
    let answer: string;
    try {
      const result = await provider.chat({ systemPrompt, sessionDataBlock, history, question });
      answer = result.answer;
    } catch (error) {
      logError('provider chat failed', error, { sessionId, provider: provider.name });
      return unavailableError(
        'The AI Session Assistant could not answer right now. Please try again.',
      );
    }

    const sources = selected.map(windowToSource);
    const assistantMessage = await appendAssistantMessage(
      sessionId,
      'assistant',
      answer,
      `system:ai-session-assistant:${provider.name}`,
      sources,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'export',
      entityType: 'ai_session',
      entityId: sessionId,
      entityPath: `aiSessions/${sessionId}`,
      context: { feature: 'ai-intelligence', reason: 'ai_assistant_query' },
    });

    return ok({ userMessage, assistantMessage });
  } catch (error) {
    logError('askSessionAssistant failed', error, { sessionId });
    return internalError('Could not process your question. Please try again.');
  }
}
