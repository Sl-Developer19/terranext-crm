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

import { createLeadershipLevel, updateLeadershipLevel } from '../actions/manage-leadership-level';
import {
  leadershipLevelSchema,
  type LeadershipLevelDefinition,
  type LeadershipLevelInput,
} from '../schema';

/** Add/edit form for a Growth Partner recognition tier — mirrors
 * `catalogue/components/academy-dialog.tsx`'s shape exactly. */
export function LeadershipLevelDialog({ level }: { level?: LeadershipLevelDefinition }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const editing = level !== undefined;

  const form = useForm<LeadershipLevelInput>({
    resolver: zodResolver(leadershipLevelSchema),
    defaultValues: {
      name: level?.name ?? '',
      slug: level?.slug ?? '',
      description: level?.description ?? '',
      displayOrder: level?.displayOrder ?? 0,
      badgeColor: level?.badgeColor ?? '',
      badgeIcon: level?.badgeIcon ?? '',
    },
  });

  const onSubmit = async (values: LeadershipLevelInput) => {
    const outcome = editing
      ? await updateLeadershipLevel({ ...values, levelId: level.id })
      : await createLeadershipLevel(values);

    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof LeadershipLevelInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success(editing ? 'Leadership level updated' : 'Leadership level created');
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
            New level
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit leadership level' : 'New leadership level'}</DialogTitle>
          <DialogDescription>
            Growth Partner recognition tiers — the slug is what&apos;s stored on each partner&apos;s
            record, so changing it here does not retroactively move anyone already on this level.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="level-name" required>
                Name
              </Label>
              <Input id="level-name" placeholder="Gold" {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="level-slug" required>
                Slug
              </Label>
              <Input id="level-slug" placeholder="gold" {...form.register('slug')} />
              {form.formState.errors.slug ? (
                <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="level-description">Description</Label>
            <Textarea id="level-description" {...form.register('description')} />
            {form.formState.errors.description ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="level-order" required>
                Display order
              </Label>
              <Input
                id="level-order"
                type="number"
                min={0}
                {...form.register('displayOrder', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">Lower is the entry-level tier.</p>
              {form.formState.errors.displayOrder ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.displayOrder.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="level-icon">Badge icon</Label>
              <Input id="level-icon" placeholder="award" {...form.register('badgeIcon')} />
              <p className="text-xs text-muted-foreground">A lucide.dev icon name.</p>
              {form.formState.errors.badgeIcon ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.badgeIcon.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="level-color">Badge colour</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="level-color"
                  type="color"
                  className="h-10 w-12 p-1"
                  value={form.watch('badgeColor') || '#C9A227'}
                  onChange={(event) => form.setValue('badgeColor', event.target.value)}
                />
                <Input placeholder="#C9A227" {...form.register('badgeColor')} />
              </div>
              {form.formState.errors.badgeColor ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.badgeColor.message}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create level'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
