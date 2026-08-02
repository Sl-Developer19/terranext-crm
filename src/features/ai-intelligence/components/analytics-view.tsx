import { BarChart3 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';

import type { AiAnalyticsDay } from '../schema';

/** Lightweight inline bar chart — no charting dependency added for one view. */
function DailyBarChart({
  days,
  valueKey,
  label,
}: {
  days: AiAnalyticsDay[];
  valueKey: keyof AiAnalyticsDay;
  label: string;
}) {
  const values = days.map((d) => Number(d[valueKey]));
  const max = Math.max(1, ...values);
  const width = 720;
  const height = 160;
  const barGap = 4;
  const barWidth = days.length > 0 ? width / days.length - barGap : 0;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label={label}>
        {days.map((day, index) => {
          const value = Number(day[valueKey]);
          const barHeight = (value / max) * (height - 20);
          const x = index * (barWidth + barGap);
          return (
            <g key={day.date}>
              <rect
                x={x}
                y={height - barHeight}
                width={Math.max(1, barWidth)}
                height={barHeight}
                rx={2}
                fill="hsl(var(--gold))"
                opacity={0.85}
              >
                <title>{`${day.date}: ${value}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AnalyticsView({ days }: { days: AiAnalyticsDay[] }) {
  if (days.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        headline="No analytics yet"
        explanation="Daily rollups appear here once the first session finishes processing."
      />
    );
  }

  const totals = days.reduce(
    (acc, day) => ({
      sessionsCompleted: acc.sessionsCompleted + day.sessionsCompleted,
      sessionsFailed: acc.sessionsFailed + day.sessionsFailed,
      recordingHours: acc.recordingHours + day.recordingSeconds / 3600,
      wordsTranscribed: acc.wordsTranscribed + day.wordsTranscribed,
    }),
    { sessionsCompleted: 0, sessionsFailed: 0, recordingHours: 0, wordsTranscribed: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sessions completed"
          value={String(totals.sessionsCompleted)}
          numericValue={totals.sessionsCompleted}
          format="count"
        />
        <StatCard
          label="Sessions failed"
          value={String(totals.sessionsFailed)}
          numericValue={totals.sessionsFailed}
          format="count"
        />
        <StatCard
          label="Recording hours"
          value={`${totals.recordingHours.toFixed(1)}h`}
          numericValue={totals.recordingHours}
          format="count"
        />
        <StatCard
          label="Words transcribed"
          value={totals.wordsTranscribed.toLocaleString('en-IN')}
          numericValue={totals.wordsTranscribed}
          format="count"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last {days.length} days</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <DailyBarChart days={days} valueKey="sessionsCompleted" label="Sessions completed" />
          <DailyBarChart days={days} valueKey="recordingSeconds" label="Recording seconds" />
        </CardContent>
      </Card>
    </div>
  );
}
