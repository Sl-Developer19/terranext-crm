'use client';

import { useIdleStore } from '@/stores/idle-store';

import { ReauthModal } from './reauth-modal';

/**
 * Renders the idle-timeout lock modal when `useIdleStore` says locked
 * (M1-B). Lives in `features/auth` rather than `components/providers`
 * because rendering it requires importing a feature component, and
 * `providers` may not depend on `features` (Doc 02 §5 boundaries) —
 * `IdleTimeoutProvider` owns the timer, this owns the UI it drives.
 */
export function IdleLockGate({ email }: { email: string | null }) {
  const status = useIdleStore((s) => s.status);
  const unlock = useIdleStore((s) => s.unlock);

  if (status !== 'locked') return null;
  return <ReauthModal email={email} onUnlock={unlock} />;
}
