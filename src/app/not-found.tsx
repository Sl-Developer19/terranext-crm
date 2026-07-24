import { Compass } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

/**
 * Global 404 — Next.js renders this for any unmatched route. Purely
 * presentational; it does not participate in auth or routing decisions.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo size="md" wordmark={false} className="mb-2" />
      <span className="flex size-14 items-center justify-center rounded-full border border-gold/25 bg-gold/10">
        <Compass className="size-6 text-gold" aria-hidden />
      </span>
      <p className="font-mono text-sm tracking-widest text-muted-foreground">404</p>
      <h1 className="font-heading text-xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Button asChild size="sm" className="mt-2">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
