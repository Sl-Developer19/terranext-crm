import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

/** 403 screen (Doc 05 §4): explains scoping, never a silent redirect. */
export function NoAccess({ permission }: { permission?: string | undefined }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <ShieldAlert className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
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
