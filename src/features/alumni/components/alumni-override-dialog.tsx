'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldAlert } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

import { createAlumniOverride } from '../actions/manage-alumni';
import { createAlumniOverrideSchema, type CreateAlumniOverrideInput } from '../schema';

/** BR-05 manual override — system_admin only, always audited with a reason. */
export function AlumniOverrideDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CreateAlumniOverrideInput>({
    resolver: zodResolver(createAlumniOverrideSchema),
    defaultValues: { participantId: '', reason: '' },
  });

  const onSubmit = async (values: CreateAlumniOverrideInput) => {
    const outcome = await createAlumniOverride(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof CreateAlumniOverrideInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Alumni status granted');
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
        <Button variant="outline" size="sm">
          <ShieldAlert aria-hidden />
          Manual override
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual alumni grant</DialogTitle>
          <DialogDescription>
            Alumni status is normally granted automatically on certification (BR-05). Use this only
            for the rare exception — the reason is permanently audited.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="override-participant-id" required>
              Participant ID
            </Label>
            <Input
              id="override-participant-id"
              placeholder="TNX-2026-00042"
              {...form.register('participantId')}
            />
            {form.formState.errors.participantId ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.participantId.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="override-reason" required>
              Reason
            </Label>
            <Textarea id="override-reason" {...form.register('reason')} />
            {form.formState.errors.reason ? (
              <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Grant alumni status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
