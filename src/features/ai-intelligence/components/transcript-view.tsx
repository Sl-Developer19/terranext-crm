'use client';

import { Search, ScrollText } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

import { formatDuration } from '../logic';
import type { AiTranscript, SpeakerRole } from '../schema';

const SPEAKER_STYLE: Record<SpeakerRole, string> = {
  trainer: 'border-gold/30 bg-gold/15 text-gold-hover',
  student: 'border-status-info/25 bg-status-info/15 text-status-info',
  unknown: 'border-status-neutral/25 bg-status-neutral/10 text-status-neutral',
};

/** Transcript Center segment view — search, speaker separation, timestamps. */
export function TranscriptView({ transcript }: { transcript: AiTranscript | null }) {
  const [query, setQuery] = React.useState('');

  if (!transcript || transcript.segments.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        headline="No transcript yet"
        explanation="The transcript appears automatically once speech-to-text finishes processing this session's recording."
      />
    );
  }

  const filtered = query.trim()
    ? transcript.segments.filter((segment) =>
        segment.text.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : transcript.segments;

  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Transcript</CardTitle>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcript"
            aria-label="Search transcript"
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No matches for &ldquo;{query}&rdquo;.
          </p>
        ) : (
          filtered.map((segment, index) => (
            <div
              key={index}
              className="flex gap-3 border-b border-border/60 pb-4 last:border-0 last:pb-0"
            >
              <span className="w-14 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                {formatDuration(segment.startSec)}
              </span>
              <div className="min-w-0 space-y-1">
                <Badge variant="outline" className={SPEAKER_STYLE[segment.speaker]}>
                  {segment.speakerLabel}
                </Badge>
                <p className="text-sm leading-relaxed">{segment.text}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
