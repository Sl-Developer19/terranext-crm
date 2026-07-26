'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { updateOwnProfile } from '../actions/update-own-profile';
import { updateOwnProfileSchema, type UpdateOwnProfileInput } from '../schema';
import type { GrowthPartner } from '../schema';

/** Doc 25 §6 — a partner editing their own profile. */
export function EditOwnProfileForm({ partner }: { partner: GrowthPartner }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const form = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(updateOwnProfileSchema),
    defaultValues: {
      displayName: partner.displayName,
      phone: partner.phone,
      organizationName: partner.organizationName ?? '',
    },
  });

  const onSubmit = async (values: UpdateOwnProfileInput) => {
    setPending(true);
    try {
      const outcome = await updateOwnProfile(values);
      if (!outcome.ok) {
        if (outcome.error.code === 'validation' && outcome.error.fields) {
          for (const [field, message] of Object.entries(outcome.error.fields)) {
            form.setError(field as keyof UpdateOwnProfileInput, { message });
          }
        } else {
          toast.error(outcome.error.message);
        }
        return;
      }
      toast.success('Profile updated');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName" required>
          Name
        </Label>
        <Input id="displayName" {...form.register('displayName')} />
        {form.formState.errors.displayName ? (
          <p className="text-xs text-destructive">{form.formState.errors.displayName.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone" required>
          Phone
        </Label>
        <Input id="phone" {...form.register('phone')} />
        {form.formState.errors.phone ? (
          <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="organizationName">Organisation</Label>
        <Input id="organizationName" {...form.register('organizationName')} />
      </div>
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
