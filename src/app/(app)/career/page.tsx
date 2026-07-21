import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AddCareerProfileDialog, CareerProfilesTable, listCareerProfiles } from '@/features/career';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Career Interest' };

/** Career interest directory (Doc 03 §1.6, BR-09). */
export default async function CareerPage() {
  const session = await requirePermission('career:view');
  const rows = await listCareerProfiles();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career Interest"
        description="Preferred job categories, countries, passport status, and placement readiness — eligibility is always a human decision, never a formula (BR-09)."
        actions={can(session.role, 'career:create') ? <AddCareerProfileDialog /> : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <CareerProfilesTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
