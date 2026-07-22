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

import { createCollege, updateCollege } from '../actions/manage-college';
import { collegeSchema, type College, type CollegeInput } from '../schema';

/** S15 college create/edit. One dialog for both — only the action differs. */
export function CollegeDialog({ college }: { college?: College }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const editing = college !== undefined;

  const form = useForm<CollegeInput>({
    resolver: zodResolver(collegeSchema),
    defaultValues: {
      name: college?.name ?? '',
      city: college?.city ?? '',
      contactPerson: college?.contactPerson ?? '',
      contactPhone: college?.contactPhone ?? '',
    },
  });

  const onSubmit = async (values: CollegeInput) => {
    const outcome = editing
      ? await updateCollege({ ...values, collegeId: college.id })
      : await createCollege(values);

    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof CollegeInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success(editing ? 'College updated' : 'College added');
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
            Add college
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit college' : 'Add college'}</DialogTitle>
          <DialogDescription>
            Colleges are a lead source — leads referred from here are attributed to the college,
            which is what makes college-wise reporting possible.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="college-name" required>
                Name
              </Label>
              <Input id="college-name" autoFocus {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="college-city" required>
                City
              </Label>
              <Input id="college-city" {...form.register('city')} />
              {form.formState.errors.city ? (
                <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="college-contact">Contact person</Label>
              <Input id="college-contact" {...form.register('contactPerson')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="college-phone">Contact phone</Label>
              <Input
                id="college-phone"
                placeholder="+919876543210"
                {...form.register('contactPhone')}
              />
              {form.formState.errors.contactPhone ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.contactPhone.message}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? 'Save changes' : 'Add college'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
