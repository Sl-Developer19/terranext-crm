'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
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

import { updateTemplateMetaAction } from '../actions/manage-template';
import {
  updateTemplateMetaSchema,
  type CertificateTemplate,
  type UpdateTemplateMetaInput,
} from '../schema';

const NONE = '__none__';

export function EditTemplateMetaDialog({
  template,
  academies,
  programmes,
}: {
  template: CertificateTemplate;
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
    formState: { errors, isSubmitting },
  } = useForm<UpdateTemplateMetaInput>({
    resolver: zodResolver(updateTemplateMetaSchema),
    defaultValues: {
      templateId: template.id,
      name: template.name,
      description: template.description,
      academyId: template.academyId,
      programmeId: template.programmeId,
    },
  });

  const academyId = watch('academyId');
  const programmeId = watch('programmeId');

  async function onSubmit(data: UpdateTemplateMetaInput) {
    const result = await updateTemplateMetaAction(data);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Template updated.');
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil aria-hidden />
          Edit details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Template Details</DialogTitle>
          <DialogDescription>
            Name, description, and academy/programme assignment. Does not affect artwork, fields, or
            version history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-template-name" required>
              Template name
            </Label>
            <Input id="edit-template-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-template-description">Description</Label>
            <Textarea id="edit-template-description" {...register('description')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-template-academy">Academy</Label>
              <Select
                value={academyId ?? NONE}
                onValueChange={(value) =>
                  setValue('academyId', value === NONE ? null : value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="edit-template-academy">
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
              <Label htmlFor="edit-template-programme">Programme</Label>
              <Select
                value={programmeId ?? NONE}
                onValueChange={(value) =>
                  setValue('programmeId', value === NONE ? null : value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="edit-template-programme">
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
          {errors.programmeId && (
            <p className="text-xs text-destructive">{errors.programmeId.message}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
