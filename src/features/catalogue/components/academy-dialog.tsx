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

import { createAcademy, updateAcademy } from '../actions/manage-academy';
import { slugify } from '../logic';
import { academySchema, type Academy, type AcademyInput } from '../schema';

/** S22 academy create/edit. One dialog for both — the only difference is which action runs. */
export function AcademyDialog({ academy }: { academy?: Academy }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const editing = academy !== undefined;

  const form = useForm<AcademyInput>({
    resolver: zodResolver(academySchema),
    defaultValues: {
      name: academy?.name ?? '',
      slug: academy?.slug ?? '',
      description: academy?.description ?? '',
    },
  });

  const onSubmit = async (values: AcademyInput) => {
    const outcome = editing
      ? await updateAcademy({ ...values, academyId: academy.id })
      : await createAcademy(values);

    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof AcademyInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success(editing ? 'Academy updated' : 'Academy created');
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
            New academy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit academy' : 'New academy'}</DialogTitle>
          <DialogDescription>
            An academy groups related programmes. The slug is used by the public website, so it must
            stay unique and stable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="academy-name" required>
              Name
            </Label>
            <Input
              id="academy-name"
              autoFocus
              {...form.register('name', {
                // Suggest a slug while the user hasn't set one themselves.
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                  if (!editing && !form.getValues('slug')) {
                    form.setValue('slug', slugify(event.target.value));
                  }
                },
              })}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="academy-slug" required>
              Slug
            </Label>
            <Input
              id="academy-slug"
              placeholder="gen-z-career-readiness"
              {...form.register('slug')}
            />
            {form.formState.errors.slug ? (
              <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="academy-description">Description</Label>
            <Textarea id="academy-description" {...form.register('description')} />
            {form.formState.errors.description ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create academy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
