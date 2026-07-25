'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { forgotPasswordSchema, type ForgotPasswordInput } from '../schema';

/**
 * Requests a password-reset email via POST /api/auth/forgot-password. The
 * server's response is deliberately generic regardless of outcome
 * (enumeration resistance, Doc 10 §1 extension) — this form shows the same
 * success state on every successful submit and never distinguishes "no such
 * account" from "email sent".
 */

interface ForgotPasswordResponseBody {
  ok?: boolean;
  error?: { message?: string };
}

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setFormError(null);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as ForgotPasswordResponseBody | null;
      if (response.ok && body?.ok) {
        setSubmitted(true);
        return;
      }
      setFormError(body?.error?.message ?? 'Something went wrong. Please try again.');
    } catch {
      setFormError('Network problem — check your connection and try again.');
    }
  };

  const { errors, isSubmitting } = form.formState;

  if (submitted) {
    return (
      <div role="status" className="space-y-4 text-center">
        <p className="text-sm text-foreground">
          If an account exists for that email, a reset link has been sent.
        </p>
        <p className="text-xs text-muted-foreground">
          Check your inbox — the link expires in 1 hour and can be used once.
        </p>
        <Link href="/login" className="inline-block text-sm text-gold hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...form.register('email')}
        />
        {errors.email ? (
          <p id="email-error" className="text-xs text-destructive">
            {errors.email.message}
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
        Send reset link
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-gold hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
