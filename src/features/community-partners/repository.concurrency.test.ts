import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

/**
 * Concurrency test for Feature 4 (Human Partner ID Generation).
 *
 * There is no emulator-backed integration-test lane in this repo for the
 * `counters/{name}` pattern — not for this counter, and not for the three
 * existing ones it's copied from (`participantId`, `certificateNo`,
 * `receiptNo`; confirmed by search before writing this feature). Building
 * one would mean new Admin-SDK-against-emulator test infrastructure this
 * codebase doesn't have anywhere yet. Instead, `FakeFirestore` below is a
 * faithful in-memory simulator of Firestore's actual transaction contract —
 * snapshot reads, commit-time optimistic-concurrency conflict detection, and
 * automatic retry — the exact guarantee `reserveCommunityPartnerId` depends
 * on in production. The function under test is the real, unmodified
 * production code (`./repository`), not a reimplementation.
 */
class FakeFirestore {
  private store = new Map<
    string,
    { data: Record<string, unknown> | undefined; generation: number }
  >();
  /** Total transaction attempts, including ones that lost the race and retried. */
  attemptCount = 0;

  collection(name: string) {
    return {
      doc: (id: string) => ({ path: `${name}/${id}` }) as unknown as DocumentReference,
    };
  }

  private cell(path: string) {
    let cell = this.store.get(path);
    if (!cell) {
      cell = { data: undefined, generation: 0 };
      this.store.set(path, cell);
    }
    return cell;
  }

  async runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      this.attemptCount += 1;
      const readGenerations = new Map<string, number>();
      const pendingWrites = new Map<string, Record<string, unknown>>();

      const tx = {
        get: async (ref: { path: string }) => {
          const cell = this.cell(ref.path);
          readGenerations.set(ref.path, cell.generation);
          const data = cell.data;
          return {
            exists: data !== undefined,
            get: (field: string) => data?.[field],
          };
        },
        set: (
          ref: { path: string },
          data: Record<string, unknown>,
          options?: { merge?: boolean },
        ) => {
          const cell = this.cell(ref.path);
          const base = options?.merge ? { ...(cell.data ?? {}) } : {};
          pendingWrites.set(ref.path, { ...base, ...data });
        },
      } as unknown as Transaction;

      const result = await fn(tx);

      // Yield a tick so genuinely concurrent callers interleave their read
      // and write phases before any of them commits — without this, the
      // "race" would just be an artifact of synchronous execution rather
      // than a real test of optimistic-concurrency conflict handling.
      await new Promise((resolve) => setTimeout(resolve, 0));

      let conflict = false;
      for (const [path, genAtRead] of readGenerations) {
        if (this.cell(path).generation !== genAtRead) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue; // Firestore's real behavior: retry the whole callback.

      for (const [path, data] of pendingWrites) {
        const cell = this.cell(path);
        cell.data = data;
        cell.generation += 1;
      }
      return result;
    }
    throw new Error(
      'FakeFirestore: transaction did not converge — check for a livelock in the test.',
    );
  }
}

let fakeDb: FakeFirestore;

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: () => fakeDb,
}));

const { reserveCommunityPartnerId } = await import('./repository');

describe('reserveCommunityPartnerId — concurrency', () => {
  beforeEach(() => {
    fakeDb = new FakeFirestore();
  });

  it('mints sequential IDs for sequential (non-concurrent) approvals', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      ids.push(await fakeDb.runTransaction((tx) => reserveCommunityPartnerId(tx, 'TCGN')));
    }
    expect(ids).toEqual(['TCGN-000001', 'TCGN-000002', 'TCGN-000003']);
  });

  it('never mints a duplicate ID across concurrent approvals', async () => {
    const CONCURRENT = 25;
    const ids = await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        fakeDb.runTransaction((tx) => reserveCommunityPartnerId(tx, 'TCGN')),
      ),
    );

    expect(ids).toHaveLength(CONCURRENT);
    expect(new Set(ids).size).toBe(CONCURRENT);
    expect([...ids].sort()).toEqual(
      Array.from({ length: CONCURRENT }, (_, i) => `TCGN-${String(i + 1).padStart(6, '0')}`).sort(),
    );
  });

  it('leaves the counter at exactly N after N concurrent reservations — no lost updates', async () => {
    const CONCURRENT = 25;
    await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        fakeDb.runTransaction((tx) => reserveCommunityPartnerId(tx, 'TCGN')),
      ),
    );

    const counterRef = fakeDb.collection('counters').doc('communityPartnerId');
    const finalCurrent = await fakeDb.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      return snap.get('current') as number;
    });
    expect(finalCurrent).toBe(CONCURRENT);
  });

  it('actually exercises the optimistic-concurrency retry path under contention', async () => {
    const CONCURRENT = 25;
    await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        fakeDb.runTransaction((tx) => reserveCommunityPartnerId(tx, 'TCGN')),
      ),
    );
    // More attempts than successful commits proves at least one transaction
    // lost the race and was transparently retried, exactly as Firestore
    // itself behaves under contention — not that every caller happened to
    // run without ever overlapping.
    expect(fakeDb.attemptCount).toBeGreaterThan(CONCURRENT);
  });

  it('mixes with a pre-seeded counter (simulating IDs already minted earlier) without collision', async () => {
    const SEEDED_CURRENT = 999_997;
    const counterRef = fakeDb.collection('counters').doc('communityPartnerId');
    await fakeDb.runTransaction(async (tx) => {
      tx.set(counterRef, { current: SEEDED_CURRENT, prefix: 'TCGN' }, { merge: true });
      return undefined;
    });

    const ids = await Promise.all(
      Array.from({ length: 5 }, () =>
        fakeDb.runTransaction((tx) => reserveCommunityPartnerId(tx, 'TCGN')),
      ),
    );

    // Compared as a set (not a lexicographically sorted array): once the
    // sequence crosses a digit-count boundary ("999999" → "1000000"), string
    // sort no longer matches numeric order, so set-equality is the correct
    // check for "exactly these five values, each exactly once".
    const expected = new Set(
      Array.from(
        { length: 5 },
        (_, i) => `TCGN-${String(SEEDED_CURRENT + i + 1).padStart(6, '0')}`,
      ),
    );
    expect(new Set(ids)).toEqual(expected);
    expect(new Set(ids).size).toBe(5);
  });

  it('uses the caller-supplied (Settings-configured) prefix when no counter exists yet', async () => {
    const id = await fakeDb.runTransaction((tx) => reserveCommunityPartnerId(tx, 'CUSTOMPFX'));
    expect(id).toBe('CUSTOMPFX-000001');
  });

  it('keeps the prefix already persisted on the counter even if a different prefix is supplied later — Settings changes never retroactively alter already-issued IDs', async () => {
    const counterRef = fakeDb.collection('counters').doc('communityPartnerId');
    await fakeDb.runTransaction(async (tx) => {
      tx.set(counterRef, { current: 3, prefix: 'ORIGINAL' }, { merge: true });
      return undefined;
    });

    const id = await fakeDb.runTransaction((tx) => reserveCommunityPartnerId(tx, 'CHANGEDLATER'));
    expect(id).toBe('ORIGINAL-000004');
  });
});
