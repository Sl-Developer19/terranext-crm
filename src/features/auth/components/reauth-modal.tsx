'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { reauthSchema, type ReauthInput } from '../schema';

/**
 * Idle-timeout lock screen (Doc 10 §1 addendum, M1-B). Not a dismissible
 * dialog — there is no close affordance, no Escape/outside-click handling,
 * by design (the whole point is to block interaction until re-verified).
 *
 * POST /api/auth/reauth re-checks the password server-side against the
 * signed-in session's own account (Doc 10 §1); success only clears the
 * client-side lock — no new session cookie is issued.
 */

const GENERIC_ERROR = 'Unlock failed. Please try again.';

interface ReauthResponseBody {
  ok?: boolean;
  error?: { message?: string };
}

export function ReauthModal({ email, onUnlock }: { email: string | null; onUnlock: () => void }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [retryAfter, setRetryAfter] = React.useState(0);

  // Cosmetic countdown while locked (server re-checks the lock regardless).
  React.useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setInterval(() => setRetryAfter((s) => (s > 1 ? s - 1 : 0)), 1_000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const form = useForm<ReauthInput>({
    resolver: zodResolver(reauthSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = async (values: ReauthInput) => {
    setFormError(null);
    try {
      const response = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as ReauthResponseBody | null;

      if (response.ok && body?.ok) {
        form.reset();
        onUnlock();
        return;
      }

      if (response.status === 429) {
        const headerSeconds = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
          setRetryAfter(Math.ceil(headerSeconds));
        }
      }
      form.setValue('password', '');
      setFormError(body?.error?.message ?? GENERIC_ERROR);
    } catch {
      setFormError('Network problem — check your connection and try again.');
    }
  };

  const { errors, isSubmitting } = form.formState;
  const lockedOut = retryAfter > 0;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reauth-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
        <h2 id="reauth-title" className="text-lg font-semibold">
          Session locked
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {email ? `Signed in as ${email}. ` : ''}
          You were idle for a while — re-enter your password to continue.
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reauth-password" required>
              Password
            </Label>
            <Input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'reauth-password-error' : undefined}
              {...form.register('password')}
            />
            {errors.password ? (
              <p id="reauth-password-error" className="text-xs text-destructive">
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
                ? `Too many failed attempts. Try again in ${retryAfter} seconds.`
                : formError}
            </div>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting} disabled={lockedOut}>
            Unlock
          </Button>
        </form>
      </div>
    </div>
  );
}
