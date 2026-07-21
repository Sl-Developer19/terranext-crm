'use client';

import { formatDistanceToNow } from 'date-fns';
import { History } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { addParticipantNote } from '../actions/add-participant-note';
import type { TimelineEntry } from '../schema';

const TYPE_LABELS: Record<string, string> = {
  participant_created: 'Created',
  status_change: 'Status change',
  enrolment_added: 'Enrolment',
  enrolment_updated: 'Enrolment',
  note: 'Note',
};

/**
 * S21 Timeline tab — the consolidated lifecycle view (FR-03). Append-only by
 * design: entries can be added but never edited or removed, which is what
 * makes the history worth reading.
 */
export function ParticipantTimeline({
  participantId,
  entries,
  canUpdate,
}: {
  participantId: string;
  entries: TimelineEntry[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const form = useForm<{ summary: string }>({ defaultValues: { summary: '' } });

  const onSubmit = async ({ summary }: { summary: string }) => {
    const outcome = await addParticipantNote({ participantId, summary });
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields?.summary) {
        form.setError('summary', { message: outcome.error.fields.summary });
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Note added');
    form.reset({ summary: '' });
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes &amp; timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {canUpdate ? (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-3 rounded-md border p-4"
          >
            <div className="space-y-2">
              <Label htmlFor="timeline-note" required>
                Add a note
              </Label>
              <Textarea
                id="timeline-note"
                placeholder="What should the next person reading this record know?"
                {...form.register('summary', { required: 'Enter a note' })}
              />
              {form.formState.errors.summary ? (
                <p className="text-xs text-destructive">{form.formState.errors.summary.message}</p>
              ) : null}
            </div>
            <Button type="submit" size="sm" loading={form.formState.isSubmitting}>
              Add note
            </Button>
          </form>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState
            icon={History}
            headline="No timeline entries yet"
            explanation="Status changes, enrolments, and notes are recorded here automatically."
          />
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.id} className="border-l-2 pl-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {TYPE_LABELS[entry.type] ?? entry.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.at ? formatDistanceToNow(new Date(entry.at), { addSuffix: true }) : ''}
                  </span>
                </div>
                <p className="mt-1 text-sm">{entry.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">by {entry.byName}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
