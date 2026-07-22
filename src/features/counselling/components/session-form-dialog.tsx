'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
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

import { recordSession } from '../actions/record-session';
import {
  recordSessionSchema,
  SESSION_MODE_LABELS,
  SESSION_MODES,
  SESSION_OUTCOME_LABELS,
  SESSION_OUTCOMES,
  type CounsellingLeadOption,
  type RecordSessionInput,
} from '../schema';

interface ProgrammeOption {
  id: string;
  name: string;
}

/** S12 `CounsellingSessionForm` (Doc 16): notes, needs, recommendation, outcome. */
export function SessionFormDialog({
  leads,
  programmes,
}: {
  leads: CounsellingLeadOption[];
  programmes: ProgrammeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<RecordSessionInput>({
    resolver: zodResolver(recordSessionSchema),
    defaultValues: {
      leadId: '',
      heldAt: '',
      mode: 'in_person',
      outcome: 'follow_up',
      notes: '',
      needsAssessment: '',
      recommendedProgrammeId: '',
      recommendationRemarks: '',
    },
  });

  const outcome = form.watch('outcome');
  const recommending = outcome === 'recommended';

  const onSubmit = async (values: RecordSessionInput) => {
    const outcomeResult = await recordSession(values);
    if (!outcomeResult.ok) {
      if (outcomeResult.error.code === 'validation' && outcomeResult.error.fields) {
        for (const [key, message] of Object.entries(outcomeResult.error.fields)) {
          form.setError(key as keyof RecordSessionInput, { message });
        }
      } else {
        toast.error(outcomeResult.error.message);
      }
      return;
    }
    toast.success('Counselling session recorded');
    setOpen(false);
    form.reset();
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden />
          Record session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record counselling session</DialogTitle>
          <DialogDescription>
            A lead can only be admitted on the back of a session that recommended them and named a
            programme (BR-02).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-lead" required>
              Lead
            </Label>
            <Controller
              control={form.control}
              name="leadId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="session-lead">
                    <SelectValue placeholder="Select a lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.leadId ? (
              <p className="text-xs text-destructive">{form.formState.errors.leadId.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-held-at" required>
                Held at
              </Label>
              <Input id="session-held-at" type="datetime-local" {...form.register('heldAt')} />
              {form.formState.errors.heldAt ? (
                <p className="text-xs text-destructive">{form.formState.errors.heldAt.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-mode" required>
                Mode
              </Label>
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="session-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_MODES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {SESSION_MODE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-notes" required>
              Notes
            </Label>
            <Textarea id="session-notes" rows={4} {...form.register('notes')} />
            {form.formState.errors.notes ? (
              <p className="text-xs text-destructive">{form.formState.errors.notes.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-needs">Needs assessment</Label>
            <Textarea id="session-needs" rows={3} {...form.register('needsAssessment')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-outcome" required>
              Outcome
            </Label>
            <Controller
              control={form.control}
              name="outcome"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="session-outcome">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_OUTCOMES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SESSION_OUTCOME_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Recommendation is only meaningful — and only required — when the
              outcome actually recommends the lead (BR-02). */}
          {recommending ? (
            <div className="space-y-4 rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">
                A recommended outcome must name the programme. This snapshot is copied onto the
                enrolment at conversion.
              </p>
              <div className="space-y-2">
                <Label htmlFor="session-programme" required>
                  Recommended programme
                </Label>
                <Controller
                  control={form.control}
                  name="recommendedProgrammeId"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="session-programme">
                        <SelectValue placeholder="Select a programme" />
                      </SelectTrigger>
                      <SelectContent>
                        {programmes.map((programme) => (
                          <SelectItem key={programme.id} value={programme.id}>
                            {programme.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.recommendedProgrammeId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.recommendedProgrammeId.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-remarks">Recommendation remarks</Label>
                <Textarea
                  id="session-remarks"
                  rows={3}
                  {...form.register('recommendationRemarks')}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Record session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
