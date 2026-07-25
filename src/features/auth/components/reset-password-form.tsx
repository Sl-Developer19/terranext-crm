'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { resetPasswordSchema, type ResetPasswordInput } from '../schema';

/**
 * Confirms a password reset via POST /api/auth/reset-password. `oobCode`
 * comes from the emailed link's query string — never typed by the user — so
 * a missing code is treated as a dead link, not a validation error on the form.
 */

interface ResetPasswordResponseBody {
  ok?: boolean;
  error?: { message?: string; fields?: Record<string, string> };
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode') ?? '';
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { oobCode, newPassword: '', confirmPassword: '' },
  });

  if (!oobCode) {
    return (
      <div role="alert" className="space-y-4 text-center">
        <p className="text-sm text-foreground">This reset link is invalid or incomplete.</p>
        <Link href="/forgot-password" className="inline-block text-sm text-gold hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: ResetPasswordInput) => {
    setFormError(null);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as ResetPasswordResponseBody | null;

      if (response.ok && body?.ok) {
        toast.success('Password reset. Sign in with your new password.');
        router.replace('/login');
        return;
      }

      if (body?.error?.fields?.newPassword) {
        form.setError('newPassword', { message: body.error.fields.newPassword });
      }
      setFormError(body?.error?.message ?? 'Something went wrong. Please try again.');
    } catch {
      setFormError('Network problem — check your connection and try again.');
    }
  };

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newPassword" required>
          New password
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={Boolean(errors.newPassword)}
          aria-describedby={errors.newPassword ? 'newPassword-error' : 'newPassword-hint'}
          {...form.register('newPassword')}
        />
        {errors.newPassword ? (
          <p id="newPassword-error" className="text-xs text-destructive">
            {errors.newPassword.message}
          </p>
        ) : (
          <p id="newPassword-hint" className="text-xs text-muted-foreground">
            At least 10 characters, including a letter and a number.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" required>
          Confirm new password
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
          {...form.register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p id="confirmPassword-error" className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      ) : null}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Reset password
      </Button>
    </form>
  );
}
