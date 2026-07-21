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

import { createFamily } from '../actions/manage-family';
import {
  FAMILY_SOURCES,
  PARENT_RELATIONS,
  createFamilySchema,
  type CreateFamilyInput,
  type ParentRelation,
} from '../schema';
import { FAMILY_SOURCE_LABELS } from './families-table';

export const RELATION_LABELS: Record<ParentRelation, string> = {
  mother: 'Mother',
  father: 'Father',
  guardian: 'Guardian',
  other: 'Other',
};

/** Creates a household. The primary contact becomes its first parent record. */
export function CreateFamilyDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CreateFamilyInput>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: {
      familyName: '',
      primaryContactName: '',
      primaryContactPhone: '',
      primaryContactEmail: '',
      relation: 'mother',
      source: 'direct_enquiry',
      address: '',
      notes: '',
    },
  });

  const onSubmit = async (values: CreateFamilyInput) => {
    const outcome = await createFamily(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof CreateFamilyInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Family record created');
    setOpen(false);
    form.reset();
    router.push(`/parents/${outcome.data.id}`);
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
          New family
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New family</DialogTitle>
          <DialogDescription>
            The household is the record — parents and participants both hang off it, so a sibling’s
            history is visible from the same place.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="familyName" required>
              Family name
            </Label>
            <Input
              id="familyName"
              autoFocus
              placeholder="Sharma"
              {...form.register('familyName')}
            />
            {form.formState.errors.familyName ? (
              <p className="text-xs text-destructive">{form.formState.errors.familyName.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryContactName" required>
                Primary contact
              </Label>
              <Input id="primaryContactName" {...form.register('primaryContactName')} />
              {form.formState.errors.primaryContactName ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.primaryContactName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="relation" required>
                Relation
              </Label>
              <Select
                defaultValue="mother"
                onValueChange={(v) => form.setValue('relation', v as ParentRelation)}
              >
                <SelectTrigger id="relation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARENT_RELATIONS.map((relation) => (
                    <SelectItem key={relation} value={relation}>
                      {RELATION_LABELS[relation]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryContactPhone" required>
                Phone
              </Label>
              <Input
                id="primaryContactPhone"
                placeholder="+919876543210"
                {...form.register('primaryContactPhone')}
              />
              {form.formState.errors.primaryContactPhone ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.primaryContactPhone.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryContactEmail">Email</Label>
              <Input
                id="primaryContactEmail"
                type="email"
                {...form.register('primaryContactEmail')}
              />
              {form.formState.errors.primaryContactEmail ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.primaryContactEmail.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="source" required>
                Source
              </Label>
              <Select
                defaultValue="direct_enquiry"
                onValueChange={(v) => form.setValue('source', v as CreateFamilyInput['source'])}
              >
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {FAMILY_SOURCE_LABELS[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...form.register('address')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Create family
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
