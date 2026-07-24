import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Logo } from '@/components/ui/logo';
import { LoginForm } from '@/features/auth';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 70% 60% at 50% 0%, hsl(var(--emerald) / 0.16), transparent), radial-gradient(ellipse 50% 40% at 85% 90%, hsl(var(--gold) / 0.1), transparent)',
        }}
      />

      <div className="relative w-full max-w-sm animate-fade-up space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo size="xl" wordmark={false} className="mb-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            TerraNext Global Ventures
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold text-foreground">
            {siteConfig.name}
          </h1>
          <p className="mt-1.5 text-sm text-foreground-secondary">{siteConfig.description}</p>
        </div>

        <div className="card-sheen glass rounded-xl border border-border p-7 shadow-premium-lg">
          <h2 className="mb-5 text-sm font-medium text-foreground-secondary">
            Sign in with your staff account
          </h2>
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
