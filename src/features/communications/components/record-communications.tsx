import { MessageSquare } from 'lucide-react';

import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

import { channelLabel, statusLabel, statusTone } from '../logic';
import type { Communication } from '../schema';

/**
 * Per-record comms history (S21 Comms tab / S41 per-record view). Read-only —
 * sending happens on the communications screen, which owns the template picker
 * and the FR-10.3 log-before-send path.
 */
export function RecordCommunications({ rows }: { rows: Communication[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        headline="No messages yet"
        explanation="Messages sent to or received from this person will appear here."
      />
    );
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-start gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {row.subject ?? channelLabel(row.channel)}
              </span>
              <StatusBadge kind={statusTone(row.status)} label={statusLabel(row.status)} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{row.bodyPreview}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>
              {channelLabel(row.channel)} · {row.direction === 'inbound' ? 'Received' : 'Sent'}
            </div>
            <div>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
