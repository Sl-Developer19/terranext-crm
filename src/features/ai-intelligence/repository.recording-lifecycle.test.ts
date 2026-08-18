import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

/**
 * Regression coverage for the Pause/Resume fix: Pause must succeed the
 * instant recording starts, not only once chunk 0 has finished uploading
 * (which can take up to `CHUNK_DURATION_SECONDS`). `FakeFirestore` mirrors
 * the in-memory transaction simulator already established in
 * `community-partners/repository.concurrency.test.ts` — snapshot reads and
 * transactional writes against the real, unmodified production functions —
 * plus (new here) Firestore's automatic Date -> Timestamp coercion on
 * write, since `toPauseEventInput` in `./repository` only recognises real
 * `Timestamp` instances when reading pause history back.
 */
class FakeFirestore {
  private store = new Map<string, Record<string, unknown> | undefined>();

  collection(name: string) {
    return {
      doc: (id: string) => ({ path: `${name}/${id}` }) as unknown as DocumentReference,
    };
  }

  seed(path: string, data: Record<string, unknown>) {
    this.store.set(path, { ...data });
  }

  read(path: string): Record<string, unknown> | undefined {
    return this.store.get(path);
  }

  private toFirestoreValue(value: unknown): unknown {
    if (value instanceof Date) return Timestamp.fromDate(value);
    if (Array.isArray(value)) return value.map((v) => this.toFirestoreValue(v));
    if (value !== null && typeof value === 'object' && !(value instanceof Timestamp)) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          this.toFirestoreValue(v),
        ]),
      );
    }
    return value;
  }

  private applyWrite(path: string, data: Record<string, unknown>, merge: boolean) {
    const existing = this.store.get(path);
    if (!merge && existing === undefined) {
      throw new Error(`FakeFirestore: update on missing doc ${path}`);
    }
    const converted = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, this.toFirestoreValue(v)]),
    );
    this.store.set(path, { ...(existing ?? {}), ...converted });
  }

  async runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = {
      get: async (ref: { path: string }) => {
        const data = this.store.get(ref.path);
        return {
          exists: data !== undefined,
          get: (field: string) => data?.[field],
        };
      },
      update: (ref: { path: string }, data: Record<string, unknown>) => {
        this.applyWrite(ref.path, data, false);
      },
      set: (
        ref: { path: string },
        data: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => {
        this.applyWrite(ref.path, data, Boolean(options?.merge));
      },
    } as unknown as Transaction;

    return fn(tx);
  }
}

let fakeDb: FakeFirestore;

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: () => fakeDb,
}));

const { markSessionRecordingStartedIfDraft, markSessionPaused, markSessionResumed } =
  await import('./repository');

function seedSession(fake: FakeFirestore, id: string, overrides: Record<string, unknown> = {}) {
  fake.seed(`aiSessions/${id}`, {
    status: 'draft',
    pauseCount: 0,
    pauseHistory: [],
    pausedDurationSeconds: 0,
    ...overrides,
  });
}

describe('markSessionRecordingStartedIfDraft — draft -> recording', () => {
  beforeEach(() => {
    fakeDb = new FakeFirestore();
  });

  it('transitions draft -> recording', async () => {
    seedSession(fakeDb, 's1', { status: 'draft' });
    const outcome = await markSessionRecordingStartedIfDraft('s1', 'trainer-1');
    expect(outcome).toBe('started');
    expect(fakeDb.read('aiSessions/s1')?.status).toBe('recording');
  });

  it('is idempotent for a retried Start call that already landed', async () => {
    seedSession(fakeDb, 's1', { status: 'recording' });
    const outcome = await markSessionRecordingStartedIfDraft('s1', 'trainer-1');
    expect(outcome).toBe('already-recording');
    expect(fakeDb.read('aiSessions/s1')?.status).toBe('recording');
  });

  it.each(['paused', 'processing', 'completed', 'failed'])(
    'rejects starting a session that is already %s',
    async (status) => {
      seedSession(fakeDb, 's1', { status });
      const outcome = await markSessionRecordingStartedIfDraft('s1', 'trainer-1');
      expect(outcome).toBe('invalid');
      expect(fakeDb.read('aiSessions/s1')?.status).toBe(status);
    },
  );

  it('rejects starting a session that does not exist', async () => {
    const outcome = await markSessionRecordingStartedIfDraft('missing', 'trainer-1');
    expect(outcome).toBe('invalid');
  });
});

describe('Pause immediately after Start — the exact bug this fix closes', () => {
  beforeEach(() => {
    fakeDb = new FakeFirestore();
  });

  it('lets Pause succeed the instant recording starts, before chunk 0 could possibly have finished', async () => {
    seedSession(fakeDb, 's1', { status: 'draft' });

    const started = await markSessionRecordingStartedIfDraft('s1', 'trainer-1');
    expect(started).toBe('started');

    // No chunk has been uploaded yet — chunk 0 can take up to
    // CHUNK_DURATION_SECONDS. This is exactly the race that used to make
    // pauseSessionRecording fail with "This session is not currently
    // recording."
    const paused = await markSessionPaused('s1', 'trainer-1');
    expect(paused).toBe(true);
    expect(fakeDb.read('aiSessions/s1')?.status).toBe('paused');
  });

  it('still rejects Pause while the session is genuinely draft (pre-fix regression guard)', async () => {
    seedSession(fakeDb, 's1', { status: 'draft' });
    const paused = await markSessionPaused('s1', 'trainer-1');
    expect(paused).toBe(false);
    expect(fakeDb.read('aiSessions/s1')?.status).toBe('draft');
  });
});

describe('Resume', () => {
  beforeEach(() => {
    fakeDb = new FakeFirestore();
  });

  it('paused -> recording', async () => {
    seedSession(fakeDb, 's1', { status: 'draft' });
    await markSessionRecordingStartedIfDraft('s1', 'trainer-1');
    await markSessionPaused('s1', 'trainer-1');

    const resumed = await markSessionResumed('s1', 'trainer-1');
    expect(resumed).toBe(true);
    expect(fakeDb.read('aiSessions/s1')?.status).toBe('recording');
  });

  it('rejects resuming a session that is not paused', async () => {
    seedSession(fakeDb, 's1', { status: 'recording' });
    const resumed = await markSessionResumed('s1', 'trainer-1');
    expect(resumed).toBe(false);
  });
});

describe('Stop while paused', () => {
  beforeEach(() => {
    fakeDb = new FakeFirestore();
  });

  it('leaves the session in the paused status finalizeSessionRecording already accepts', async () => {
    seedSession(fakeDb, 's1', { status: 'draft' });
    await markSessionRecordingStartedIfDraft('s1', 'trainer-1');
    await markSessionPaused('s1', 'trainer-1');

    // finalizeSessionRecording's own status gate (record-audio.ts) already
    // allows both 'recording' and 'paused', unchanged by this fix. This
    // asserts the precondition it depends on: Pause genuinely leaves the
    // session `paused` rather than stuck on `draft` the way it did before.
    expect(fakeDb.read('aiSessions/s1')?.status).toBe('paused');
  });
});

describe('Repeated Pause/Resume cycles', () => {
  beforeEach(() => {
    fakeDb = new FakeFirestore();
  });

  it('accumulates pauseCount and closes every pause event across multiple cycles', async () => {
    seedSession(fakeDb, 's1', { status: 'draft' });
    await markSessionRecordingStartedIfDraft('s1', 'trainer-1');

    for (let i = 0; i < 3; i += 1) {
      expect(await markSessionPaused('s1', 'trainer-1')).toBe(true);
      expect(await markSessionResumed('s1', 'trainer-1')).toBe(true);
    }

    const doc = fakeDb.read('aiSessions/s1');
    expect(doc?.status).toBe('recording');
    expect(doc?.pauseCount).toBe(3);
    const history = doc?.pauseHistory as Array<{ resumedAt: unknown }>;
    expect(history).toHaveLength(3);
    for (const event of history) {
      expect(event.resumedAt).not.toBeNull();
    }
  });

  it('a double-click Pause (second call while already paused) safely no-ops rather than double-counting', async () => {
    seedSession(fakeDb, 's1', { status: 'draft' });
    await markSessionRecordingStartedIfDraft('s1', 'trainer-1');
    expect(await markSessionPaused('s1', 'trainer-1')).toBe(true);
    expect(await markSessionPaused('s1', 'trainer-1')).toBe(false);
    expect(fakeDb.read('aiSessions/s1')?.pauseCount).toBe(1);
  });

  it('a double-click Resume (second call while already recording) safely no-ops', async () => {
    seedSession(fakeDb, 's1', { status: 'draft' });
    await markSessionRecordingStartedIfDraft('s1', 'trainer-1');
    await markSessionPaused('s1', 'trainer-1');
    expect(await markSessionResumed('s1', 'trainer-1')).toBe(true);
    expect(await markSessionResumed('s1', 'trainer-1')).toBe(false);
  });
});
