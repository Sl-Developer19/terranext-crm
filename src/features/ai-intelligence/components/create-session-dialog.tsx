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

import { createSession } from '../actions/create-session';
import { createSessionSchema, type CreateSessionInput } from '../schema';

interface Option {
  id: string;
  label: string;
}

/** "Create Session" — the workflow's first step, before recording ever starts. */
export function CreateSessionDialog({
  batches,
  programmes,
}: {
  batches: Option[];
  programmes: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CreateSessionInput>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: { title: '', batchId: '', programmeId: '', deviceLabel: '' },
  });

  const onSubmit = async (values: CreateSessionInput) => {
    const outcome = await createSession(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof CreateSessionInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Session created — ready to record');
    setOpen(false);
    form.reset();
    router.push(`/ai/session/${outcome.data.sessionId}`);
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
          Create session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create session</DialogTitle>
          <DialogDescription>
            Name the session, then start recording — upload, transcription, and AI analysis run
            automatically once you stop.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-title" required>
              Title
            </Label>
            <Input
              id="session-title"
              placeholder="e.g. Batch A — Module 3, Session 2"
              {...form.register('title')}
            />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-batch">Batch</Label>
              <Controller
                control={form.control}
                name="batchId"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger id="session-batch">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-programme">Programme</Label>
              <Controller
                control={form.control}
                name="programmeId"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger id="session-programme">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {programmes.map((programme) => (
                        <SelectItem key={programme.id} value={programme.id}>
                          {programme.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Create session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
