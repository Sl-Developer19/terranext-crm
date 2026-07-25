'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy, UserPlus } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
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
import { STAFF_ROLE_LABELS } from '@/lib/rbac/role-labels';
import { STAFF_ROLES } from '@/types/common';

import { provisionUser, type ProvisionUserResult } from '../actions/provision-user';
import { provisionUserSchema, type ProvisionUserInput } from '../schema';

/**
 * S50 provisioning flow (Doc 16). A welcome email with a password-reset
 * link is sent automatically (Doc 10 §1 extension). The link is also shown
 * here once, as a fallback the admin can share directly if delivery fails
 * or no email provider is configured — matching scripts/bootstrap-admin.mjs.
 */
export function InviteUserDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<ProvisionUserResult | null>(null);
  const [copied, setCopied] = React.useState(false);

  const form = useForm<ProvisionUserInput>({
    resolver: zodResolver(provisionUserSchema),
    defaultValues: { email: '', displayName: '', phone: '', role: 'trainer', assignedBatchIds: [] },
  });

  const reset = () => {
    form.reset();
    setResult(null);
    setCopied(false);
  };

  const onSubmit = async (values: ProvisionUserInput) => {
    setPending(true);
    try {
      const outcome = await provisionUser(values);
      if (!outcome.ok) {
        if (outcome.error.code === 'validation' && outcome.error.fields) {
          for (const [field, message] of Object.entries(outcome.error.fields)) {
            form.setError(field as keyof ProvisionUserInput, { message });
          }
        } else {
          toast.error(outcome.error.message);
        }
        return;
      }
      setResult(outcome.data);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const copyLink = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.resetLink);
    setCopied(true);
    toast.success('Reset link copied');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden />
          Invite staff member
        </Button>
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Account created</DialogTitle>
              <DialogDescription>
                A welcome email with this password-reset link has been sent to the new staff member.
                It expires in about an hour — this is the only time it will be shown here, so copy
                it now if you would rather share it directly.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-2">
              <code className="flex-1 truncate text-xs">{result.resetLink}</code>
              <Button type="button" variant="outline" size="icon" onClick={copyLink}>
                {copied ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                <span className="sr-only">Copy link</span>
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite staff member</DialogTitle>
              <DialogDescription>
                Creates an account and assigns a role. There is no self-registration — every account
                is provisioned here (Doc 10 §1).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName" required>
                  Full name
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
                <Label htmlFor="role" required>
                  Role
                </Label>
                <Select
                  defaultValue={form.getValues('role')}
                  onValueChange={(value) =>
                    form.setValue('role', value as ProvisionUserInput['role'])
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {STAFF_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  Create account
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
