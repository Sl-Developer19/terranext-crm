import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ConvertLeadStepper, getConversionContext } from '@/features/admissions';
import { listAllocatableBatches } from '@/features/batches';
import { listProgrammeOptions } from '@/features/catalogue';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Convert lead' };

/** S14 — lead → participant (Doc 16, BR-01/BR-02/BR-04). */
export default async function ConvertLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  await requirePermission('admissions:create');

  const context = await getConversionContext(decodeURIComponent(leadId));
  if (!context?.lead) notFound();

  // Guard the route itself, not just the button: BR-02 is not satisfiable by
  // navigating straight to this URL.
  if (!context.checklist.satisfied) redirect('/admissions');

  const [programmes, batches] = await Promise.all([
    listProgrammeOptions(),
    listAllocatableBatches(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Convert ${context.lead.name}`}
        description="Issuing a permanent participant ID. Every rule shown here is re-checked when the admission commits."
      />
      <Card>
        <CardContent className="space-y-6">
          <ConvertLeadStepper
            leadId={context.lead.id}
            leadName={context.lead.name}
            defaults={{
              fullName: context.lead.name,
              phone: context.lead.phone,
              email: context.lead.email ?? '',
            }}
            duplicates={context.duplicates}
            programmes={programmes.map((p) => ({
              id: p.id,
              name: p.name,
              academyId: p.academyId,
            }))}
            batches={batches.map((batch) => ({
              id: batch.id,
              label: batch.code,
              academyId: batch.academyId,
              programmeId: batch.programmeId,
              seatsLeft: Math.max(batch.capacity - batch.enrolledCount, 0),
            }))}
            recommendedProgrammeId={context.recommendedProgrammeId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
