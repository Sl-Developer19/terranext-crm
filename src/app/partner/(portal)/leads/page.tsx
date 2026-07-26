import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CreatePartnerLeadDialog, PartnerLeadsTable, listPartnerLeads } from '@/features/leads';
import { requirePartnerSession } from '@/lib/rbac/require-partner';

export const metadata: Metadata = { title: 'My Leads' };

/** Doc 25 §4 — a partner's own referrals, row-scoped by partnerId. */
export default async function PartnerLeadsPage() {
  const session = await requirePartnerSession();
  const leads = await listPartnerLeads(session.partnerId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Leads"
        description="Referrals you've submitted and their current status."
        actions={<CreatePartnerLeadDialog />}
      />
      <Card>
        <CardContent className="p-0">
          <PartnerLeadsTable leads={leads} />
        </CardContent>
      </Card>
    </div>
  );
}
