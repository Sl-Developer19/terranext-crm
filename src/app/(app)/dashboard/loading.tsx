import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the dashboard's page-header + section/card shape while figures load. */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="space-y-10">
        {[0, 1].map((section) => (
          <section key={section} className="space-y-4">
            <div className="space-y-2 border-b border-border pb-3">
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((card) => (
                <div key={card} className="rounded-xl border bg-card p-4 pl-5 shadow-premium">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2.5 h-7 w-20" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
