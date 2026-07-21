'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { Batch } from '@/features/batches/schema';

import { setParticipantStatus } from '../actions/set-participant-status';
import { isManuallyAssignableStatus, requiresStatusReason } from '../logic';
import {
  PARTICIPANT_STATUSES,
  type Enrolment,
  type Participant,
  type ParticipantDocument,
  type ParticipantStatus,
  type TimelineEntry,
} from '../schema';
import { PARTICIPANT_STATUS_BADGE, PARTICIPANT_STATUS_LABELS } from '../status-labels';
import { ParticipantDocuments } from './participant-documents';
import { ParticipantEnrolments } from './participant-enrolments';
import { ParticipantOverview } from './participant-overview';
import { ParticipantTimeline } from './participant-timeline';

/**
 * S21 — the lifetime record (Doc 16). Tabs ship as their modules land;
 * Overview / Enrolments / Documents / Timeline are live now, with
 * Attendance / Assessments / Certificates / Career / Fees joining later
 * without restructuring this shell.
 */
export function ParticipantProfile({
  participant,
  enrolments,
  documents,
  timeline,
  canUpdate,
  canAllocate,
  allocatableBatches,
}: {
  participant: Participant;
  enrolments: Enrolment[];
  documents: ParticipantDocument[];
  timeline: TimelineEntry[];
  canUpdate: boolean;
  canAllocate: boolean;
  allocatableBatches: Batch[];
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<ParticipantStatus | null>(null);
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const assignable = PARTICIPANT_STATUSES.filter(isManuallyAssignableStatus);

  const confirmStatus = async () => {
    if (!target) return;
    setPending(true);
    try {
      const outcome = await setParticipantStatus({
        participantId: participant.id,
        status: target,
        ...(reason ? { reason } : {}),
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`Status changed to ${PARTICIPANT_STATUS_LABELS[target]}`);
      setTarget(null);
      setReason('');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          kind={PARTICIPANT_STATUS_BADGE[participant.status]}
          label={PARTICIPANT_STATUS_LABELS[participant.status]}
        />
        {canUpdate ? (
          <Select
            value={participant.status}
            disabled={pending}
            onValueChange={(value) => {
              const next = value as ParticipantStatus;
              if (next !== participant.status) setTarget(next);
            }}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignable.map((status) => (
                <SelectItem key={status} value={status}>
                  {PARTICIPANT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
              {participant.status === 'alumni' ? (
                <SelectItem value="alumni" disabled>
                  {PARTICIPANT_STATUS_LABELS.alumni} (earned)
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="enrolments">Enrolments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ParticipantOverview participant={participant} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="enrolments">
          <ParticipantEnrolments
            participantId={participant.id}
            enrolments={enrolments}
            currentEnrolmentId={participant.currentEnrolmentId}
            canUpdate={canUpdate}
            canAllocate={canAllocate}
            allocatableBatches={allocatableBatches}
          />
        </TabsContent>
        <TabsContent value="documents">
          <ParticipantDocuments
            participantId={participant.id}
            documents={documents}
            canUpload={canUpdate}
          />
        </TabsContent>
        <TabsContent value="timeline">
          <ParticipantTimeline
            participantId={participant.id}
            entries={timeline}
            canUpdate={canUpdate}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setReason('');
          }
        }}
        title={target ? `Change status to ${PARTICIPANT_STATUS_LABELS[target]}?` : ''}
        consequence={
          target === 'dropped'
            ? 'The participant will be marked as dropped and their current enrolment cleared. This is recorded in the audit trail.'
            : 'This change is recorded on the participant timeline and in the audit trail.'
        }
        confirmLabel="Change status"
        variant={target === 'dropped' ? 'destructive' : 'primary'}
        pending={pending}
        onConfirm={confirmStatus}
      >
        {target && requiresStatusReason(target) ? (
          <div className="space-y-2">
            <Label htmlFor="status-reason" required>
              Reason
            </Label>
            <Input
              id="status-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this participant being dropped?"
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
