'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'setup' | 'verify' | 'done';

interface EnrollData {
  qrCodeUri: string;
  totpSecret: string;
  sessionInfo: string;
}

const verifySchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});
type VerifyInput = z.infer<typeof verifySchema>;

/**
 * TOTP MFA enrollment flow (Doc 10 §1).
 *
 * Step 1: "Setup" — start enrollment (GET /api/auth/mfa/enroll), display QR code
 * Step 2: "Verify" — user enters a code to confirm the authenticator is working
 * Step 3: "Done" — enrollment confirmed, redirect to dashboard
 *
 * For high-privilege roles (founder, system_admin, finance) this page is
 * mandatory — middleware redirects them here if mfaEnrolled claim is missing.
 */
export function MfaEnrollmentFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('setup');
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyInput>({ resolver: zodResolver(verifySchema) });

  async function startEnrollment() {
    setStarting(true);
    setStartError(null);
    try {
      const response = await fetch('/api/auth/mfa/enroll', { method: 'GET' });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) {
        setEnrollData(body.data);
        setStep('verify');
      } else {
        setStartError(body?.error?.message ?? 'Could not start MFA setup. Please try again.');
      }
    } catch {
      setStartError('Network problem — check your connection and try again.');
    } finally {
      setStarting(false);
    }
  }

  async function onVerify(values: VerifyInput) {
    if (!enrollData) return;
    setVerifyError(null);
    try {
      const response = await fetch('/api/auth/mfa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: values.totpCode, sessionInfo: enrollData.sessionInfo }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) {
        setStep('done');
        toast.success('Two-factor authentication enabled.');
      } else {
        setVerifyError(body?.error?.message ?? 'Verification failed. Please try again.');
      }
    } catch {
      setVerifyError('Network problem — check your connection and try again.');
    }
  }

  if (step === 'setup') {
    return (
      <div className="space-y-5">
        <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <p className="font-semibold">Two-factor authentication required</p>
          <p className="mt-0.5">
            Your role requires MFA to be enabled before you can access the platform. This is a
            one-time setup.
          </p>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">What you will need:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Google Authenticator, Authy, or any TOTP app on your phone</li>
            <li>About 2 minutes to complete setup</li>
          </ul>
        </div>

        {startError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {startError}
          </div>
        ) : null}

        <Button
          id="mfa-start-setup-btn"
          className="w-full"
          loading={starting}
          onClick={startEnrollment}
        >
          Set up authenticator app
        </Button>
      </div>
    );
  }

  if (step === 'verify' && enrollData) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium">Step 1 — Scan the QR code</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open your authenticator app and scan the code below.
          </p>
        </div>

        {/* QR Code display — dynamic QR code URL */}
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollData.qrCodeUri}
            alt="MFA QR code — scan with your authenticator app"
            className="h-44 w-44 rounded-md border border-border bg-white p-2"
          />
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Can&rsquo;t scan the QR code? Enter the key manually.
          </summary>
          <div className="mt-2 select-all rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 font-mono tracking-widest">
            {enrollData.totpSecret}
          </div>
        </details>

        <div>
          <p className="text-sm font-medium">Step 2 — Confirm with a code</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enter the 6-digit code shown in your authenticator app to confirm setup.
          </p>
        </div>

        <form onSubmit={handleSubmit(onVerify)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-verify-code" required>
              Authenticator code
            </Label>
            <Input
              id="mfa-verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="text-center font-mono text-lg tracking-widest"
              aria-invalid={Boolean(errors.totpCode)}
              {...register('totpCode')}
            />
            {errors.totpCode ? (
              <p className="text-xs text-destructive">{errors.totpCode.message}</p>
            ) : null}
          </div>

          {verifyError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {verifyError}
            </div>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting} id="mfa-verify-btn">
            Confirm and enable MFA
          </Button>
        </form>
      </div>
    );
  }

  // Done
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-success/15">
        <span className="text-2xl">✓</span>
      </div>
      <div>
        <p className="text-base font-semibold">MFA enabled</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account is now protected with two-factor authentication.
        </p>
      </div>
      <Button
        id="mfa-done-btn"
        className="w-full"
        onClick={() => {
          router.replace('/dashboard');
          router.refresh();
        }}
      >
        Continue to dashboard
      </Button>
    </div>
  );
}
