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
      displayOrder: academy?.displayOrder ?? 0,
      icon: academy?.icon ?? '',
      themeColor: academy?.themeColor ?? '',
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
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="academy-display-order" required>
                Display order
              </Label>
              <Input
                id="academy-display-order"
                type="number"
                min={0}
                {...form.register('displayOrder', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">Lower shows first.</p>
              {form.formState.errors.displayOrder ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.displayOrder.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="academy-icon">Icon</Label>
              <Input id="academy-icon" placeholder="graduation-cap" {...form.register('icon')} />
              <p className="text-xs text-muted-foreground">A lucide.dev icon name.</p>
              {form.formState.errors.icon ? (
                <p className="text-xs text-destructive">{form.formState.errors.icon.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="academy-color">Theme colour</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="academy-color"
                  type="color"
                  className="h-10 w-12 p-1"
                  value={form.watch('themeColor') || '#0D6B4E'}
                  onChange={(event) => form.setValue('themeColor', event.target.value)}
                />
                <Input placeholder="#0D6B4E" {...form.register('themeColor')} />
              </div>
              {form.formState.errors.themeColor ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.themeColor.message}
                </p>
              ) : null}
            </div>
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
