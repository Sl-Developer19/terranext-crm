import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  CommunityPartnersTable,
  RegisterCommunityPartnerDialog,
  listCommunityPartners,
} from '@/features/community-partners';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Growth Community Business' };

/**
 * TerraNext Community Growth Network — org-wide business directory. Reuses
 * `growthPartners:*` permissions (approved architecture: no new RBAC module
 * per partner programme) and mirrors `/growth-partners` exactly, but reads
 * exclusively from `listCommunityPartners()` (`communityPartners`
 * collection) — a completely separate pipeline from Growth Partners, so
 * nothing submitted through the individual Growth Partner website can ever
 * appear on this page (Task 3/4 verification).
 */
export default async function GrowthCommunityBusinessPage() {
  const session = await requirePermission('growthPartners:view');
  const canCreate = can(session.role, 'growthPartners:create');
  const partners = await listCommunityPartners();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Growth Community Business"
        description="Businesses and organisations in the Community Growth Network — registration, approval, and status."
        actions={canCreate ? <RegisterCommunityPartnerDialog /> : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <CommunityPartnersTable partners={partners} />
        </CardContent>
      </Card>
    </div>
  );
}
