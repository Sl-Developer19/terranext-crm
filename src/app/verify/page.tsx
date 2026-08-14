'use client';

import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';

/**
 * Public certificate verification page (Doc 19 §1, Certificate Template
 * Engine). Unauthenticated — an employer scanning a certificate's QR code
 * has no CRM account, same posture as the JSON API this page wraps. This is
 * a UI shell only: `/api/certificates/verify` remains the single source of
 * truth, including its rate limiting, no-PII, and no-enumeration-oracle
 * guarantees. Excluded from auth middleware (see middleware.ts matcher).
 */

interface VerificationResult {
  valid: boolean;
  certificateNo?: string;
  programmeName?: string;
  issuedAt?: string;
  status?: 'issued' | 'revoked';
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p>Loading…</p>
        </CardContent>
      </Card>
    </div>
  );
}

function VerifyContent() {
  const params = useSearchParams();
  const no = params.get('no') ?? '';
  const hash = params.get('hash') ?? '';
  const [state, setState] = React.useState<'loading' | 'done' | 'error'>('loading');
  const [result, setResult] = React.useState<VerificationResult | null>(null);

  React.useEffect(() => {
    if (!no || !hash) {
      setResult({ valid: false });
      setState('done');
      return;
    }

    let cancelled = false;
    fetch(`/api/certificates/verify?no=${encodeURIComponent(no)}&hash=${encodeURIComponent(hash)}`)
      .then((res) => res.json() as Promise<VerificationResult>)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setState('done');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [no, hash]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>

          {state === 'loading' ? (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <p>Checking certificate…</p>
            </div>
          ) : state === 'error' ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-12 w-12 text-destructive" aria-hidden />
              <p className="font-medium">Could not check this certificate</p>
              <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
            </div>
          ) : result?.valid ? (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden />
              <p className="text-lg font-semibold">Certificate Verified</p>
              <dl className="mt-2 w-full space-y-2 text-left text-sm">
                {result.certificateNo ? (
                  <div className="flex justify-between border-b pb-2">
                    <dt className="text-muted-foreground">Certificate No.</dt>
                    <dd className="font-mono font-medium">{result.certificateNo}</dd>
                  </div>
                ) : null}
                {result.programmeName ? (
                  <div className="flex justify-between border-b pb-2">
                    <dt className="text-muted-foreground">Programme</dt>
                    <dd className="font-medium">{result.programmeName}</dd>
                  </div>
                ) : null}
                {result.issuedAt ? (
                  <div className="flex justify-between pb-2">
                    <dt className="text-muted-foreground">Issued</dt>
                    <dd className="font-medium">
                      {new Date(result.issuedAt).toLocaleDateString()}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-12 w-12 text-destructive" aria-hidden />
              <p className="text-lg font-semibold">
                {result?.status === 'revoked' ? 'Certificate Revoked' : 'Certificate Not Valid'}
              </p>
              <p className="text-sm text-muted-foreground">
                {result?.status === 'revoked'
                  ? 'This certificate has been revoked and is no longer valid.'
                  : 'We could not verify this certificate. Check the link and try again.'}
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Verified by TerraNext
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
