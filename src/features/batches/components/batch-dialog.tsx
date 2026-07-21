'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProgrammeOption } from '@/features/catalogue';

import { createBatch, updateBatch } from '../actions/manage-batch';
import { WEEKDAYS, batchSchema, type Batch, type BatchInput, type Weekday } from '../schema';

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const UNASSIGNED = '__unassigned__';

/** S23 batch create/edit. Creating also seeds the session calendar. */
export function BatchDialog({
  programmes,
  trainers,
  batch,
}: {
  programmes: ProgrammeOption[];
  trainers: Array<{ uid: string; displayName: string }>;
  batch?: Batch;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const editing = batch !== undefined;

  const form = useForm<BatchInput>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      programmeId: batch?.programmeId ?? '',
      code: batch?.code ?? '',
      startDate: batch?.startDate ?? '',
      endDate: batch?.endDate ?? '',
      capacity: batch?.capacity ?? 30,
      trainerUid: batch?.trainerUid ?? '',
      days: batch?.schedule.days ?? ['mon', 'wed', 'fri'],
      startTime: batch?.schedule.startTime ?? '10:00',
      endTime: batch?.schedule.endTime ?? '12:00',
    },
  });

  const selectedDays = form.watch('days') ?? [];

  const toggleDay = (day: Weekday) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    form.setValue('days', next, { shouldValidate: true });
  };

  const onSubmit = async (values: BatchInput) => {
    const outcome = editing
      ? await updateBatch({ ...values, batchId: batch.id })
      : await createBatch(values);

    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof BatchInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success(editing ? 'Batch updated' : 'Batch created with its session calendar');
    setOpen(false);
    if (!editing) form.reset();
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && !editing) form.reset();
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" size="sm">
            Edit
          </Button>
        ) : (
          <Button size="sm" disabled={programmes.length === 0}>
            <Plus aria-hidden />
            New batch
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit batch' : 'New batch'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Capacity cannot be reduced below the participants already allocated.'
              : 'Sessions are generated automatically from the weekly schedule.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="batch-programme" required>
                Programme
              </Label>
              <Select
                {...(batch?.programmeId ? { defaultValue: batch.programmeId } : {})}
                onValueChange={(value) => form.setValue('programmeId', value)}
              >
                <SelectTrigger id="batch-programme">
                  <SelectValue placeholder="Select a programme" />
                </SelectTrigger>
                <SelectContent>
                  {programmes.map((programme) => (
                    <SelectItem key={programme.id} value={programme.id}>
                      {programme.name} ({programme.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.programmeId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.programmeId.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-code" required>
                Batch code
              </Label>
              <Input id="batch-code" placeholder="GENZ-B1-26" {...form.register('code')} />
              {form.formState.errors.code ? (
                <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-start" required>
                Start date
              </Label>
              <Input id="batch-start" type="date" {...form.register('startDate')} />
              {form.formState.errors.startDate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startDate.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-end" required>
                End date
              </Label>
              <Input id="batch-end" type="date" {...form.register('endDate')} />
              {form.formState.errors.endDate ? (
                <p className="text-xs text-destructive">{form.formState.errors.endDate.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-capacity" required>
                Capacity
              </Label>
              <Input
                id="batch-capacity"
                type="number"
                min={1}
                {...form.register('capacity', { valueAsNumber: true })}
              />
              {form.formState.errors.capacity ? (
                <p className="text-xs text-destructive">{form.formState.errors.capacity.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-trainer">Trainer</Label>
              <Select
                {...(batch?.trainerUid ? { defaultValue: batch.trainerUid } : {})}
                onValueChange={(value) =>
                  form.setValue('trainerUid', value === UNASSIGNED ? '' : value)
                }
              >
                <SelectTrigger id="batch-trainer">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {trainers.map((trainer) => (
                    <SelectItem key={trainer.uid} value={trainer.uid}>
                      {trainer.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label required>Days</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={selectedDays.includes(day) ? 'primary' : 'outline'}
                  onClick={() => toggleDay(day)}
                >
                  {DAY_LABELS[day]}
                </Button>
              ))}
            </div>
            {form.formState.errors.days ? (
              <p className="text-xs text-destructive">{form.formState.errors.days.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="batch-start-time" required>
                Start time
              </Label>
              <Input id="batch-start-time" type="time" {...form.register('startTime')} />
              {form.formState.errors.startTime ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startTime.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-end-time" required>
                End time
              </Label>
              <Input id="batch-end-time" type="time" {...form.register('endTime')} />
              {form.formState.errors.endTime ? (
                <p className="text-xs text-destructive">{form.formState.errors.endTime.message}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create batch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
