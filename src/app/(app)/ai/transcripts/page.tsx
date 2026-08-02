import { format } from 'date-fns';
import { ScrollText } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { listSessions } from '@/features/ai-intelligence';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'AI Intelligence — Transcript Center' };

/** Hub for browsing every session with a generated transcript; the transcript
 * itself (search, speaker separation, timestamps) renders on the session page. */
export default async function AiTranscriptCenterPage() {
  await requirePermission('aiIntelligence:view');

  const sessions = (await listSessions()).filter((s) => s.transcriptId !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transcript Center"
        description="Every session with a completed transcript. Open one to search, filter by speaker, and jump to a timestamp."
      />
      <Card>
        <CardContent>
          {sessions.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              headline="No transcripts yet"
              explanation="Transcripts appear here automatically once a recorded session finishes processing."
            />
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/ai/session/${session.id}?tab=transcript`}
                      className="truncate text-sm font-medium hover:text-gold hover:underline"
                    >
                      {session.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {session.trainerName}
                      {session.createdAt ? ` · ${format(new Date(session.createdAt), 'PP')}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
