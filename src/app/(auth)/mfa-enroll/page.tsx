import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MfaEnrollmentFlow } from '@/features/auth/components/mfa-enrollment-flow';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = { title: 'MFA Enrollment' };

export default function MfaEnrollPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            TerraNext Global Ventures
          </p>
          <h1 className="mt-2 text-xl font-semibold">{siteConfig.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Security Setup</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <Suspense>
            <MfaEnrollmentFlow />
          </Suspense>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Contact your system administrator if you lose access to your authenticator device.
        </p>
      </div>
    </main>
  );
}
