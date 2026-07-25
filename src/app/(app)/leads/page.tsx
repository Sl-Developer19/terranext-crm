import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CreateLeadDialog, LeadsTable, listLeads, LEADS_SCAN_CAP } from '@/features/leads';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Leads' };

/** S10 — lead list (Doc 16), row-scoped to assigned leads for consultants. */
export default async function LeadsPage() {
  const session = await requirePermission('leads:view');
  const leads = await listLeads(session);
  const canCreate = can(session.role, 'leads:create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Enquiries from every source — website, referral, campaign, college, and walk-in."
        actions={canCreate ? <CreateLeadDialog /> : undefined}
      />
      {leads.length === LEADS_SCAN_CAP ? (
        <p className="text-xs text-muted-foreground">
          Showing the most recently updated {LEADS_SCAN_CAP} leads — limit reached, older leads are
          not shown.
        </p>
      ) : null}
      <Card>
        <CardContent className="p-0">
          <LeadsTable leads={leads} />
        </CardContent>
      </Card>
    </div>
  );
}
