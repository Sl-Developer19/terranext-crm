import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/features/auth';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            TerraNext Global Ventures
          </p>
          <h1 className="mt-2 text-xl font-semibold">{siteConfig.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your staff account</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {/* useSearchParams (next redirect param) requires a Suspense boundary */}
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Accounts are provisioned by your system administrator. There is no self-registration.
        </p>
      </div>
    </main>
  );
}
