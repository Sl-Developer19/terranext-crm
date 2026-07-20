'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { loginSchema, type LoginInput } from '../schema';

/**
 * Sign-in via POST /api/auth/login — the server verifies the password,
 * enforces the brute-force lockout, and sets the session cookie itself
 * (Doc 10 §1 as amended by ADR-013). No client-side Firebase sign-in.
 *
 * The lockout countdown below is purely cosmetic UX; the server re-checks
 * the lock on every attempt regardless.
 */

const GENERIC_ERROR = 'Sign-in failed. Please try again.';

interface LoginResponseBody {
  ok?: boolean;
  data?: { status?: string; message?: string };
  error?: { message?: string };
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [retryAfter, setRetryAfter] = React.useState<number>(0);

  // Cosmetic countdown while locked (server-enforced regardless).
  React.useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((s) => (s > 1 ? s - 1 : 0));
    }, 1_000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as LoginResponseBody | null;

      if (response.ok && body?.ok) {
        if (body.data?.status === 'mfa_required') {
          setFormError(body.data.message ?? GENERIC_ERROR);
          return;
        }
        const next = searchParams.get('next');
        router.replace(next && next.startsWith('/') ? next : '/dashboard');
        router.refresh();
        return;
      }

      if (response.status === 429) {
        const headerSeconds = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
          setRetryAfter(Math.ceil(headerSeconds));
        }
      }
      setFormError(body?.error?.message ?? GENERIC_ERROR);
    } catch {
      setFormError('Network problem — check your connection and try again.');
    }
  };

  const { errors, isSubmitting } = form.formState;
  const lockedOut = retryAfter > 0;

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

      <div className="space-y-2">
        <Label htmlFor="password" required>
          Password
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...form.register('password')}
        />
        {errors.password ? (
          <p id="password-error" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {lockedOut
            ? `Too many failed login attempts. Try again in ${retryAfter} seconds.`
            : formError}
        </div>
      ) : null}

      <Button type="submit" className="w-full" loading={isSubmitting} disabled={lockedOut}>
        Sign in
      </Button>
    </form>
  );
}
