'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const challengeSchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});
type ChallengeInput = z.infer<typeof challengeSchema>;

interface Props {
  /** The short-lived JWT returned by /api/auth/login on mfa_required. */
  mfaToken: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const GENERIC_ERROR = 'Verification failed. Please try again.';

/**
 * Inline TOTP challenge form — shown after a successful password stage when
 * the account has MFA enrolled (Doc 10 §1). Submits to /api/auth/mfa/challenge.
 */
export function MfaChallengeForm({ mfaToken, onSuccess, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChallengeInput>({
    resolver: zodResolver(challengeSchema),
  });

  async function onSubmit(values: ChallengeInput) {
    setError(null);
    try {
      const response = await fetch('/api/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, totpCode: values.totpCode }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) {
        onSuccess();
        return;
      }
      setError(body?.error?.message ?? GENERIC_ERROR);
    } catch {
      setError('Network problem — check your connection and try again.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Two-factor verification required</p>
        <p className="mt-0.5">
          Open your authenticator app and enter the 6-digit code for TerraNext Business OS.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="totp-code" required>
            Authenticator code
          </Label>
          <Input
            id="totp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            autoFocus
            aria-invalid={Boolean(errors.totpCode)}
            aria-describedby={errors.totpCode ? 'totp-code-error' : undefined}
            className="text-center font-mono text-lg tracking-widest"
            {...register('totpCode')}
          />
          {errors.totpCode ? (
            <p id="totp-code-error" className="text-xs text-destructive">
              {errors.totpCode.message}
            </p>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            Verify
          </Button>
        </div>
      </form>
    </div>
  );
}
