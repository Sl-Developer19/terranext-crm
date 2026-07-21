import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import {
  FamilyDetailView,
  getFamily,
  listFamilyProgrammeHistory,
  listParentSessions,
  listParents,
} from '@/features/parents';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Family' };

/** Family workspace: parents, counselling, conversion, programme history. */
export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const session = await requirePermission('parents:view');

  const family = await getFamily(familyId);
  if (!family) notFound();

  const [parents, sessions, history] = await Promise.all([
    listParents(family.id),
    listParentSessions(family.id),
    listFamilyProgrammeHistory(family.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={family.familyName}
        description={`${family.primaryContactName} · ${family.primaryContactPhone} · ${family.linkedParticipantIds.length} participant${family.linkedParticipantIds.length === 1 ? '' : 's'}`}
      />
      <FamilyDetailView
        family={family}
        parents={parents}
        sessions={sessions}
        history={history}
        canUpdate={can(session.role, 'parents:update')}
      />
    </div>
  );
}
