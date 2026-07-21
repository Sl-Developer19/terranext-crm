'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { GraduationCap, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { addEnrolment, setEnrolmentStatus } from '../actions/manage-enrolment';
import {
  ENROLMENT_STATUSES,
  addEnrolmentSchema,
  type AddEnrolmentInput,
  type Enrolment,
  type EnrolmentStatus,
} from '../schema';
import { ENROLMENT_STATUS_BADGE, ENROLMENT_STATUS_LABELS } from '../status-labels';

/**
 * S21 Enrolments tab (Doc 16): academy/programme enrolment + batch
 * assignment. Academy/programme/batch are free-text until the catalogue and
 * batch modules land — the field names already match their future foreign
 * keys, so this becomes a picklist without a data migration.
 */
export function ParticipantEnrolments({
  participantId,
  enrolments,
  currentEnrolmentId,
  canUpdate,
}: {
  participantId: string;
  enrolments: Enrolment[];
  currentEnrolmentId: string | null;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const form = useForm<AddEnrolmentInput>({
    resolver: zodResolver(addEnrolmentSchema),
    defaultValues: {
      participantId,
      academyId: '',
      programmeId: '',
      batchId: '',
      status: 'orientation',
    },
  });

  const onSubmit = async (values: AddEnrolmentInput) => {
    const outcome = await addEnrolment(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof AddEnrolmentInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Enrolment added');
    setOpen(false);
    form.reset({
      participantId,
      academyId: '',
      programmeId: '',
      batchId: '',
      status: 'orientation',
    });
    router.refresh();
  };

  const handleStatusChange = async (enrolment: Enrolment, status: EnrolmentStatus) => {
    if (status === enrolment.status) return;
    setPendingId(enrolment.id);
    try {
      const outcome = await setEnrolmentStatus({
        participantId,
        enrolmentId: enrolment.id,
        status,
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`Enrolment marked ${ENROLMENT_STATUS_LABELS[status].toLowerCase()}`);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Enrolments</CardTitle>
        {canUpdate ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus aria-hidden />
                Add enrolment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add enrolment</DialogTitle>
                <DialogDescription>
                  Re-enrolment adds a new enrolment to this same lifetime record — it never creates
                  a second participant.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="academyId" required>
                    Academy
                  </Label>
                  <Input
                    id="academyId"
                    placeholder="e.g. Gen Z Career Readiness"
                    {...form.register('academyId')}
                  />
                  {form.formState.errors.academyId ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.academyId.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="programmeId" required>
                    Programme
                  </Label>
                  <Input
                    id="programmeId"
                    placeholder="e.g. Career Foundation 2026"
                    {...form.register('programmeId')}
                  />
                  {form.formState.errors.programmeId ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.programmeId.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchId">Batch</Label>
                  <Input id="batchId" placeholder="Optional" {...form.register('batchId')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="enrolment-status">Status</Label>
                  <Select
                    defaultValue="orientation"
                    onValueChange={(value) =>
                      form.setValue('status', value as AddEnrolmentInput['status'])
                    }
                  >
                    <SelectTrigger id="enrolment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENROLMENT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {ENROLMENT_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={form.formState.isSubmitting}>
                    Add enrolment
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent className={enrolments.length === 0 ? undefined : 'p-0'}>
        {enrolments.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            headline="No enrolments yet"
            explanation="Add an enrolment to place this participant into an academy programme and batch."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Programme</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Enrolled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrolments.map((enrolment) => (
                <TableRow key={enrolment.id}>
                  <TableCell>
                    <div className="font-medium">{enrolment.programmeId}</div>
                    <div className="text-xs text-muted-foreground">
                      {enrolment.academyId}
                      {enrolment.id === currentEnrolmentId ? ' · current' : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{enrolment.batchId ?? '—'}</TableCell>
                  <TableCell>
                    {canUpdate ? (
                      <Select
                        value={enrolment.status}
                        disabled={pendingId === enrolment.id}
                        onValueChange={(value) =>
                          handleStatusChange(enrolment, value as EnrolmentStatus)
                        }
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENROLMENT_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {ENROLMENT_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge
                        kind={ENROLMENT_STATUS_BADGE[enrolment.status]}
                        label={ENROLMENT_STATUS_LABELS[enrolment.status]}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {enrolment.attendancePct}%
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {enrolment.enrolledAt ? format(new Date(enrolment.enrolledAt), 'PP') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
