import { create } from 'zustand';

/**
 * Client-side idle-presence state for high-privilege roles (M1-B, Doc 02 §3).
 * Purely a UI gate — the underlying `__session` cookie is untouched by any
 * transition here; only the server-verified `/api/auth/reauth` call may
 * trigger `unlock`.
 */
export type IdleStatus = 'active' | 'warning' | 'locked';

interface IdleState {
  status: IdleStatus;
  lastActivityAt: number;
  /** Any tracked user activity while not locked. */
  recordActivity(): void;
  /** Idle time has crossed into the warning window. */
  warn(): void;
  /** Idle time has crossed the timeout — block the UI. */
  lock(): void;
  /** Server verified the password — clear the lock and reset the clock. */
  unlock(): void;
}

export const useIdleStore = create<IdleState>((set, get) => ({
  status: 'active',
  lastActivityAt: Date.now(),
  recordActivity() {
    if (get().status === 'locked') return;
    set({ status: 'active', lastActivityAt: Date.now() });
  },
  warn() {
    if (get().status === 'locked') return;
    set({ status: 'warning' });
  },
  lock() {
    set({ status: 'locked' });
  },
  unlock() {
    set({ status: 'active', lastActivityAt: Date.now() });
  },
}));
