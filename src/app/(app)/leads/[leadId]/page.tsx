import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { LeadDetailView, getLead, listConsultants, listLeadActivities } from '@/features/leads';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Lead' };

/** S11 — lead profile (Doc 16): details, activity trail, stage/assignment. */
export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const session = await requirePermission('leads:view');
  const lead = await getLead(session, leadId);
  if (!lead) notFound();

  const canUpdate = can(session.role, 'leads:update');
  const canAssign = can(session.role, 'leads:assign');
  const [activities, consultants] = await Promise.all([
    listLeadActivities(leadId),
    canAssign ? listConsultants() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={lead.name} description={lead.phone} />
      <LeadDetailView
        lead={lead}
        activities={activities}
        consultants={consultants}
        canUpdate={canUpdate}
        canAssign={canAssign}
      />
    </div>
  );
}
