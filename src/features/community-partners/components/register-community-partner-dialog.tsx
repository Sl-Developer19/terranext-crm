'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
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

import { registerCommunityPartner } from '../actions/register-community-partner';
import {
  BUSINESS_CATEGORIES,
  registerCommunityPartnerSchema,
  type RegisterCommunityPartnerInput,
} from '../schema';
import { BUSINESS_CATEGORY_LABELS } from '../status-labels';

/** Growth Community Business — staff-entry registration. Mirrors
 * `RegisterGrowthPartnerDialog` exactly, posting to `registerCommunityPartner`
 * (a distinct action writing to `communityPartners`, never `growthPartners`). */
export function RegisterCommunityPartnerDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<RegisterCommunityPartnerInput>({
    resolver: zodResolver(registerCommunityPartnerSchema),
    defaultValues: {
      orgName: '',
      // A concrete default, not left unset — same convention as every other
      // enum Select in this codebase (e.g. `SessionFormDialog`'s
      // `mode: 'in_person'`); staff can still change it before submitting.
      businessCategory: BUSINESS_CATEGORIES[0],
      contactName: '',
      email: '',
      phone: '',
    },
  });

  const onSubmit = async (values: RegisterCommunityPartnerInput) => {
    setPending(true);
    try {
      const outcome = await registerCommunityPartner(values);
      if (!outcome.ok) {
        if (outcome.error.code === 'validation' && outcome.error.fields) {
          for (const [field, message] of Object.entries(outcome.error.fields)) {
            form.setError(field as keyof RegisterCommunityPartnerInput, { message });
          }
        } else {
          toast.error(outcome.error.message);
        }
        return;
      }
      toast.success('Community Partner registered — pending approval');
      setOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setPending(false);
    }
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
          <Building2 aria-hidden />
          Register business
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a Community Business</DialogTitle>
          <DialogDescription>
            The business is created as pending approval — no login exists until approved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-orgName" required>
              Organization name
            </Label>
            <Input id="cp-orgName" autoFocus {...form.register('orgName')} />
            {form.formState.errors.orgName ? (
              <p className="text-xs text-destructive">{form.formState.errors.orgName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-category" required>
              Business category
            </Label>
            <Controller
              control={form.control}
              name="businessCategory"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="cp-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {BUSINESS_CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.businessCategory ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.businessCategory.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-contactName" required>
              Contact person
            </Label>
            <Input id="cp-contactName" {...form.register('contactName')} />
            {form.formState.errors.contactName ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.contactName.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-email" required>
              Email
            </Label>
            <Input id="cp-email" type="email" {...form.register('email')} />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-phone" required>
              Phone
            </Label>
            <Input id="cp-phone" placeholder="+919876543210" {...form.register('phone')} />
            {form.formState.errors.phone ? (
              <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Register
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
