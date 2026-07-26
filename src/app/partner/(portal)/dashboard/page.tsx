import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { getGrowthPartner, LEADERSHIP_LEVEL_LABELS } from '@/features/growth-partners';
import { PARTNER_STATUS_BADGE, PARTNER_STATUS_LABELS } from '@/features/growth-partners';
import { requirePartnerSession } from '@/lib/rbac/require-partner';

export const metadata: Metadata = { title: 'Partner Dashboard' };

/**
 * Doc 25 §3 (Growth Partner Dashboard) — the profile/status summary lands
 * in this slice; lead/reward/wallet KPIs are added as their features land
 * (slices 3–6), never as placeholder tiles ahead of the data existing.
 */
export default async function PartnerDashboardPage() {
  const session = await requirePartnerSession();
  const partner = await getGrowthPartner(session.partnerId);
  if (!partner) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${partner.displayName}`} description={partner.email} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge
              kind={PARTNER_STATUS_BADGE[partner.status]}
              label={PARTNER_STATUS_LABELS[partner.status]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leadership level
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {LEADERSHIP_LEVEL_LABELS[partner.leadershipLevel]}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Organisation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {partner.organizationName ?? '—'}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
