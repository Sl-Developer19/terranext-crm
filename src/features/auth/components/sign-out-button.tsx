'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';

// No client-SDK signOut: under ADR-013 the browser Firebase SDK is never
// signed in — the HttpOnly session cookie is the only auth state to clear.
export function SignOutButton({
  endpoint = '/api/session',
  redirectTo = '/login',
}: {
  /** Doc 25, ADR-014: the partner portal tears down its own cookie. */
  endpoint?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleSignOut = async () => {
    setPending(true);
    try {
      await fetch(endpoint, { method: 'DELETE' });
    } finally {
      router.replace(redirectTo);
      router.refresh();
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut} loading={pending}>
      <LogOut aria-hidden />
      Sign out
    </Button>
  );
}
