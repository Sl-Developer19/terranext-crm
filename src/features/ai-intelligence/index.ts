/** Public API of the ai-intelligence feature (Doc 02 §3). */
export { AutoRefresh } from './components/auto-refresh';
export { CreateSessionDialog } from './components/create-session-dialog';
export { DashboardView } from './components/dashboard-view';
export { AnalyticsView } from './components/analytics-view';
export { ProcessingQueueView } from './components/processing-queue-view';
export { SessionAssistant } from './components/session-assistant';
export { SessionAudioPlayer } from './components/session-audio-player';
export { SessionRecorder } from './components/session-recorder';
export { SessionTimeline } from './components/session-timeline';
export { SessionsTable } from './components/sessions-table';
export { SettingsForm } from './components/settings-form';
export { SummaryView } from './components/summary-view';
export { TranscriptView } from './components/transcript-view';

export type { AssistantMessage, AssistantSource } from './assistant/schema';

export {
  JOB_STAGE_KIND,
  JOB_STAGE_LABELS,
  SESSION_STATUS_KIND,
  SESSION_STATUS_LABELS,
  formatDuration,
  isTerminalJobStage,
  jobStageProgressPercent,
} from './logic';
export {
  getAiSettings,
  getDashboardStats,
  getRecentAnalytics,
  getSessionChatMessages,
  getSessionDetail,
  listProcessingJobs,
  listSessions,
} from './queries';
export type {
  AiAnalyticsDay,
  AiDashboardStats,
  AiIntelligenceSettings,
  AiJobStage,
  AiProcessingJob,
  AiSession,
  AiSessionStatus,
  AiSummary,
  AiTranscript,
  TranscriptSegment,
} from './schema';
