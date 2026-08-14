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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Academy, ProgrammeOption } from '@/features/catalogue';

import { createTemplateAction } from '../actions/manage-template';
import { createTemplateSchema, type CreateTemplateInput } from '../schema';

const NONE = '__none__';

export function CreateTemplateDialog({
  academies,
  programmes,
}: {
  academies: Academy[];
  programmes: ProgrammeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: { name: '', description: '', academyId: null, programmeId: null },
  });

  const academyId = watch('academyId');
  const programmeId = watch('programmeId');

  async function onSubmit(data: CreateTemplateInput) {
    const result = await createTemplateAction(data);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Template created as a draft.');
    setOpen(false);
    reset();
    router.push(`/admin/settings/certificate-templates/${result.data.templateId}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Create Template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Certificate Template</DialogTitle>
          <DialogDescription>
            Starts as a draft — upload artwork and map fields next. Nothing here can be used to
            issue certificates until it is approved and activated.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name" required>
              Template name
            </Label>
            <Input id="template-name" {...register('name')} placeholder="e.g. NextGen Classic" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              {...register('description')}
              placeholder="Optional notes"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-academy">Academy</Label>
              <Select
                value={academyId ?? NONE}
                onValueChange={(value) =>
                  setValue('academyId', value === NONE ? null : value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="template-academy">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {academies.map((academy) => (
                    <SelectItem key={academy.id} value={academy.id}>
                      {academy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-programme">Programme</Label>
              <Select
                value={programmeId ?? NONE}
                onValueChange={(value) =>
                  setValue('programmeId', value === NONE ? null : value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="template-programme">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {programmes.map((programme) => (
                    <SelectItem key={programme.id} value={programme.id}>
                      {programme.name} ({programme.academyName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Assign to a programme for a programme-specific certificate, or to an academy only as a
            fallback used when a programme has no template of its own. At least one is required.
          </p>
          {errors.programmeId && (
            <p className="text-xs text-destructive">{errors.programmeId.message}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
