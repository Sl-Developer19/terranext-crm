import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { PartnerDetailView, getGrowthPartner } from '@/features/growth-partners';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Growth Partner' };

/** Doc 25 §4/§6 — partner profile with the approve/reject/status actions. */
export default async function GrowthPartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  const session = await requirePermission('growthPartners:view');
  const partner = await getGrowthPartner(partnerId);
  if (!partner) notFound();

  const canApprove = can(session.role, 'growthPartners:approve');
  const canManageStatus = can(session.role, 'growthPartners:update');

  return (
    <div className="space-y-6">
      <PageHeader title={partner.displayName} description={partner.email} />
      <PartnerDetailView
        partner={partner}
        canApprove={canApprove}
        canManageStatus={canManageStatus}
      />
    </div>
  );
}
