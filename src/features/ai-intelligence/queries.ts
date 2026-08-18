import 'server-only';

import { findAssistantMessages } from './assistant/repository';
import type { AssistantMessage } from './assistant/schema';
import {
  findAiSettings,
  findDashboardStats,
  findProcessingJobs,
  findRecentAnalytics,
  findSessionById,
  findSessions,
  findSummaryBySessionId,
  findTranscriptBySessionId,
} from './repository';
import type {
  AiAnalyticsDay,
  AiDashboardStats,
  AiIntelligenceSettings,
  AiProcessingJob,
  AiSession,
  AiSummary,
  AiTranscript,
} from './schema';

/** Read models for the AI Intelligence Platform (Dashboard, Sessions, Processing Queue, Transcript Center, Analytics, Settings). */

export async function listSessions(options?: { trainerUid?: string }): Promise<AiSession[]> {
  return findSessions(options);
}

export async function getSessionDetail(sessionId: string): Promise<{
  session: AiSession | null;
  transcript: AiTranscript | null;
  summary: AiSummary | null;
}> {
  const session = await findSessionById(sessionId);
  if (!session) return { session: null, transcript: null, summary: null };
  const [transcript, summary] = await Promise.all([
    findTranscriptBySessionId(sessionId),
    findSummaryBySessionId(sessionId),
  ]);
  return { session, transcript, summary };
}

export async function listProcessingJobs(): Promise<AiProcessingJob[]> {
  return findProcessingJobs();
}

export async function getDashboardStats(): Promise<AiDashboardStats> {
  return findDashboardStats();
}

export async function getRecentAnalytics(days = 30): Promise<AiAnalyticsDay[]> {
  return findRecentAnalytics(days);
}

export async function getAiSettings(): Promise<AiIntelligenceSettings> {
  return findAiSettings();
}

export async function getSessionChatMessages(sessionId: string): Promise<AssistantMessage[]> {
  return findAssistantMessages(sessionId);
}
