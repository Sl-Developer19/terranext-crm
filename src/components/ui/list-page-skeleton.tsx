import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Generic loading shape for the list-page pattern used across the app
 * (PageHeader + optional filter bar + Card > table). One shared skeleton
 * so every module's `loading.tsx` looks and feels the same instead of each
 * page inventing its own — and so a route without one is the exception, not
 * the rule.
 */
export function ListPageSkeleton({
  rows = 8,
  columns = 5,
  withFilters = false,
}: {
  rows?: number;
  columns?: number;
  withFilters?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {withFilters ? (
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-64 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border px-4 py-3">
            <div className="flex gap-6">
              {Array.from({ length: columns }).map((_, col) => (
                <Skeleton key={col} className="h-3 w-20" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, row) => (
              <div key={row} className="flex items-center gap-6 px-4 py-3.5">
                {Array.from({ length: columns }).map((_, col) => (
                  <Skeleton
                    key={col}
                    className="h-4"
                    style={{ width: col === 0 ? '9rem' : `${5 + ((row + col) % 4) * 1.5}rem` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
