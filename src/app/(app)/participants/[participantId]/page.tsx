import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { listAllocatableBatches } from '@/features/batches';
import { listCommunicationsFor } from '@/features/communications';
import {
  ParticipantProfile,
  getParticipant,
  listDocuments,
  listEnrolments,
  listTimeline,
} from '@/features/participants';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Participant' };

/** S21 — the lifetime record (Doc 16, BR-01). */
export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = await params;
  const session = await requirePermission('participants:view');

  const participant = await getParticipant(decodeURIComponent(participantId));
  if (!participant) notFound();

  const canAllocate = can(session.role, 'batches:assign');
  const canViewComms = can(session.role, 'communications:view');
  const [enrolments, documents, timeline, allocatableBatches, communications] = await Promise.all([
    listEnrolments(participant.id),
    listDocuments(participant.id),
    listTimeline(participant.id),
    canAllocate ? listAllocatableBatches() : Promise.resolve([]),
    canViewComms ? listCommunicationsFor('participant', participant.id) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={participant.personal.fullName}
        description={`${participant.id} · ${participant.personal.phone}`}
      />
      <ParticipantProfile
        participant={participant}
        enrolments={enrolments}
        documents={documents}
        communications={communications}
        timeline={timeline}
        canUpdate={can(session.role, 'participants:update')}
        canAllocate={canAllocate}
        allocatableBatches={allocatableBatches}
      />
    </div>
  );
}
