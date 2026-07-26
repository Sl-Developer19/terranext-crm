'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
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

import { registerGrowthPartner } from '../actions/register-growth-partner';
import { registerGrowthPartnerSchema, type RegisterGrowthPartnerInput } from '../schema';

/** Doc 25 §4 step 1 — registration only; approval mints the login (separate action). */
export function RegisterGrowthPartnerDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<RegisterGrowthPartnerInput>({
    resolver: zodResolver(registerGrowthPartnerSchema),
    defaultValues: { displayName: '', email: '', phone: '', organizationName: '' },
  });

  const onSubmit = async (values: RegisterGrowthPartnerInput) => {
    setPending(true);
    try {
      const outcome = await registerGrowthPartner(values);
      if (!outcome.ok) {
        if (outcome.error.code === 'validation' && outcome.error.fields) {
          for (const [field, message] of Object.entries(outcome.error.fields)) {
            form.setError(field as keyof RegisterGrowthPartnerInput, { message });
          }
        } else {
          toast.error(outcome.error.message);
        }
        return;
      }
      toast.success('Growth Partner registered — pending approval');
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
          <UserPlus aria-hidden />
          Register partner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a Growth Partner</DialogTitle>
          <DialogDescription>
            The partner is created as pending approval — no login exists until approved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName" required>
              Name
            </Label>
            <Input id="displayName" autoFocus {...form.register('displayName')} />
            {form.formState.errors.displayName ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.displayName.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" required>
              Phone
            </Label>
            <Input id="phone" placeholder="+919876543210" {...form.register('phone')} />
            {form.formState.errors.phone ? (
              <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organisation</Label>
            <Input id="organizationName" {...form.register('organizationName')} />
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
