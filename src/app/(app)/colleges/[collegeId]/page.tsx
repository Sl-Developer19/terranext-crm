import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { CampusLeaders, conversionPct, getCollege, listCampusLeaders } from '@/features/colleges';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'College' };

/** S15 — college detail with campus leaders and lead stats (Doc 16). */
export default async function CollegeDetailPage({
  params,
}: {
  params: Promise<{ collegeId: string }>;
}) {
  const { collegeId } = await params;
  const session = await requirePermission('colleges:view');

  const college = await getCollege(decodeURIComponent(collegeId));
  if (!college) notFound();

  const leaders = await listCampusLeaders(college.id);
  const rate = conversionPct(college);

  return (
    <div className="space-y-6">
      <PageHeader
        title={college.name}
        description={`${college.city}${college.contactPerson ? ` · ${college.contactPerson}` : ''}`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Leads referred" value={String(college.leadCount)} />
        <StatCard label="Admitted" value={String(college.admittedCount)} />
        <StatCard label="Conversion" value={rate === null ? '—' : `${rate}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campus leaders</CardTitle>
        </CardHeader>
        <CardContent>
          <CampusLeaders
            collegeId={college.id}
            leaders={leaders}
            canManage={can(session.role, 'colleges:update')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
