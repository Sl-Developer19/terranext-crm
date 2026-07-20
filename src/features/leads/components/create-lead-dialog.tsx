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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { createLead } from '../actions/create-lead';
import { LEAD_SOURCES, createLeadSchema, type CreateLeadInput } from '../schema';

const SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
  website: 'Website',
  campaign: 'Campaign',
  referral: 'Referral',
  college: 'College',
  'walk-in': 'Walk-in',
  social: 'Social media',
};

/** S10 create flow (Doc 16). Website-sourced leads arrive via createLead
 * Function, not here — this dialog is for staff-entered leads. */
export function CreateLeadDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      source: 'walk-in',
      programmeInterest: '',
      consentGiven: undefined as unknown as true,
    },
  });

  const onSubmit = async (values: CreateLeadInput) => {
    setPending(true);
    try {
      const outcome = await createLead(values);
      if (!outcome.ok) {
        if (outcome.error.code === 'validation' && outcome.error.fields) {
          for (const [field, message] of Object.entries(outcome.error.fields)) {
            form.setError(field as keyof CreateLeadInput, { message });
          }
        } else {
          toast.error(outcome.error.message);
        }
        return;
      }
      if (outcome.data.possibleDuplicate) {
        toast.warning('Lead created — a lead with this phone number already exists.');
      } else {
        toast.success('Lead created');
      }
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
          New lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>
            Consent is required on every lead record, regardless of source.
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
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="source" required>
              Source
            </Label>
            <Select
              defaultValue={form.getValues('source')}
              onValueChange={(value) => form.setValue('source', value as CreateLeadInput['source'])}
            >
              <SelectTrigger id="source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {SOURCE_LABELS[source]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="programmeInterest">Programme interest</Label>
            <Input
              id="programmeInterest"
              placeholder="e.g. Gen Z Career Readiness"
              {...form.register('programmeInterest')}
            />
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
              Create lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
