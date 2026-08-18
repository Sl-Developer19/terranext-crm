import { format } from 'date-fns';
import { CirclePause, CirclePlay, Square, Mic } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { formatDuration } from '../logic';
import type { AiSession } from '../schema';

interface TimelineEntry {
  icon: typeof Mic;
  label: string;
  at: string | null;
  detail?: string;
}

/**
 * Read-only lifecycle view of one session's recording — Recording Started →
 * Paused → Resumed → ... → Recording Stopped. Built entirely from fields
 * already on `AiSession` (`startedAt`, `pauseHistory`, `endedAt`); no new
 * collection or query. Renders once a session has actually started
 * recording — nothing to show for a still-`draft` session.
 */
export function SessionTimeline({ session }: { session: AiSession }) {
  if (!session.startedAt) return null;

  const entries: TimelineEntry[] = [
    { icon: Mic, label: 'Recording started', at: session.startedAt },
  ];

  for (const event of session.pauseHistory) {
    entries.push({ icon: CirclePause, label: 'Paused', at: event.pausedAt });
    if (event.resumedAt) {
      entries.push({
        icon: CirclePlay,
        label: 'Resumed',
        at: event.resumedAt,
        ...(event.durationSeconds !== null
          ? { detail: `paused for ${formatDuration(event.durationSeconds)}` }
          : {}),
      });
    }
  }

  if (session.endedAt) {
    entries.push({ icon: Square, label: 'Recording stopped', at: session.endedAt });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {entries.map((entry, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <entry.icon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
              <div className="min-w-0">
                <span className="font-medium">{entry.label}</span>
                {entry.at ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {format(new Date(entry.at), 'PPp')}
                  </span>
                ) : null}
                {entry.detail ? (
                  <p className="text-xs text-muted-foreground">{entry.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        {session.pauseCount > 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {session.pauseCount} pause{session.pauseCount === 1 ? '' : 's'} · paused for{' '}
            {formatDuration(session.pausedDurationSeconds)} in total
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
