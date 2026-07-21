import 'server-only';

import { adminDb } from '@/lib/firebase/admin';

import { findBatchById, findBatches, findRoster, findSessions } from './repository';
import type { Batch, BatchFilters, BatchSession, RosterEntry } from './schema';

/** Read models for S23 (list) and S24 (workspace). */

export async function listBatches(filters: BatchFilters): Promise<Batch[]> {
  return findBatches(filters);
}

export async function getBatch(batchId: string): Promise<Batch | null> {
  return findBatchById(batchId);
}

export async function listSessions(batchId: string): Promise<BatchSession[]> {
  return findSessions(batchId);
}

export async function listRoster(batchId: string): Promise<RosterEntry[]> {
  return findRoster(batchId);
}

/**
 * Batches that can still receive allocations (planned or running). Full
 * batches are included so the allocation UI can show them as disabled rather
 * than silently omitting a batch the coordinator was looking for.
 */
export async function listAllocatableBatches(): Promise<Batch[]> {
  const batches = await findBatches({});
  return batches.filter((batch) => batch.status === 'planned' || batch.status === 'running');
}

/** Active trainers for the batch assignment picklist. */
export async function listTrainers(): Promise<Array<{ uid: string; displayName: string }>> {
  const snap = await adminDb()
    .collection('users')
    .where('role', '==', 'trainer')
    .where('status', '==', 'active')
    .where('deletedAt', '==', null)
    .get();
  return snap.docs
    .map((doc) => ({
      uid: doc.id,
      displayName:
        typeof doc.get('displayName') === 'string' ? (doc.get('displayName') as string) : doc.id,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
