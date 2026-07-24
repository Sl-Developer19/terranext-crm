import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

/** 403 screen (Doc 05 §4): explains scoping, never a silent redirect. */
export function NoAccess({ permission }: { permission?: string | undefined }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10">
        <ShieldAlert className="size-6 text-destructive" aria-hidden />
      </span>
      <h1 className="font-heading text-xl font-semibold">
        You don&apos;t have access to this page
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {permission
          ? `Your role doesn't include the "${permission}" permission.`
          : "Your role doesn't include this permission."}{' '}
        Contact your system administrator if you believe this is wrong.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
