import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { listCommunicationsFor } from '@/features/communications';
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
  const canDelete = can(session.role, 'leads:delete');
  const canViewComms = can(session.role, 'communications:view');
  const [activities, consultants, communications] = await Promise.all([
    listLeadActivities(leadId),
    canAssign ? listConsultants() : Promise.resolve([]),
    canViewComms ? listCommunicationsFor('lead', leadId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={lead.name} description={lead.phone} />
      <LeadDetailView
        lead={lead}
        activities={activities}
        communications={communications}
        consultants={consultants}
        canUpdate={canUpdate}
        canAssign={canAssign}
        canDelete={canDelete}
      />
    </div>
  );
}
