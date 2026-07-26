'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles } from 'lucide-react';
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

import { createPartnerLead } from '../actions/create-partner-lead';
import { createPartnerLeadSchema, type CreatePartnerLeadInput } from '../schema';

/** Doc 25 §4 — a Growth Partner submitting a referral. */
export function CreatePartnerLeadDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<CreatePartnerLeadInput>({
    resolver: zodResolver(createPartnerLeadSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      programmeInterest: '',
      consentGiven: undefined as unknown as true,
    },
  });

  const onSubmit = async (values: CreatePartnerLeadInput) => {
    setPending(true);
    try {
      const outcome = await createPartnerLead(values);
      if (!outcome.ok) {
        if (outcome.error.code === 'validation' && outcome.error.fields) {
          for (const [field, message] of Object.entries(outcome.error.fields)) {
            form.setError(field as keyof CreatePartnerLeadInput, { message });
          }
        } else {
          toast.error(outcome.error.message);
        }
        return;
      }
      toast.success('Referral submitted');
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
          <Sparkles aria-hidden />
          Refer a lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refer a lead</DialogTitle>
          <DialogDescription>
            Consent is required — the lead must have agreed to be contacted.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" required>
              Name
            </Label>
            <Input id="name" autoFocus {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
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
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register('email')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="programmeInterest">Programme interest</Label>
            <Input id="programmeInterest" {...form.register('programmeInterest')} />
          </div>
          <div className="flex items-start gap-2">
            <input
              id="consentGiven"
              type="checkbox"
              className="mt-1"
              onChange={(e) => form.setValue('consentGiven', e.target.checked as true)}
            />
            <Label htmlFor="consentGiven" className="font-normal">
              The lead has consented to being contacted and their data being recorded.
            </Label>
          </div>
          {form.formState.errors.consentGiven ? (
            <p className="text-xs text-destructive">{form.formState.errors.consentGiven.message}</p>
          ) : null}
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
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
