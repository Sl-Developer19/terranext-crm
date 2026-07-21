import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  CreateFamilyDialog,
  FamiliesTable,
  FamilyFilters,
  familyFiltersSchema,
  listFamilies,
} from '@/features/parents';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Parents & Families' };

/** Family directory — the parent-first acquisition path. */
export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission('parents:view');
  const params = await searchParams;
  const single = (key: string): string =>
    typeof params[key] === 'string' ? (params[key] as string) : '';

  const parsed = familyFiltersSchema.safeParse({
    q: single('q') || undefined,
    source: single('source') || undefined,
    conversionStatus: single('conversionStatus') || undefined,
    page: single('page') || undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const data = await listFamilies(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parents & Families"
        description="Households are records in their own right — counsel the parent, track every sibling, and see what the family has done with the academy in one place."
        actions={can(session.role, 'parents:create') ? <CreateFamilyDialog /> : undefined}
      />
      <FamilyFilters
        initialQuery={single('q')}
        initialSource={single('source')}
        initialConversion={single('conversionStatus')}
      />
      <Card>
        <CardContent className="p-0">
          <FamiliesTable
            data={data}
            filtered={Boolean(filters.q || filters.source || filters.conversionStatus)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
