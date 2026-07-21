import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { CareerProfileDetail, getCareerProfile, listGuidanceSessions } from '@/features/career';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Career profile' };

export default async function CareerProfileDetailPage({
  params,
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = await params;
  const session = await requirePermission('career:view');

  const profile = await getCareerProfile(decodeURIComponent(participantId));
  if (!profile) notFound();

  const sessions = await listGuidanceSessions(profile.participantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.participantName ?? profile.participantId}
        description={`${profile.participantId} · career interest and placement readiness`}
      />
      <CareerProfileDetail
        profile={profile}
        sessions={sessions}
        canUpdate={can(session.role, 'career:update')}
        canEvaluate={can(session.role, 'career:update')}
      />
    </div>
  );
}
