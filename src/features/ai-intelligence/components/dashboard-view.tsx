import { Mic } from 'lucide-react';
import Link from 'next/link';

import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

import { SESSION_STATUS_KIND, SESSION_STATUS_LABELS } from '../logic';
import type { AiDashboardStats, AiSession } from '../schema';
import { AutoRefresh } from './auto-refresh';

export function DashboardView({
  stats,
  recentSessions,
}: {
  stats: AiDashboardStats;
  recentSessions: AiSession[];
}) {
  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={8000} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's sessions"
          value={String(stats.todaysSessions)}
          numericValue={stats.todaysSessions}
          format="count"
        />
        <StatCard
          label="Pending processing"
          value={String(stats.pendingProcessing)}
          numericValue={stats.pendingProcessing}
          format="count"
        />
        <StatCard
          label="Completed sessions"
          value={String(stats.completedSessions)}
          numericValue={stats.completedSessions}
          format="count"
        />
        <StatCard
          label="Total recording time"
          value={`${Math.round((stats.recordingHours + stats.pausedHours) * 10) / 10}h`}
          numericValue={stats.recordingHours + stats.pausedHours}
          format="count"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active recording hours"
          value={`${stats.recordingHours}h`}
          numericValue={stats.recordingHours}
          format="count"
        />
        <StatCard
          label="Paused hours"
          value={`${stats.pausedHours}h`}
          numericValue={stats.pausedHours}
          format="count"
        />
        <StatCard
          label="Number of pauses"
          value={String(stats.totalPauses)}
          numericValue={stats.totalPauses}
          format="count"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <EmptyState
              icon={Mic}
              headline="No sessions recorded yet"
              explanation="Sessions you create and record will show up here, along with their processing status."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentSessions.slice(0, 8).map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/ai/session/${session.id}`}
                      className="truncate text-sm font-medium hover:text-gold hover:underline"
                    >
                      {session.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{session.trainerName}</p>
                  </div>
                  <StatusBadge
                    kind={SESSION_STATUS_KIND[session.status]}
                    label={SESSION_STATUS_LABELS[session.status]}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
