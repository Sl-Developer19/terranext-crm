import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { LeadTimeline, computeLeadTimeline, getPartnerLead } from '@/features/leads';
import { requirePartnerSession } from '@/lib/rbac/require-partner';

export const metadata: Metadata = { title: 'Referral status' };

/** Doc 25 §5 — a partner's own lead detail + status timeline. */
export default async function PartnerLeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const session = await requirePartnerSession();
  const lead = await getPartnerLead(session.partnerId, leadId);
  if (!lead) notFound();

  const steps = computeLeadTimeline({
    stage: lead.stage,
    assignedToUid: lead.assignedToUid,
    participantId: lead.participantId,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={lead.name} description={lead.phone} />
      <Card>
        <CardContent className="pt-6">
          <LeadTimeline steps={steps} />
        </CardContent>
      </Card>
    </div>
  );
}
