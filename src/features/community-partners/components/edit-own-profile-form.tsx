'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { updateOwnCommunityProfile } from '../actions/update-own-profile';
import { updateOwnCommunityProfileSchema, type UpdateOwnCommunityProfileInput } from '../schema';
import type { CommunityPartner } from '../schema';

/** A Community Partner editing their own profile — mirrors
 * `growth-partners/components/edit-own-profile-form.tsx` (ADR-014). */
export function EditOwnProfileForm({ partner }: { partner: CommunityPartner }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const form = useForm<UpdateOwnCommunityProfileInput>({
    resolver: zodResolver(updateOwnCommunityProfileSchema),
    defaultValues: {
      orgName: partner.orgName,
      contactName: partner.contactName,
      phone: partner.phone,
    },
  });

  const onSubmit = async (values: UpdateOwnCommunityProfileInput) => {
    setPending(true);
    try {
      const outcome = await updateOwnCommunityProfile(values);
      if (!outcome.ok) {
        if (outcome.error.code === 'validation' && outcome.error.fields) {
          for (const [field, message] of Object.entries(outcome.error.fields)) {
            form.setError(field as keyof UpdateOwnCommunityProfileInput, { message });
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
        <Label htmlFor="orgName" required>
          Business name
        </Label>
        <Input id="orgName" {...form.register('orgName')} />
        {form.formState.errors.orgName ? (
          <p className="text-xs text-destructive">{form.formState.errors.orgName.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactName" required>
          Contact person
        </Label>
        <Input id="contactName" {...form.register('contactName')} />
        {form.formState.errors.contactName ? (
          <p className="text-xs text-destructive">{form.formState.errors.contactName.message}</p>
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
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
