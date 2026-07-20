'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { IDLE_SECURITY } from '@/config/idle-security';
import { useIdleStore } from '@/stores/idle-store';
import type { StaffRole } from '@/types/common';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'] as const;
const CHECK_INTERVAL_MS = 1_000;
const WARNING_TOAST_ID = 'idle-timeout-warning';

/**
 * Idle-timeout presence tracker for high-privilege roles (Doc 10 §1
 * addendum, M1-B). Renders nothing itself — it only drives `useIdleStore`;
 * `IdleLockGate` (features/auth) renders the lock modal from that state.
 * Kept role-gated here (not just in the gate) so the timer/listeners never
 * run at all for roles the policy doesn't cover.
 */
export function IdleTimeoutProvider({ role }: { role: StaffRole }) {
  const enforced = (IDLE_SECURITY.lockRoles as readonly StaffRole[]).includes(role);
  const status = useIdleStore((s) => s.status);
  const recordActivity = useIdleStore((s) => s.recordActivity);
  const warn = useIdleStore((s) => s.warn);
  const lock = useIdleStore((s) => s.lock);

  React.useEffect(() => {
    if (!enforced) return undefined;

    const handleActivity = () => {
      if (useIdleStore.getState().status === 'locked') return;
      toast.dismiss(WARNING_TOAST_ID);
      recordActivity();
    };
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    );

    const interval = setInterval(() => {
      const { status: currentStatus, lastActivityAt } = useIdleStore.getState();
      if (currentStatus === 'locked') return;
      const idleMs = Date.now() - lastActivityAt;
      if (idleMs >= IDLE_SECURITY.timeoutMs) {
        toast.dismiss(WARNING_TOAST_ID);
        lock();
      } else if (idleMs >= IDLE_SECURITY.timeoutMs - IDLE_SECURITY.warningMs) {
        warn();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
      clearInterval(interval);
    };
  }, [enforced, recordActivity, lock, warn]);

  React.useEffect(() => {
    if (!enforced || status !== 'warning') return;
    const secondsLeft = Math.round(IDLE_SECURITY.warningMs / 1000);
    toast.warning(`You'll be locked out in ${secondsLeft}s due to inactivity.`, {
      id: WARNING_TOAST_ID,
      duration: IDLE_SECURITY.warningMs,
    });
  }, [enforced, status]);

  return null;
}
