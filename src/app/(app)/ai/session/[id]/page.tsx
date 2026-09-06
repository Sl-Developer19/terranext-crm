import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AutoRefresh,
  getAiSettings,
  SESSION_STATUS_KIND,
  SESSION_STATUS_LABELS,
  SessionAssistant,
  SessionAudioPlayer,
  SessionRecorder,
  SessionTimeline,
  SummaryView,
  TranscriptView,
  formatDuration,
  getSessionChatMessages,
  getSessionDetail,
} from '@/features/ai-intelligence';
import { sessionCan } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'AI Intelligence — Session' };

export default async function AiSessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const authSession = await requirePermission('aiIntelligence:view');
  const { id } = await params;
  const { tab } = await searchParams;

  const { session, transcript, summary } = await getSessionDetail(id, authSession);
  if (!session) notFound();

  const isProcessing = session.status === 'processing';
  const settings = session.status === 'draft' ? await getAiSettings() : null;
  const chatMessages = session.status === 'completed' ? await getSessionChatMessages(id) : [];

  return (
    <div className="space-y-6">
      {isProcessing ? <AutoRefresh intervalMs={4000} /> : null}
      <PageHeader
        title={session.title}
        description={`${session.trainerName}${session.batchName ? ` · ${session.batchName}` : ''}${
          session.createdAt ? ` · ${format(new Date(session.createdAt), 'PPp')}` : ''
        }`}
        actions={
          <StatusBadge
            kind={SESSION_STATUS_KIND[session.status]}
            label={SESSION_STATUS_LABELS[session.status]}
          />
        }
      />

      <SessionRecorder
        session={session}
        defaultRecordingSource={settings?.defaultRecordingSource ?? 'laptop_microphone'}
        channelRoleMap={settings?.channelRoleMap ?? []}
        canAdminStop={sessionCan(authSession, 'aiIntelligence:configure')}
      />

      <SessionTimeline session={session} />

      {/* Recording has been finalized (Stop already ran) — the audio is in
          Storage regardless of how processing/transcription turns out, so
          playback works for a still-processing, completed, or even failed
          session alike (§13: a transcription/summary failure must never
          make the recording itself unreachable). */}
      {session.totalChunks !== null ? <SessionAudioPlayer sessionId={session.id} /> : null}

      {isProcessing ? (
        <Card>
          <CardHeader>
            <CardTitle>Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Transcription and AI analysis are running automatically. This page refreshes on its
              own — no action is needed. Track detailed stage progress on the{' '}
              <a href="/ai/processing" className="text-gold hover:underline">
                Processing Queue
              </a>
              .
            </p>
          </CardContent>
        </Card>
      ) : null}

      {session.status === 'completed' || session.status === 'failed' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Active recording time:{' '}
              {session.durationSeconds !== null ? formatDuration(session.durationSeconds) : '—'}
            </CardContent>
          </Card>
          {session.pauseCount > 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Paused {session.pauseCount} time{session.pauseCount === 1 ? '' : 's'} ·{' '}
                {formatDuration(session.pausedDurationSeconds)} total
                {session.sessionDurationSeconds !== null
                  ? ` · ${formatDuration(session.sessionDurationSeconds)} session length`
                  : ''}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {session.status === 'completed' ? (
        <Tabs
          defaultValue={
            tab === 'transcript' ? 'transcript' : tab === 'assistant' ? 'assistant' : 'summary'
          }
        >
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="assistant">AI Assistant</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <SummaryView summary={summary} />
          </TabsContent>
          <TabsContent value="transcript">
            <TranscriptView transcript={transcript} />
          </TabsContent>
          <TabsContent value="assistant">
            <SessionAssistant sessionId={session.id} initialMessages={chatMessages} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
