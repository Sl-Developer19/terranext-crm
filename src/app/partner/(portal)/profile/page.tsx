import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EditOwnProfileForm, getGrowthPartner } from '@/features/growth-partners';
import { requirePartnerSession } from '@/lib/rbac/require-partner';

export const metadata: Metadata = { title: 'My Profile' };

export default async function PartnerProfilePage() {
  const session = await requirePartnerSession();
  const partner = await getGrowthPartner(session.partnerId);
  if (!partner) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Your Growth Partner account details." />
      <Card>
        <CardContent className="pt-6">
          <EditOwnProfileForm partner={partner} />
        </CardContent>
      </Card>
    </div>
  );
}
