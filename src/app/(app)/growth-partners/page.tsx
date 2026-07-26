import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  GrowthPartnersTable,
  RegisterGrowthPartnerDialog,
  listGrowthPartners,
} from '@/features/growth-partners';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Growth Partners' };

/** Doc 25 §6 — org-wide Growth Partner directory. */
export default async function GrowthPartnersPage() {
  const session = await requirePermission('growthPartners:view');
  const partners = await listGrowthPartners();
  const canCreate = can(session.role, 'growthPartners:create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Growth Partners"
        description="External referral partners — registration, approval, and status."
        actions={canCreate ? <RegisterGrowthPartnerDialog /> : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <GrowthPartnersTable partners={partners} />
        </CardContent>
      </Card>
    </div>
  );
}
