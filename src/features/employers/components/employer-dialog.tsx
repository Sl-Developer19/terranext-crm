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
import { Textarea } from '@/components/ui/textarea';

import { createEmployer, updateEmployer } from '../actions/manage-employer';
import { employerSchema, type Employer, type EmployerInput } from '../schema';

/** S32 employer create/edit. One dialog for both — the only difference is which action runs. */
export function EmployerDialog({ employer }: { employer?: Employer }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const editing = employer !== undefined;

  const form = useForm<EmployerInput>({
    resolver: zodResolver(employerSchema),
    defaultValues: {
      name: employer?.name ?? '',
      country: employer?.country ?? '',
      industry: employer?.industry ?? '',
      contactName: employer?.contact.name ?? '',
      contactPhone: employer?.contact.phone ?? '',
      contactEmail: employer?.contact.email ?? '',
      agreementNote: employer?.agreementNote ?? '',
    },
  });

  const onSubmit = async (values: EmployerInput) => {
    const outcome = editing
      ? await updateEmployer({ ...values, employerId: employer.id })
      : await createEmployer(values);

    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof EmployerInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success(editing ? 'Employer updated' : 'Employer created');
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
          <Button size="sm">
            <Plus aria-hidden />
            New employer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit employer' : 'New employer'}</DialogTitle>
          <DialogDescription>
            Employers receive candidates through the placements pipeline (BR-08 — no fee is ever
            charged to the student for this).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employer-name" required>
                Name
              </Label>
              <Input id="employer-name" autoFocus {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-country" required>
                Country
              </Label>
              <Input id="employer-country" {...form.register('country')} />
              {form.formState.errors.country ? (
                <p className="text-xs text-destructive">{form.formState.errors.country.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-industry">Industry</Label>
              <Input id="employer-industry" {...form.register('industry')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-contact-name">Contact name</Label>
              <Input id="employer-contact-name" {...form.register('contactName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-contact-phone">Contact phone</Label>
              <Input id="employer-contact-phone" {...form.register('contactPhone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-contact-email">Contact email</Label>
              <Input id="employer-contact-email" type="email" {...form.register('contactEmail')} />
              {form.formState.errors.contactEmail ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.contactEmail.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="employer-agreement">Agreement note</Label>
            <Textarea id="employer-agreement" {...form.register('agreementNote')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create employer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
