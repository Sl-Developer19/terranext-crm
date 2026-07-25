'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { PARTICIPANT_STATUSES } from '../schema';
import { PARTICIPANT_STATUS_LABELS } from '../status-labels';

const ALL = '__all__';

/**
 * S20 search + filters (Doc 16). State lives in the URL, not React state:
 * a filtered directory stays shareable and survives a refresh, and the
 * server component re-queries from `searchParams` on every change.
 */
export function ParticipantFilters({
  initialQuery,
  initialStatus,
  initialAcademyId,
  initialBatchId,
  academyOptions,
  batchOptions,
}: {
  initialQuery: string;
  initialStatus: string;
  initialAcademyId: string;
  initialBatchId: string;
  academyOptions: { id: string; name: string }[];
  batchOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);

  const apply = React.useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== ALL) params.set(key, value);
        else params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const hasFilters =
    Boolean(initialQuery) ||
    Boolean(initialStatus) ||
    Boolean(initialAcademyId) ||
    Boolean(initialBatchId);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: query });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="participant-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="participant-search"
              className="w-64 pl-8"
              placeholder="Name or phone number"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>

      <div className="space-y-2">
        <Label htmlFor="filter-status">Status</Label>
        <Select value={initialStatus || ALL} onValueChange={(value) => apply({ status: value })}>
          <SelectTrigger id="filter-status" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {PARTICIPANT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {PARTICIPANT_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-academy">Academy</Label>
        <Select
          value={initialAcademyId || ALL}
          onValueChange={(value) => apply({ academyId: value })}
        >
          <SelectTrigger id="filter-academy" className="w-44">
            <SelectValue placeholder="All academies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All academies</SelectItem>
            {academyOptions.map((academy) => (
              <SelectItem key={academy.id} value={academy.id}>
                {academy.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-batch">Batch</Label>
        <Select value={initialBatchId || ALL} onValueChange={(value) => apply({ batchId: value })}>
          <SelectTrigger id="filter-batch" className="w-44">
            <SelectValue placeholder="All batches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All batches</SelectItem>
            {batchOptions.map((batch) => (
              <SelectItem key={batch.id} value={batch.id}>
                {batch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery('');
            router.push(pathname);
          }}
        >
          <X className="size-4" aria-hidden />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
