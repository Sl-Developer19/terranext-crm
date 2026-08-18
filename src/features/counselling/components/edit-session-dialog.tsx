'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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

import { updateSession } from '../actions/update-session';
import {
  SESSION_MODE_LABELS,
  SESSION_MODES,
  SESSION_OUTCOME_LABELS,
  SESSION_OUTCOMES,
  updateSessionSchema,
  type CounsellingSession,
  type UpdateSessionInput,
} from '../schema';

interface ProgrammeOption {
  id: string;
  name: string;
}

/** ISO timestamp → `datetime-local` input value, in the browser's own
 * timezone (the input has no timezone of its own, so this must match how
 * the browser will interpret what the user sees, not a UTC re-encoding). */
function toDatetimeLocalValue(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultsFor(session: CounsellingSession): UpdateSessionInput {
  return {
    sessionId: session.id,
    heldAt: toDatetimeLocalValue(session.heldAt),
    mode: session.mode,
    outcome: session.outcome,
    notes: session.notes,
    needsAssessment: session.needsAssessment ?? '',
    recommendedProgrammeId: session.recommendation?.programmeId ?? '',
    recommendationRemarks: session.recommendation?.remarks ?? '',
  };
}

/**
 * Edits an existing counselling session in place — the same field set as
 * `SessionFormDialog` (Doc 16 S12), minus the lead selector, since
 * reassigning which lead a session belongs to is out of scope. Calls
 * `updateSession` (never `recordSession`), so no duplicate session is ever
 * created and the record's id/createdAt/createdBy are preserved.
 */
export function EditSessionDialog({
  session,
  programmes,
  open,
  onOpenChange,
}: {
  session: CounsellingSession;
  programmes: ProgrammeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const form = useForm<UpdateSessionInput>({
    resolver: zodResolver(updateSessionSchema),
    defaultValues: defaultsFor(session),
  });

  // The dialog is one shared instance reused across every row in the Held
  // table — it doesn't remount when a different row's Edit button is
  // clicked, so the form must be re-primed explicitly whenever it opens.
  React.useEffect(() => {
    if (open) form.reset(defaultsFor(session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session.id]);

  const outcome = form.watch('outcome');
  const recommending = outcome === 'recommended';

  const onSubmit = async (values: UpdateSessionInput) => {
    const outcomeResult = await updateSession(values);
    if (!outcomeResult.ok) {
      if (outcomeResult.error.code === 'validation' && outcomeResult.error.fields) {
        for (const [key, message] of Object.entries(outcomeResult.error.fields)) {
          form.setError(key as keyof UpdateSessionInput, { message });
        }
      } else {
        toast.error(outcomeResult.error.message);
      }
      return;
    }
    toast.success('Counselling session updated');
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit counselling session</DialogTitle>
          <DialogDescription>
            Editing the session for <strong>{session.leadName}</strong>. Changing the outcome to
            &ldquo;Recommended&rdquo; with a programme named satisfies BR-02 immediately — the lead
            becomes admission-eligible as soon as you save.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-session-held-at" required>
                Held at
              </Label>
              <Input id="edit-session-held-at" type="datetime-local" {...form.register('heldAt')} />
              {form.formState.errors.heldAt ? (
                <p className="text-xs text-destructive">{form.formState.errors.heldAt.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-session-mode" required>
                Mode
              </Label>
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="edit-session-mode">
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
            <Label htmlFor="edit-session-notes" required>
              Notes
            </Label>
            <Textarea id="edit-session-notes" rows={4} {...form.register('notes')} />
            {form.formState.errors.notes ? (
              <p className="text-xs text-destructive">{form.formState.errors.notes.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-session-needs">Needs assessment</Label>
            <Textarea id="edit-session-needs" rows={3} {...form.register('needsAssessment')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-session-outcome" required>
              Outcome
            </Label>
            <Controller
              control={form.control}
              name="outcome"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-session-outcome">
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

          {recommending ? (
            <div className="space-y-4 rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">
                A recommended outcome must name the programme. This snapshot is copied onto the
                enrolment at conversion.
              </p>
              <div className="space-y-2">
                <Label htmlFor="edit-session-programme" required>
                  Recommended programme
                </Label>
                <Controller
                  control={form.control}
                  name="recommendedProgrammeId"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="edit-session-programme">
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
                <Label htmlFor="edit-session-remarks">Recommendation remarks</Label>
                <Textarea
                  id="edit-session-remarks"
                  rows={3}
                  {...form.register('recommendationRemarks')}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
