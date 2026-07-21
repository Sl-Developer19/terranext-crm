'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { EmployerOption } from '@/features/employers';
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

import { createPlacement } from '../actions/manage-placement';
import { createPlacementSchema, type CreatePlacementInput } from '../schema';

/** S31 — open a placement for a career-eligible participant (BR-09 gate is server-enforced). */
export function CreatePlacementDialog({ employers }: { employers: EmployerOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CreatePlacementInput>({
    resolver: zodResolver(createPlacementSchema),
    defaultValues: {
      participantId: '',
      employerId: '',
      jobCategory: '',
      country: '',
      thirdPartyNotes: '',
    },
  });

  const onSubmit = async (values: CreatePlacementInput) => {
    const outcome = await createPlacement(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof CreatePlacementInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Placement created');
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
          New placement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New placement</DialogTitle>
          <DialogDescription>
            Only career profiles a placement officer has marked eligible can enter the pipeline
            (BR-09). TerraNext charges no placement fee to the student (BR-08).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="placement-participant-id" required>
              Participant ID
            </Label>
            <Input
              id="placement-participant-id"
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
            <Label htmlFor="placement-employer" required>
              Employer
            </Label>
            <Select onValueChange={(v) => form.setValue('employerId', v)}>
              <SelectTrigger id="placement-employer">
                <SelectValue placeholder="Select an employer" />
              </SelectTrigger>
              <SelectContent>
                {employers.map((employer) => (
                  <SelectItem key={employer.id} value={employer.id}>
                    {employer.name} · {employer.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.employerId ? (
              <p className="text-xs text-destructive">{form.formState.errors.employerId.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="placement-job-category" required>
                Job category
              </Label>
              <Input id="placement-job-category" {...form.register('jobCategory')} />
              {form.formState.errors.jobCategory ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.jobCategory.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="placement-country" required>
                Country
              </Label>
              <Input id="placement-country" {...form.register('country')} />
              {form.formState.errors.country ? (
                <p className="text-xs text-destructive">{form.formState.errors.country.message}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="placement-third-party-notes">Third-party cost disclosure</Label>
            <Textarea
              id="placement-third-party-notes"
              placeholder="e.g. visa and travel costs borne by the candidate"
              {...form.register('thirdPartyNotes')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Create placement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
