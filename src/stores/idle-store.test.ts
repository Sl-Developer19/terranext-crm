import { beforeEach, describe, expect, it } from 'vitest';

import { useIdleStore } from './idle-store';

describe('useIdleStore (M1-B)', () => {
  beforeEach(() => {
    useIdleStore.setState({ status: 'active', lastActivityAt: Date.now() });
  });

  it('moves active -> warning -> locked', () => {
    useIdleStore.getState().warn();
    expect(useIdleStore.getState().status).toBe('warning');

    useIdleStore.getState().lock();
    expect(useIdleStore.getState().status).toBe('locked');
  });

  it('activity resets from warning back to active', () => {
    useIdleStore.getState().warn();
    useIdleStore.getState().recordActivity();
    expect(useIdleStore.getState().status).toBe('active');
  });

  it('activity is ignored once locked — only unlock clears it', () => {
    useIdleStore.getState().lock();
    useIdleStore.getState().recordActivity();
    expect(useIdleStore.getState().status).toBe('locked');

    useIdleStore.getState().unlock();
    expect(useIdleStore.getState().status).toBe('active');
  });

  it('warn() is a no-op once already locked', () => {
    useIdleStore.getState().lock();
    useIdleStore.getState().warn();
    expect(useIdleStore.getState().status).toBe('locked');
  });
});
