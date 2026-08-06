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
  SessionRecorder,
  SessionTimeline,
  SummaryView,
  TranscriptView,
  formatDuration,
  getSessionDetail,
} from '@/features/ai-intelligence';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'AI Intelligence — Session' };

export default async function AiSessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission('aiIntelligence:view');
  const { id } = await params;
  const { tab } = await searchParams;

  const { session, transcript, summary } = await getSessionDetail(id);
  if (!session) notFound();

  const isProcessing = session.status === 'processing';
  const settings = session.status === 'draft' ? await getAiSettings() : null;

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
      />

      {session.status === 'recording' || session.status === 'paused' ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            This session is {session.status === 'paused' ? 'paused' : 'recording'} in a browser tab.
            Recording controls (Pause, Resume, Stop) only work in the tab where{' '}
            <strong className="font-medium text-foreground">Start recording</strong> was clicked —
            if that tab was closed or this page was refreshed, it can&apos;t be controlled from
            here. Anything already uploaded is safely saved; if this session is stuck, a System
            Administrator can remove it without losing the recording, transcript, or summary
            generated so far.
          </CardContent>
        </Card>
      ) : null}

      <SessionTimeline session={session} />

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
        <Tabs defaultValue={tab === 'transcript' ? 'transcript' : 'summary'}>
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <SummaryView summary={summary} />
          </TabsContent>
          <TabsContent value="transcript">
            <TranscriptView transcript={transcript} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
