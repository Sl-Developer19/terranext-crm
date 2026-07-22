'use client';

import { useCallback, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

import { StatusBadge, type StatusKind } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { AuditAction } from '@/lib/audit/types';

import { csvFilename, toCsv, type CsvValue } from '@/lib/utils/csv';

import type { AuditLogEntry, AuditLogFilters } from '../schema';
import { AuditFilterBar } from './audit-filter-bar';

const AUDIT_EXPORT_COLUMNS = [
  { key: 'at', label: 'At' },
  { key: 'actorUid', label: 'Actor UID' },
  { key: 'actorRole', label: 'Actor role' },
  { key: 'action', label: 'Action' },
  { key: 'entityType', label: 'Entity type' },
  { key: 'entityId', label: 'Entity ID' },
  { key: 'entityPath', label: 'Entity path' },
  { key: 'feature', label: 'Feature' },
  { key: 'reason', label: 'Reason' },
  { key: 'changes', label: 'Changes' },
] as const;

function toExportRow(entry: AuditLogEntry): Record<string, CsvValue> {
  return {
    at: entry.at,
    actorUid: entry.actorUid,
    actorRole: entry.actorRole,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityPath: entry.entityPath,
    feature: entry.context.feature,
    reason: entry.context.reason,
    // Flattened rather than dropped: the before/after pair is usually the
    // reason someone is exporting the register in the first place.
    changes: entry.changes ? JSON.stringify(entry.changes) : '',
  };
}

const ACTION_KIND: Record<AuditAction, StatusKind> = {
  create: 'success',
  update: 'info',
  soft_delete: 'danger',
  status_change: 'progress',
  permission_change: 'danger',
  login: 'neutral',
  export: 'progress',
  override: 'danger',
  migration: 'neutral',
};

function formatAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface Props {
  /** Initial data fetched server-side; client filters refetch via server action. */
  initialEntries: AuditLogEntry[];
  initialFilters: AuditLogFilters;
  /** Server action to reload entries with new filters (passed from page). */
  onFilterChange: (filters: AuditLogFilters) => Promise<AuditLogEntry[]>;
  canExport: boolean;
}

const VIRTUAL_THRESHOLD = 100;

export function AuditLogsTable({
  initialEntries,
  initialFilters,
  onFilterChange,
  canExport,
}: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>(initialEntries);
  const [filters, setFilters] = useState<AuditLogFilters>(initialFilters);
  const [loading, setLoading] = useState(false);

  /**
   * Exports what the analyst is currently looking at, filters and all —
   * exporting the unfiltered stream instead would be a different document
   * from the one on screen. The read that produced these rows was already
   * audited server-side by `fetchAuditLogs`.
   */
  const handleExport = useCallback(() => {
    const csv = toCsv(AUDIT_EXPORT_COLUMNS, entries.map(toExportRow));
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFilename('audit-logs');
    link.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const handleFiltersChange = useCallback(
    async (newFilters: AuditLogFilters) => {
      setFilters(newFilters);
      setLoading(true);
      try {
        const result = await onFilterChange(newFilters);
        setEntries(result);
      } finally {
        setLoading(false);
      }
    },
    [onFilterChange],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <AuditFilterBar filters={filters} onFiltersChange={handleFiltersChange} />
        {canExport && (
          <button
            id="audit-export-btn"
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-50"
            disabled={entries.length === 0}
            onClick={handleExport}
          >
            Export CSV
          </button>
        )}
      </div>

      {loading && <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>}

      {!loading && entries.length === 0 && (
        <EmptyState
          icon={FileText}
          headline="No audit entries"
          explanation="No events match the current filters."
        />
      )}

      {!loading && entries.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {entries.length} entries
            {entries.length === 500 ? ' (limit reached — refine filters)' : ''}
            {entries.length > VIRTUAL_THRESHOLD ? ' · Scroll to see all (virtualized)' : ''}
          </p>
          <VirtualList entries={entries} />
        </>
      )}
    </div>
  );
}

/**
 * Simple windowed render: shows a fixed viewport window of rows and
 * renders only what's visible. React Virtuoso or @tanstack/react-virtual
 * can replace this when the dependency is added; for now a CSS overflow +
 * dynamic slice keeps the DOM lean (Doc 11 §7).
 */
function VirtualList({ entries }: { entries: AuditLogEntry[] }) {
  const ITEM_HEIGHT = 52; // px — approximate row height
  const VISIBLE = 20; // rows to render at once
  const containerRef = useRef<HTMLDivElement>(null);
  const [startIndex, setStartIndex] = useState(0);

  function handleScroll() {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    setStartIndex(Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2));
  }

  const visibleEntries = entries.slice(startIndex, startIndex + VISIBLE + 4);
  const paddingTop = startIndex * ITEM_HEIGHT;
  const paddingBottom = Math.max(0, entries.length - startIndex - VISIBLE - 4) * ITEM_HEIGHT;

  if (entries.length <= VIRTUAL_THRESHOLD) {
    // Below threshold: render everything directly
    return (
      <div className="overflow-x-auto rounded-md border border-border">
        <AuditTable entries={entries} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-x-auto overflow-y-auto rounded-md border border-border"
      style={{ maxHeight: `${VISIBLE * ITEM_HEIGHT}px` }}
    >
      <div style={{ paddingTop, paddingBottom }}>
        <AuditTable entries={visibleEntries} />
      </div>
    </div>
  );
}

function AuditTable({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <table className="w-full min-w-[900px] text-sm">
      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
        <tr className="border-b">
          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">When</th>
          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Actor</th>
          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
            Action
          </th>
          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
            Entity
          </th>
          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
            Changes
          </th>
          <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
            Context
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
            <td className="px-3 py-2.5 align-top">
              <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {formatAt(entry.at)}
              </span>
            </td>
            <td className="px-3 py-2.5 align-top">
              <div className="text-xs">
                <span className="font-mono text-foreground">{entry.actorUid.slice(0, 8)}…</span>
                <br />
                <span className="text-muted-foreground">{entry.actorRole}</span>
              </div>
            </td>
            <td className="px-3 py-2.5 align-top">
              <StatusBadge kind={ACTION_KIND[entry.action] ?? 'neutral'} label={entry.action} />
            </td>
            <td className="px-3 py-2.5 align-top">
              <div className="text-xs">
                <span className="font-medium text-foreground">{entry.entityType}</span>
                <br />
                <span className="font-mono text-muted-foreground">{entry.entityId}</span>
              </div>
            </td>
            <td className="max-w-xs px-3 py-2.5 align-top">
              {entry.changes ? (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {Object.entries(entry.changes)
                    .slice(0, 3)
                    .map(([field, { before, after }]) => (
                      <li key={field}>
                        <span className="font-medium text-foreground">{field}:</span>{' '}
                        <span className="line-through opacity-60">{String(before ?? '—')}</span>
                        {' → '}
                        <span>{String(after ?? '—')}</span>
                      </li>
                    ))}
                  {Object.keys(entry.changes).length > 3 && (
                    <li className="opacity-50">+{Object.keys(entry.changes).length - 3} more…</li>
                  )}
                </ul>
              ) : (
                <span className="text-xs text-muted-foreground/40">—</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top">
              <div className="text-xs">
                <span className="text-muted-foreground">{entry.context.feature}</span>
                {entry.context.reason ? (
                  <>
                    <br />
                    <span className="italic text-foreground">
                      &ldquo;{entry.context.reason}&rdquo;
                    </span>
                  </>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
