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
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.metrics.map((metric, index) => (
              <StatCard
                key={`${metric.key}-${index}`}
                label={metric.label}
                value={formatMetricValue(metric)}
                detail={metric.state === 'ok' ? metric.detail : undefined}
                caveat={metric.state === 'partial' ? metric.caveat : undefined}
                unavailableReason={metric.state === 'unavailable' ? metric.reason : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
