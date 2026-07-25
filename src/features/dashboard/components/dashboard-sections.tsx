import { StatCard } from '@/components/ui/stat-card';

import { formatMetricValue } from '../logic';
import type { DashboardSection } from '../schema';

/**
 * Renders the role's dashboard sections (SOP 15.9 / 18.10).
 *
 * Server component — the figures are computed server-side and never change
 * without a navigation, so there is nothing to hydrate.
 */
export function DashboardSections({ sections }: { sections: DashboardSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              {section.title}
            </h2>
            <p className="text-xs text-foreground-secondary">{section.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.metrics.map((metric, index) => (
              <div
                key={`${metric.key}-${index}`}
                className="animate-fade-up"
                style={{
                  animationDelay: `${Math.min(index, 8) * 40}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <StatCard
                  label={metric.label}
                  value={formatMetricValue(metric)}
                  numericValue={metric.state !== 'unavailable' ? metric.value : undefined}
                  format={metric.format}
                  detail={metric.state === 'ok' ? metric.detail : undefined}
                  caveat={metric.state === 'partial' ? metric.caveat : undefined}
                  unavailableReason={metric.state === 'unavailable' ? metric.reason : undefined}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
