'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';

import { createProgramme, updateProgramme } from '../actions/manage-programme';
import { formatPaise, sumInstallments } from '../logic';
import { programmeSchema, type Academy, type Programme, type ProgrammeInput } from '../schema';

/**
 * S22 programme form. Carries the BR-03 certificate thresholds and the
 * default fee plan — the two pieces of configuration that later modules read
 * instead of hardcoding.
 *
 * Fee amounts are entered in rupees and stored as integer paise (ADR-012);
 * the conversion happens once, here, at the form boundary.
 */
export function ProgrammeDialog({
  academies,
  programme,
}: {
  academies: Academy[];
  programme?: Programme;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const editing = programme !== undefined;

  const form = useForm<ProgrammeInput>({
    resolver: zodResolver(programmeSchema),
    defaultValues: {
      academyId: programme?.academyId ?? '',
      name: programme?.name ?? '',
      code: programme?.code ?? '',
      durationDays: programme?.durationDays ?? 30,
      sessionCount: programme?.sessionCount ?? 12,
      eligibility: programme?.eligibility ?? '',
      curriculumSummary: programme?.curriculumSummary ?? '',
      minAttendancePct: programme?.certificateRules.minAttendancePct ?? 75,
      minAssessmentScore: programme?.certificateRules.minAssessmentScore ?? 40,
      totalFeePaise: programme?.feePlanDefault.totalPaise ?? 0,
      installments: programme?.feePlanDefault.installments ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'installments' });
  const watchedInstallments = form.watch('installments');
  const watchedTotal = form.watch('totalFeePaise');
  const installmentSum = sumInstallments(watchedInstallments ?? []);
  const unbalanced = (watchedInstallments?.length ?? 0) > 0 && installmentSum !== watchedTotal;

  const onSubmit = async (values: ProgrammeInput) => {
    const outcome = editing
      ? await updateProgramme({ ...values, programmeId: programme.id })
      : await createProgramme(values);

    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof ProgrammeInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success(editing ? 'Programme updated' : 'Programme created');
    setOpen(false);
    if (!editing) form.reset();
    router.refresh();
  };

  const activeAcademies = academies.filter(
    (academy) => academy.status === 'active' || academy.id === programme?.academyId,
  );

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
          <Button size="sm" disabled={activeAcademies.length === 0}>
            <Plus aria-hidden />
            New programme
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit programme' : 'New programme'}</DialogTitle>
          <DialogDescription>
            Certificate thresholds and the default fee plan are configuration — attendance and
            assessment gates (BR-03) are read from here, never hardcoded.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Programme</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="programme-academy" required>
                  Academy
                </Label>
                <Select
                  {...(programme?.academyId ? { defaultValue: programme.academyId } : {})}
                  onValueChange={(value) => form.setValue('academyId', value)}
                >
                  <SelectTrigger id="programme-academy">
                    <SelectValue placeholder="Select an academy" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAcademies.map((academy) => (
                      <SelectItem key={academy.id} value={academy.id}>
                        {academy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.academyId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.academyId.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="programme-code" required>
                  Code
                </Label>
                <Input id="programme-code" placeholder="GENZ-CF-26" {...form.register('code')} />
                {form.formState.errors.code ? (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="programme-name" required>
                  Name
                </Label>
                <Input id="programme-name" {...form.register('name')} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="programme-duration" required>
                  Duration (days)
                </Label>
                <Input
                  id="programme-duration"
                  type="number"
                  min={1}
                  {...form.register('durationDays', { valueAsNumber: true })}
                />
                {form.formState.errors.durationDays ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.durationDays.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="programme-sessions" required>
                  Sessions
                </Label>
                <Input
                  id="programme-sessions"
                  type="number"
                  min={1}
                  {...form.register('sessionCount', { valueAsNumber: true })}
                />
                {form.formState.errors.sessionCount ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.sessionCount.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="programme-eligibility">Eligibility</Label>
                <Textarea id="programme-eligibility" {...form.register('eligibility')} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="programme-curriculum">Curriculum summary</Label>
                <Textarea id="programme-curriculum" {...form.register('curriculumSummary')} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Certificate rules (BR-03)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="programme-attendance" required>
                  Minimum attendance %
                </Label>
                <Input
                  id="programme-attendance"
                  type="number"
                  min={0}
                  max={100}
                  {...form.register('minAttendancePct', { valueAsNumber: true })}
                />
                {form.formState.errors.minAttendancePct ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.minAttendancePct.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="programme-score" required>
                  Minimum assessment score
                </Label>
                <Input
                  id="programme-score"
                  type="number"
                  min={0}
                  max={100}
                  {...form.register('minAssessmentScore', { valueAsNumber: true })}
                />
                {form.formState.errors.minAssessmentScore ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.minAssessmentScore.message}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Default fee plan</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ label: '', amountPaise: 0, dueOffsetDays: 0 })}
              >
                <Plus aria-hidden />
                Add installment
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="programme-total" required>
                Total fee (paise)
              </Label>
              <Input
                id="programme-total"
                type="number"
                min={0}
                {...form.register('totalFeePaise', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Stored as integer paise. {formatPaise(watchedTotal || 0)}
              </p>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 rounded-md border p-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`installment-label-${index}`}>Label</Label>
                  <Input
                    id={`installment-label-${index}`}
                    placeholder="Deposit"
                    {...form.register(`installments.${index}.label`)}
                  />
                </div>
                <div className="w-36 space-y-2">
                  <Label htmlFor={`installment-amount-${index}`}>Amount (paise)</Label>
                  <Input
                    id={`installment-amount-${index}`}
                    type="number"
                    min={0}
                    {...form.register(`installments.${index}.amountPaise`, { valueAsNumber: true })}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label htmlFor={`installment-due-${index}`}>Due (days)</Label>
                  <Input
                    id={`installment-due-${index}`}
                    type="number"
                    min={0}
                    {...form.register(`installments.${index}.dueOffsetDays`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                  <Trash2 aria-hidden />
                  <span className="sr-only">Remove installment</span>
                </Button>
              </div>
            ))}

            {fields.length > 0 ? (
              <p
                className={
                  unbalanced ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
                }
              >
                Installments total {formatPaise(installmentSum)} of {formatPaise(watchedTotal || 0)}
                {unbalanced ? ' — these must match before saving.' : '.'}
              </p>
            ) : null}
            {form.formState.errors.installments?.message ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.installments.message}
              </p>
            ) : null}
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create programme'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
