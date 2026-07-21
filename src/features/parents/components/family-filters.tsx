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

import { FAMILY_SOURCES, PARENT_CONVERSION_STATUSES } from '../schema';
import { CONVERSION_LABELS, FAMILY_SOURCE_LABELS } from './families-table';

const ALL = '__all__';

/** Search + filters for the family directory. State lives in the URL. */
export function FamilyFilters({
  initialQuery,
  initialSource,
  initialConversion,
}: {
  initialQuery: string;
  initialSource: string;
  initialConversion: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);

  const apply = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
    }
    // Any filter change resets to page 1 — otherwise a narrowed result set
    // can leave you on a page that no longer exists.
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasFilters = Boolean(initialQuery || initialSource || initialConversion);

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
          <Label htmlFor="family-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="family-search"
              className="w-64 pl-8"
              placeholder="Family, parent name, or phone"
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
        <Label htmlFor="family-source">Source</Label>
        <Select value={initialSource || ALL} onValueChange={(v) => apply({ source: v })}>
          <SelectTrigger id="family-source" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {FAMILY_SOURCES.map((source) => (
              <SelectItem key={source} value={source}>
                {FAMILY_SOURCE_LABELS[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="family-conversion">Conversion</Label>
        <Select
          value={initialConversion || ALL}
          onValueChange={(v) => apply({ conversionStatus: v })}
        >
          <SelectTrigger id="family-conversion" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {PARENT_CONVERSION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {CONVERSION_LABELS[status]}
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
