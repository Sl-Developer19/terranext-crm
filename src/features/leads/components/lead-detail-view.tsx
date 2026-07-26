'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RecordCommunications } from '@/features/communications/components/record-communications';
import type { Communication } from '@/features/communications/schema';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { MessageSquareText } from 'lucide-react';

import { assignLead } from '../actions/assign-lead';
import { deleteLead } from '../actions/delete-lead';
import { logLeadActivity } from '../actions/log-lead-activity';
import { updateLead } from '../actions/update-lead';
import { LEAD_ACTIVITY_TYPES, LEAD_STAGES, type Lead, type LeadActivity } from '../schema';
import { LEAD_STAGE_BADGE, LEAD_STAGE_LABELS, LEAD_TYPE_LABELS } from '../stage-labels';

const ACTIVITY_TYPE_LABELS: Record<(typeof LEAD_ACTIVITY_TYPES)[number], string> = {
  call: 'Call',
  note: 'Note',
  stage_change: 'Stage change',
  followup: 'Follow-up',
};

interface ActivityFormValues {
  type: (typeof LEAD_ACTIVITY_TYPES)[number];
  summary: string;
  nextFollowUpAt: string;
}

/** S11 lead profile (Doc 16): details, stage/assignment control, activity trail. */
export function LeadDetailView({
  lead,
  activities,
  communications,
  consultants,
  canUpdate,
  canAssign,
  canDelete = false,
}: {
  lead: Lead;
  activities: LeadActivity[];
  /** `null` when the viewer lacks `communications:view` — the card is then hidden. */
  communications: Communication[] | null;
  consultants: Array<{ uid: string; displayName: string }>;
  canUpdate: boolean;
  canAssign: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [stagePending, setStagePending] = React.useState(false);
  const [assignPending, setAssignPending] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);

  const confirmDelete = async () => {
    setDeletePending(true);
    try {
      const outcome = await deleteLead({ leadId: lead.id });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`${lead.name} was deleted`);
      router.push('/leads');
    } finally {
      setDeletePending(false);
      setDeleteOpen(false);
    }
  };

  const form = useForm<ActivityFormValues>({
    defaultValues: { type: 'note', summary: '', nextFollowUpAt: '' },
  });

  const handleStageChange = async (stage: (typeof LEAD_STAGES)[number]) => {
    if (stage === lead.stage) return;
    setStagePending(true);
    try {
      const outcome = await updateLead({ leadId: lead.id, stage });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`Stage updated to ${LEAD_STAGE_LABELS[stage]}`);
      router.refresh();
    } finally {
      setStagePending(false);
    }
  };

  const handleAssign = async (assignToUid: string) => {
    setAssignPending(true);
    try {
      const outcome = await assignLead({ leadId: lead.id, assignToUid });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Lead reassigned');
      router.refresh();
    } finally {
      setAssignPending(false);
    }
  };

  const onSubmitActivity = async (values: ActivityFormValues) => {
    const activityOutcome = await logLeadActivity({
      leadId: lead.id,
      type: values.type,
      summary: values.summary,
    });
    if (!activityOutcome.ok) {
      toast.error(activityOutcome.error.message);
      return;
    }
    if (values.nextFollowUpAt) {
      const followUpOutcome = await updateLead({
        leadId: lead.id,
        nextFollowUpAt: new Date(values.nextFollowUpAt).toISOString(),
      });
      if (!followUpOutcome.ok) {
        toast.error(followUpOutcome.error.message);
        return;
      }
    }
    toast.success('Activity logged');
    form.reset({ type: 'note', summary: '', nextFollowUpAt: '' });
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity trail</CardTitle>
          </CardHeader>
          <CardContent>
            {canUpdate ? (
              <form
                onSubmit={form.handleSubmit(onSubmitActivity)}
                noValidate
                className="mb-6 space-y-3 rounded-md border p-4"
              >
                <div className="flex gap-3">
                  <div className="w-40 space-y-2">
                    <Label htmlFor="activity-type">Type</Label>
                    <Select
                      defaultValue={form.getValues('type')}
                      onValueChange={(value) =>
                        form.setValue('type', value as ActivityFormValues['type'])
                      }
                    >
                      <SelectTrigger id="activity-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_ACTIVITY_TYPES.filter((t) => t !== 'stage_change').map((type) => (
                          <SelectItem key={type} value={type}>
                            {ACTIVITY_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="nextFollowUpAt">Next follow-up (optional)</Label>
                    <Input
                      id="nextFollowUpAt"
                      type="datetime-local"
                      {...form.register('nextFollowUpAt')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary" required>
                    Summary
                  </Label>
                  <Input
                    id="summary"
                    placeholder="What happened?"
                    {...form.register('summary', { required: true })}
                  />
                </div>
                <Button type="submit" size="sm" loading={form.formState.isSubmitting}>
                  Log activity
                </Button>
              </form>
            ) : null}

            {activities.length === 0 ? (
              <EmptyState
                icon={MessageSquareText}
                headline="No activity yet"
                explanation="Calls, notes, and stage changes will appear here."
              />
            ) : (
              <ol className="space-y-4">
                {activities.map((activity) => (
                  <li key={activity.id} className="border-l-2 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {ACTIVITY_TYPE_LABELS[activity.type]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{activity.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">by {activity.byName}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {communications ? (
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordCommunications rows={communications} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Lead details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              <div>{lead.phone}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div>{lead.email ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Lead type</div>
              <div>{lead.leadType ? LEAD_TYPE_LABELS[lead.leadType] : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Programme interest</div>
              <div>{lead.programmeInterestName ?? '—'}</div>
            </div>
            {lead.partnerName ? (
              <div>
                <div className="text-xs text-muted-foreground">Referred by</div>
                <div>{lead.partnerName}</div>
              </div>
            ) : null}
            <div>
              <div className="text-xs text-muted-foreground">Source</div>
              <div className="capitalize">{lead.source}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Created</div>
              <div>{format(new Date(lead.createdAt), 'PPp')}</div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="stage">Stage</Label>
              <Select
                value={lead.stage}
                disabled={!canUpdate || stagePending}
                onValueChange={(value) => handleStageChange(value as (typeof LEAD_STAGES)[number])}
              >
                <SelectTrigger id="stage">
                  <SelectValue>
                    <StatusBadge
                      kind={LEAD_STAGE_BADGE[lead.stage]}
                      label={LEAD_STAGE_LABELS[lead.stage]}
                    />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {LEAD_STAGE_LABELS[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canAssign ? (
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigned to</Label>
                <Select
                  {...(lead.assignedToUid ? { value: lead.assignedToUid } : {})}
                  disabled={assignPending}
                  onValueChange={handleAssign}
                >
                  <SelectTrigger id="assignedTo">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultants.map((consultant) => (
                      <SelectItem key={consultant.uid} value={consultant.uid}>
                        {consultant.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <div className="text-xs text-muted-foreground">Assigned to</div>
                <div>{lead.assignedToName ?? 'Unassigned'}</div>
              </div>
            )}
            {canDelete ? (
              <>
                <Separator />
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete lead
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this lead?"
        consequence="Are you sure you want to delete this record? This action can only be performed by the Founder."
        confirmLabel="Delete"
        variant="destructive"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
