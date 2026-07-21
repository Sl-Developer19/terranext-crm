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

import { createAssessment, updateAssessment } from '../actions/manage-assessment';
import { assessmentSchema, type Assessment, type AssessmentInput } from '../schema';

/** S26 assessment create/edit. */
export function AssessmentDialog({
  batches,
  assessment,
}: {
  batches: Array<{ id: string; code: string; programmeName: string | null }>;
  assessment?: Assessment;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const editing = assessment !== undefined;

  const form = useForm<AssessmentInput>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      batchId: assessment?.batchId ?? '',
      name: assessment?.name ?? '',
      maxScore: assessment?.maxScore ?? 100,
      passScore: assessment?.passScore ?? 40,
      heldAt: assessment?.heldAt ?? '',
    },
  });

  const onSubmit = async (values: AssessmentInput) => {
    const outcome = editing
      ? await updateAssessment({
          assessmentId: assessment.id,
          name: values.name,
          maxScore: values.maxScore,
          passScore: values.passScore,
          heldAt: values.heldAt,
        })
      : await createAssessment(values);

    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof AssessmentInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success(editing ? 'Assessment updated' : 'Assessment created');
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
          <Button size="sm" disabled={batches.length === 0}>
            <Plus aria-hidden />
            New assessment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit assessment' : 'New assessment'}</DialogTitle>
          <DialogDescription>
            Pass/fail is derived from the pass mark when scores are entered — changing it later
            re-derives every result and is recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          {!editing ? (
            <div className="space-y-2">
              <Label htmlFor="assessment-batch" required>
                Batch
              </Label>
              <Select onValueChange={(value) => form.setValue('batchId', value)}>
                <SelectTrigger id="assessment-batch">
                  <SelectValue placeholder="Select a batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.code}
                      {batch.programmeName ? ` · ${batch.programmeName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.batchId ? (
                <p className="text-xs text-destructive">{form.formState.errors.batchId.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="assessment-name" required>
              Name
            </Label>
            <Input id="assessment-name" placeholder="Module 1 test" {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="assessment-max" required>
                Max score
              </Label>
              <Input
                id="assessment-max"
                type="number"
                min={1}
                {...form.register('maxScore', { valueAsNumber: true })}
              />
              {form.formState.errors.maxScore ? (
                <p className="text-xs text-destructive">{form.formState.errors.maxScore.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment-pass" required>
                Pass score
              </Label>
              <Input
                id="assessment-pass"
                type="number"
                min={0}
                {...form.register('passScore', { valueAsNumber: true })}
              />
              {form.formState.errors.passScore ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.passScore.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment-date" required>
                Held on
              </Label>
              <Input id="assessment-date" type="date" {...form.register('heldAt')} />
              {form.formState.errors.heldAt ? (
                <p className="text-xs text-destructive">{form.formState.errors.heldAt.message}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create assessment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
