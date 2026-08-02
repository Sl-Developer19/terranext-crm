'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

/** Realtime-enough refresh for the Processing Queue and Dashboard: the
 * client SDK has no authenticated Firestore reads yet (custom-token minting
 * is a tracked follow-up outside this module's scope), so live status here
 * is periodic server-component re-fetch rather than `onSnapshot`. */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  React.useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
